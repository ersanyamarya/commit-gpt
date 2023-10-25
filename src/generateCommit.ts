import * as cp from 'child_process'
import * as vscode from 'vscode'

export function generateCommit(): (...args: any[]) => any {
  return async () => {
    try {
      if (!vscode.workspace.workspaceFolders?.length) {
        return vscode.window.showWarningMessage('No workspace open')
      }

      if (!vscode.workspace.workspaceFolders?.[0].uri.fsPath) {
        return vscode.window.showWarningMessage('No workspace open')
      }

      const gitStatus = await execShell(`
cd ${vscode.workspace.workspaceFolders?.[0].uri.fsPath}
git status
`)
      if (gitStatus.includes('nothing to commit, working tree clean')) {
        return vscode.window.showWarningMessage('No changes to commit')
      }

      const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath

      const filesChanged = await execShell(`
cd ${workspaceRoot}
files=$(git diff --name-only --cached | grep -vE '\(jpg|jpeg|png|gif|svg|lock.hcl|lock|tfstate|backup|schema.graphql|schema.json|types|.flutter*|gql.*|package-lock\.json)$')
echo $files
`)

      if (filesChanged === `\n`) {
        return vscode.window.showWarningMessage('No files changed, stage your changes and try again')
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

      const prompt = `Act as a software developer, compose a concise commit message adhering to the standard format. Craft a brief title summarizing the changes and provide succinct bulleted messages in Markdown for the following modifications. Please keep the output as concise as possible.:
${changes}
Output Format:
Commit Title
## Changes Made:
[Summarize the changes made in this commit, including both features and bug fixes.]
## Features Added: [Only if there is relevant information]
[List any new features or enhancements introduced in this commit.]
## Bug Fixes: [Only if there is relevant information]
[Describe any bug fixes implemented in this commit.]
`
      await vscode.env.clipboard.writeText(prompt)
      // set prompt as commit message
      const gitExtension = vscode.extensions.getExtension('vscode.git')!.exports
      const inputBox = gitExtension.getAPI(1).repositories[0].inputBox
      inputBox.value = prompt

      //   inputBox.show()
    } catch (error: any) {
      vscode.window.showErrorMessage(error.message)
    }
  }
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
