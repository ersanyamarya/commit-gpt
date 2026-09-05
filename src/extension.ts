import * as vscode from 'vscode'
import { generateCommit } from './generateCommit'
import { selectModel } from './selectModel'

export function activate(context: vscode.ExtensionContext) {
  console.info('Congratulations, your extension "commit-gpt" is now active!')

  let disposableGenerateCommit = vscode.commands.registerCommand('commit-gpt.generateCommit', generateCommit)
  let disposableSelectModel = vscode.commands.registerCommand('commit-gpt.selectModel', selectModel)

  context.subscriptions.push(disposableGenerateCommit)
  context.subscriptions.push(disposableSelectModel)
}

export function deactivate() {
  console.log('----------------> deactivate <----------------')
}
