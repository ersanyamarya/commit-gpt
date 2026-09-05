import * as assert from 'assert'
import * as sinon from 'sinon'
import * as vscode from 'vscode'
import { generateCommit } from '../generateCommit'

const mockWindow: any = {
  showWarningMessage: sinon.fake(),
  showErrorMessage: sinon.fake(),
  showInformationMessage: sinon.fake(),
  withProgress: sinon.fake(async (_opts: any, callback: any) => {
    const progress = { report: sinon.fake() }
    const token = { onCancellationRequested: sinon.fake() }
    await callback(progress, token)
  }),
  env: {
    clipboard: {
      writeText: sinon.stub().resolves(),
    },
  },
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

const mockExtensions: any = {
  getExtension: sinon.stub(),
}

const mockLm: any = {
  selectChatModels: sinon.stub(),
}

suite('generateCommit', function () {
  let sandbox: sinon.SinonSandbox

  setup(function () {
    sandbox = sinon.createSandbox()

    mockWindow.showWarningMessage.resetHistory()
    mockWindow.showErrorMessage.resetHistory()
    mockWindow.withProgress.resetHistory()
    mockWindow.env.clipboard.writeText.resetHistory()
    mockWorkspace.workspaceFolders = defaultWorkspaceFolders
    mockExtensions.getExtension.returns({
      exports: {
        getAPI: sinon.stub().returns({
          repositories: [
            {
              inputBox,
            },
          ],
        }),
      },
    })
    mockLm.selectChatModels.resolves([
      {
        sendRequest: sinon.stub().returns({
          text: (async function* () {
            yield 'feat(test): test commit message'
          })(),
        }),
      },
    ])

    const languageModelChatMessage: any = {}
    // eslint-disable-next-line @typescript-eslint/naming-convention
    languageModelChatMessage.User = (message: string) => message
    ;(vscode as any).LanguageModelChatMessage = languageModelChatMessage
    ;(vscode as any).LanguageModelError = Error

    sandbox.stub(vscode, 'window').get(() => mockWindow)
    sandbox.stub(vscode, 'env').get(() => mockWindow.env)
    sandbox.stub(vscode, 'workspace').get(() => mockWorkspace)
    sandbox.stub(vscode, 'extensions').get(() => mockExtensions)
    sandbox.stub(vscode, 'lm').get(() => mockLm)

    sandbox.stub(require('child_process'), 'exec')
  })

  teardown(function () {
    sandbox.restore()
  })

  test('should show warning when no workspace folders', async function () {
    mockWorkspace.workspaceFolders = undefined

    await generateCommit()

    assert(mockWindow.showWarningMessage.calledWith('No workspace open'))
  })

  test('should show warning when workspace folder has no uri', async function () {
    mockWorkspace.workspaceFolders = [{ uri: undefined }]

    await generateCommit()

    assert(mockWindow.showWarningMessage.calledWith('No workspace open'))
  })

  test('should show warning when no files changed', async function () {
    const execStub = require('child_process').exec as sinon.SinonStub
    execStub.onFirstCall().callsFake((cmd: string, callback: any) => {
      callback(null, '\n')
    })
    execStub.onSecondCall().callsFake((cmd: string, callback: any) => {
      callback(null, '')
    })

    await generateCommit()

    assert(mockWindow.showWarningMessage.calledWith('No files changed, stage your changes and try again'))
  })
})
