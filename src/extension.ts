import * as vscode from 'vscode'
import { generateCommit } from './generateCommit'

export function activate(context: vscode.ExtensionContext) {
  console.info('Congratulations, your extension "commit-gpt" is now active!')

  const openAIKey = vscode.workspace.getConfiguration().get('commit-gpt.open-ai-key')

  let disposableGenerateCommit = vscode.commands.registerCommand('commit-gpt.generateCommit', generateCommit())

  let disposableSetOpenAIKey = vscode.commands.registerCommand('commit-gpt.setOpenAIKey', async () => {
    const key = await vscode.window.showInputBox({
      prompt: 'Enter your OpenAI API key',
      value: openAIKey?.toString(),
      placeHolder: 'Enter your OpenAI API key',
    })
    if (key) {
      await vscode.workspace.getConfiguration().update('commit-gpt.open-ai-key', key, vscode.ConfigurationTarget.Global)
    }
  })

  context.subscriptions.push(disposableGenerateCommit)
  context.subscriptions.push(disposableSetOpenAIKey)
}

export function deactivate() {
  console.log('----------------> deactivate <----------------')
}
