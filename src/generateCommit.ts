import * as cp from 'child_process'
import * as path from 'path'
import * as vscode from 'vscode'

// Minimal slice of the built-in vscode.git extension API that this extension uses.
interface GitRepository {
  rootUri: vscode.Uri
  inputBox: { value: string }
}

interface GitAPI {
  repositories: GitRepository[]
  getRepository(uri: vscode.Uri): GitRepository | null
}

// Lockfiles, binaries, and generated/schema files are left out of the diff sent to the model.
const EXCLUDED_EXTENSION = /\.(jpe?g|png|gif|svg|lock|tfstate|backup)$/i
const EXCLUDED_BASENAME = /^(package-lock\.json|schema\.graphql|schema\.json|types|gql\..*|\.flutter.*|.*\.lock\.hcl)$/i

// Leave headroom below the model's input limit for the response and message framing.
const INPUT_TOKEN_BUDGET_RATIO = 0.9

export function isExcludedFile(file: string) {
  return EXCLUDED_EXTENSION.test(file) || EXCLUDED_BASENAME.test(path.posix.basename(file))
}

export function stripCodeFences(text: string) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```[\w-]*\n([\s\S]*?)\n```$/)
  return (fenced ? fenced[1] : trimmed).trim()
}

export async function generateCommit(sourceControl?: { rootUri?: vscode.Uri }) {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Commit GPT',
      cancellable: true,
    },
    async (progress, token) => {
      progress.report({ increment: 0, message: 'Checking git status' })

      try {
        const repository = await resolveRepository(sourceControl)
        if (!repository) {
          return vscode.window.showWarningMessage('No git repository found in the workspace')
        }
        const cwd = repository.rootUri.fsPath

        progress.report({ increment: 10, message: 'Generating git diff' })
        const stagedFiles = (await execGit(['diff', '--cached', '--name-only', '-z'], cwd))
          .split('\0')
          .filter(file => file && !isExcludedFile(file))

        if (stagedFiles.length === 0) {
          progress.report({ increment: 100, message: 'No files changed' })
          vscode.window.showWarningMessage('No files changed, stage your changes and try again')
          return
        }

        const diff = await execGit(['diff', '--cached', '--', ...stagedFiles], cwd)

        const configuredFamily = vscode.workspace.getConfiguration().get<string>('commit-gpt.model')
        let models = configuredFamily
          ? await vscode.lm.selectChatModels({ vendor: 'copilot', family: configuredFamily })
          : []
        if (models.length === 0) {
          models = await vscode.lm.selectChatModels({ vendor: 'copilot' })
        }
        if (models.length === 0) {
          return vscode.window.showWarningMessage(
            'No Copilot chat models available. Make sure GitHub Copilot is installed and you are signed in.'
          )
        }
        const model = models[0]

        progress.report({ increment: 30, message: 'Generating prompt' })
        const { prompt, truncated } = await fitPromptToModel(model, diff, token)
        if (truncated) {
          vscode.window.showWarningMessage('Commit GPT: the staged diff was too large for the model and was truncated.')
        }

        progress.report({ increment: 50, message: 'Generating commit message' })
        const messages = [vscode.LanguageModelChatMessage.User(prompt)]
        try {
          const chatResponse = await model.sendRequest(messages, {}, token)
          let responseText = ''
          for await (const fragment of chatResponse.text) {
            responseText += fragment
          }
          repository.inputBox.value = stripCodeFences(responseText)
        } catch (err) {
          if (token.isCancellationRequested) {
            return
          }
          if (err instanceof vscode.LanguageModelError) {
            return vscode.window.showErrorMessage(`Commit GPT: ${err.message}`)
          }
          throw err
        }

        progress.report({ increment: 100, message: 'Commit message generated' })
      } catch (error: any) {
        vscode.window.showErrorMessage(error.message)
      }
    }
  )
}

// Prefer the repo whose SCM title button was clicked, then the repo of the active editor,
// then the repo of the first workspace folder, then whichever repo git reports first.
async function resolveRepository(sourceControl?: { rootUri?: vscode.Uri }) {
  const gitExtension = vscode.extensions.getExtension('vscode.git')
  if (!gitExtension) {
    return undefined
  }
  const git: GitAPI = (gitExtension.isActive ? gitExtension.exports : await gitExtension.activate()).getAPI(1)

  const candidates = [
    sourceControl?.rootUri,
    vscode.window.activeTextEditor?.document.uri,
    vscode.workspace.workspaceFolders?.[0]?.uri,
  ]
  for (const uri of candidates) {
    const repository = uri && git.getRepository(uri)
    if (repository) {
      return repository
    }
  }
  return git.repositories[0]
}

async function fitPromptToModel(model: vscode.LanguageModelChat, diff: string, token: vscode.CancellationToken) {
  const budget = Math.floor(model.maxInputTokens * INPUT_TOKEN_BUDGET_RATIO)
  let changes = diff
  let prompt = buildPrompt(changes)
  let tokens = await model.countTokens(prompt, token)
  let truncated = false

  // Token counts aren't linear in characters, so shrink proportionally and re-count a few times.
  for (let attempt = 0; tokens > budget && attempt < 5; attempt++) {
    truncated = true
    changes = changes.slice(0, Math.floor((changes.length * budget * 0.95) / tokens))
    prompt = buildPrompt(`${changes}\n[diff truncated]`)
    tokens = await model.countTokens(prompt, token)
  }
  return { prompt, truncated }
}

function buildPrompt(changes: string) {
  return `As a software developer, your task is to generate a concise, informative commit message using this format:

<type>(<scope>): <subject>

[optional body]

[optional footer]

Use the following input:

Here are the changes:
\`\`\`
${changes}
\`\`\`

Guidelines:
1. Type: Use one of these types (feat, fix, docs, style, refactor, test, chore).
2. Scope: Specify the part of the codebase affected (e.g., component name, file name).
3. Subject: Write a short, imperative-mood description of the change (e.g., "Add" not "Added").
4. Body: Provide more detailed explanatory text, if necessary. Wrap at 72 characters. Explain what and why, not how (the code shows that).
5. Footer: Only include this if genuinely applicable - reference real issue numbers or breaking changes. Omit it entirely otherwise; never fabricate an issue number.
6. Keep the entire first line (\`type(scope): subject\`) under 50 characters.
7. Don't end the subject line with a period.
8. Capitalize the subject line.
9. If breaking changes exist, start the footer with BREAKING CHANGE: followed by explanation.

Example:
feat(user-auth): Implement OAuth2 login

- Add OAuth2 client configuration
- Create login flow using Google provider
- Update user model to store OAuth tokens

Respond with only the commit message text - no preamble, no explanation, and no Markdown code fences.
`
}

const execGit = (args: string[], cwd: string) =>
  new Promise<string>((resolve, reject) => {
    cp.execFile('git', args, { cwd, maxBuffer: 64 * 1024 * 1024 }, (err, out) => {
      if (err) {
        return reject(err)
      }
      return resolve(out)
    })
  })
