import * as assert from 'assert'
import * as sinon from 'sinon'
import * as vscode from 'vscode'
import { generateCommit, isExcludedFile, stripCodeFences } from '../generateCommit'

const mockWindow: any = {
  showWarningMessage: sinon.fake(),
  showErrorMessage: sinon.fake(),
  showInformationMessage: sinon.fake(),
  withProgress: sinon.fake(async (_opts: any, callback: any) => {
    const progress = { report: sinon.fake() }
    const token = { isCancellationRequested: false, onCancellationRequested: sinon.fake() }
    await callback(progress, token)
  }),
}

const defaultWorkspaceFolders = [
  {
    uri: {
      fsPath: '/fake/workspace',
    },
  },
]

const mockWorkspace: any = {
  workspaceFolders: defaultWorkspaceFolders,
  getConfiguration: sinon.fake.returns({
    get: sinon.fake.returns(undefined),
  }),
}

const inputBox = { value: '' }
const repository = { rootUri: { fsPath: '/fake/workspace' }, inputBox }

const mockExtensions: any = {
  getExtension: sinon.stub(),
}

const mockLm: any = {
  selectChatModels: sinon.stub(),
}

function mockModel(response: string, { maxInputTokens = 100_000, countTokens = async (text: string) => text.length } = {}) {
  return {
    maxInputTokens,
    countTokens: sinon.stub().callsFake(countTokens),
    sendRequest: sinon.stub().callsFake(async () => ({
      text: (async function* () {
        yield response
      })(),
    })),
  }
}

// Stubs cp.execFile so the name-only call returns `files` and the full diff call returns `diff`.
function stubGit(files: string[], diff = '') {
  const execFileStub = require('child_process').execFile as sinon.SinonStub
  execFileStub.callsFake((_cmd: string, args: string[], _opts: any, callback: any) => {
    callback(null, args.includes('--name-only') ? files.map(file => `${file}\0`).join('') : diff)
  })
  return execFileStub
}

suite('generateCommit', function () {
  let sandbox: sinon.SinonSandbox

  setup(function () {
    sandbox = sinon.createSandbox()

    mockWindow.showWarningMessage.resetHistory()
    mockWindow.showErrorMessage.resetHistory()
    mockWindow.withProgress.resetHistory()
    mockWorkspace.workspaceFolders = defaultWorkspaceFolders
    inputBox.value = ''
    mockExtensions.getExtension.returns({
      isActive: true,
      exports: {
        getAPI: sinon.stub().returns({
          repositories: [repository],
          getRepository: sinon.stub().returns(repository),
        }),
      },
    })
    mockLm.selectChatModels.resolves([mockModel('feat(test): test commit message')])

    const languageModelChatMessage: any = {}
    languageModelChatMessage.User = (message: string) => message
    ;(vscode as any).LanguageModelChatMessage = languageModelChatMessage
    ;(vscode as any).LanguageModelError = Error

    sandbox.stub(vscode, 'window').get(() => mockWindow)
    sandbox.stub(vscode, 'workspace').get(() => mockWorkspace)
    sandbox.stub(vscode, 'extensions').get(() => mockExtensions)
    sandbox.stub(vscode, 'lm').get(() => mockLm)

    sandbox.stub(require('child_process'), 'execFile')
  })

  teardown(function () {
    sandbox.restore()
  })

  test('should show warning when the git extension is unavailable', async function () {
    mockExtensions.getExtension.returns(undefined)

    await generateCommit()

    assert(mockWindow.showWarningMessage.calledWith('No git repository found in the workspace'))
  })

  test('should show warning when there are no git repositories', async function () {
    mockExtensions.getExtension.returns({
      isActive: true,
      exports: { getAPI: () => ({ repositories: [], getRepository: () => null }) },
    })

    await generateCommit()

    assert(mockWindow.showWarningMessage.calledWith('No git repository found in the workspace'))
  })

  test('should show warning when no files changed', async function () {
    stubGit([])

    await generateCommit()

    assert(mockWindow.showWarningMessage.calledWith('No files changed, stage your changes and try again'))
  })

  test('should show warning when only excluded files are staged', async function () {
    stubGit(['package-lock.json', 'assets/logo.png'])

    await generateCommit()

    assert(mockWindow.showWarningMessage.calledWith('No files changed, stage your changes and try again'))
  })

  test('should run git in the repository root and diff only non-excluded files', async function () {
    const execFileStub = stubGit(['src/my file.ts', 'yarn.lock'], '+added line')

    await generateCommit()

    const diffCall = execFileStub.getCalls().find(call => !call.args[1].includes('--name-only'))!
    assert.deepStrictEqual(diffCall.args[1], ['diff', '--cached', '--', 'src/my file.ts'])
    assert.strictEqual(diffCall.args[2].cwd, '/fake/workspace')
  })

  test('should write the generated message to the SCM input box without code fences', async function () {
    stubGit(['src/app.ts'], '+added line')
    mockLm.selectChatModels.resolves([mockModel('```\nfeat(app): Add line\n```')])

    await generateCommit()

    assert.strictEqual(inputBox.value, 'feat(app): Add line')
    assert(mockWindow.showErrorMessage.notCalled)
  })

  test('should truncate a diff that exceeds the model input limit', async function () {
    stubGit(['src/app.ts'], 'x'.repeat(10_000))
    const model = mockModel('feat(app): Add line', { maxInputTokens: 5_000 })
    mockLm.selectChatModels.resolves([model])

    await generateCommit()

    const sentPrompt: string = model.sendRequest.firstCall.args[0][0]
    assert(sentPrompt.length <= 5_000 * 0.9)
    assert(sentPrompt.includes('[diff truncated]'))
    assert(mockWindow.showWarningMessage.calledWithMatch(/truncated/))
  })
})

suite('isExcludedFile', function () {
  test('excludes lockfiles, images, and generated files', function () {
    for (const file of [
      'package-lock.json',
      'yarn.lock',
      'a/b.png',
      'x.JPG',
      '.terraform.lock.hcl',
      'gen/gql.ts',
      'schema.graphql',
    ]) {
      assert(isExcludedFile(file), file)
    }
  })

  test('keeps ordinary source files whose names merely contain excluded words', function () {
    for (const file of ['src/gqlClient.ts', 'src/clock.ts', 'src/types.ts', 'docs/svg-guide.md', 'src/png.ts']) {
      assert(!isExcludedFile(file), file)
    }
  })
})

suite('stripCodeFences', function () {
  test('removes a wrapping fence with or without a language tag', function () {
    assert.strictEqual(stripCodeFences('```\nfix: A\n```'), 'fix: A')
    assert.strictEqual(stripCodeFences('```text\nfix: A\n\nbody\n```\n'), 'fix: A\n\nbody')
  })

  test('leaves unfenced text alone apart from trimming', function () {
    assert.strictEqual(stripCodeFences('  fix: A\n'), 'fix: A')
  })
})
