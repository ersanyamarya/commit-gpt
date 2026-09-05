import * as cp from 'child_process'
import * as vscode from 'vscode'
export async function generateCommit() {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Commit GPT',
      cancellable: false,
    },
    async (progress, token) => {
      token.onCancellationRequested(() => {
        console.log('User canceled the long running operation')
      })
      progress.report({ increment: 0, message: 'Checking git status' })

      try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath

        if (!workspaceRoot) {
          return vscode.window.showWarningMessage('No workspace open')
        }

        progress.report({ increment: 10, message: 'Generating git diff' })
        const filesChanged = await execShell(`
cd ${workspaceRoot}
files=$(git diff --name-only --cached | grep -vE '(jpg|jpeg|png|gif|svg|lock\.hcl|lock|tfstate|backup|schema\.graphql|schema\.json|types|\.flutter*|gql.*|package-lock\.json)$')
echo $files
`)

        if (filesChanged === `\n`) {
          progress.report({ increment: 100, message: 'No files changed' })
          vscode.window.showWarningMessage('No files changed, stage your changes and try again')
          return
        }

        const changes = await execShell(`
cd ${workspaceRoot}
files=$(git diff --name-only --cached | grep -vE '(jpg|jpeg|png|gif|svg|lock\.hcl|lock|tfstate|backup|schema\.graphql|schema\.json|types|\.flutter*|gql.*|package-lock\.json)$')
return=""
for file in $files; do
changes=$(git diff --cached "$file" | grep '^[+-]' | grep -v '^[+-]\{3\}')
return="$return
- $file:
$changes"
done
echo "$return"
`)
        progress.report({ increment: 30, message: 'Generating prompt' })
        const prompt = `As a software developer, your task is to generate a concise, informative commit message using this format:

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

        await vscode.env.clipboard.writeText(prompt)
        const gitExtension = vscode.extensions.getExtension('vscode.git')!.exports
        const inputBox = gitExtension.getAPI(1).repositories[0].inputBox
        // inputBox.value = prompt
        progress.report({ increment: 50, message: 'Generating commit message' })

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

        const messages = [vscode.LanguageModelChatMessage.User(prompt)]
        try {
          const chatResponse = await models[0].sendRequest(messages, {}, token)
          let responseText = ''
          for await (const fragment of chatResponse.text) {
            responseText += fragment
          }
          inputBox.value = responseText
        } catch (err) {
          if (err instanceof vscode.LanguageModelError) {
            return vscode.window.showErrorMessage(`Commit GPT: ${err.message}`)
          }
          throw err
        }

        progress.report({ increment: 100, message: 'Commit message generated' })
        return
        //   inputBox.show()
      } catch (error: any) {
        vscode.window.showErrorMessage(error.message)
      }
    }
  )
}
const execShell = (cmd: string) =>
  new Promise<string>((resolve, reject) => {
    cp.exec(cmd, (err, out) => {
      if (err) {
        return reject(err)
      }
      return resolve(out)
    })
  })
