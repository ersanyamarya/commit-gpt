import * as cp from 'child_process'
import OpenAI from 'openai'
import * as vscode from 'vscode'
export async function generateCommit() {
  const openAIKey = vscode.workspace.getConfiguration().get('commit-gpt.open-ai-key')
  if (!openAIKey || openAIKey === '') {
    return vscode.window.showWarningMessage('Please set your OpenAI API key', 'Set Key').then(value => {
      if (value === 'Set Key') {
        vscode.commands.executeCommand('commit-gpt.setOpenAIKey')
      }
    })
  }
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
        if (!vscode.workspace.workspaceFolders?.length) {
          return vscode.window.showWarningMessage('No workspace open')
        }

        if (!vscode.workspace.workspaceFolders?.[0].uri.fsPath) {
          return vscode.window.showWarningMessage('No workspace open')
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath
        progress.report({ increment: 10, message: 'Generating git diff' })
        const filesChanged = await execShell(`
cd ${workspaceRoot}
files=$(git diff --name-only --cached | grep -vE '\(jpg|jpeg|png|gif|svg|lock.hcl|lock|tfstate|backup|schema.graphql|schema.json|types|.flutter*|gql.*|package-lock\.json)$')
echo $files
`)

        if (filesChanged === `\n`) {
          progress.report({ increment: 100, message: 'No files changed' })
          vscode.window.showWarningMessage('No files changed, stage your changes and try again')
          return
        }

        const changes = await execShell(`
cd ${workspaceRoot}
files=$(git diff --name-only --cached | grep -vE '\(jpg|jpeg|png|gif|svg|lock.hcl|lock|tfstate|backup|schema.graphql|schema.json|types|.flutter*|gql.*|package-lock\.json)$')
return=""
for file in $files; do
changes=$(git diff --cached $file | grep '^[+-]' | grep -v '^[+-]\{3\}')
return="$return- $file:\n$changes"
done
echo $return
	  `)
        progress.report({ increment: 30, message: 'Generating prompt' })
        const prompt = `As a software developer, your task is to create a clear and informative commit message that follows the standard format. Your message should include a concise title summarizing the changes, followed by detailed bullet points in Markdown format. Please ensure the output is as clear and concise as possible.

Output Format:
- <Commit Title>: [Provide a brief and clear summary of the changes made] [This is required every time]
  
## Features Added: [Include this section only if applicable]
- [List any new features or enhancements introduced in this commit.]

## Bug Fixes: [Include this section only if applicable]
- [Describe any bug fixes implemented in this commit.]

NOTE: Ensure that each section is included only if there is relevant information to provide.


Here are the changes: 
\`\`\`
${changes}
\`\`\`
`

        await vscode.env.clipboard.writeText(prompt)
        const gitExtension = vscode.extensions.getExtension('vscode.git')!.exports
        const inputBox = gitExtension.getAPI(1).repositories[0].inputBox
        // inputBox.value = prompt
        progress.report({ increment: 50, message: 'Generating commit message' })
        const openai = new OpenAI({
          apiKey: openAIKey.toString(),
        })
        const gptResponse = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.5,
          top_p: 1,
          max_tokens: 1024,
        })

        inputBox.value = gptResponse.choices[0].message.content

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
