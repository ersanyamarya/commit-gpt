// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as cp from 'child_process'
import * as vscode from 'vscode'
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.info('Congratulations, your extension "commit-gpt" is now active!')

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand('commit-gpt.generateCommit', async () => {
    // The code you place here will be executed every time your command is executed
    // Display a message box to the user
    console.log('----------------> generateCommit <----------------')
    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath
      //  run the git diff command and get the output

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

      vscode.window.showInformationMessage('Commit message copied to clipboard')
    } catch (error: any) {
      vscode.window.showErrorMessage(error.message)
    }
  })

  context.subscriptions.push(disposable)
}

// This method is called when your extension is deactivated
export function deactivate() {
  console.log('----------------> deactivate <----------------')
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
