import * as vscode from 'vscode'

export async function selectModel() {
  const models = await vscode.lm.selectChatModels({ vendor: 'copilot' })
  if (models.length === 0) {
    return vscode.window.showWarningMessage(
      'No Copilot chat models available. Make sure GitHub Copilot is installed and you are signed in.'
    )
  }

  const picked = await vscode.window.showQuickPick(
    models.map(model => ({ label: model.name, description: model.family, model })),
    { placeHolder: 'Select the Copilot chat model to use for commit messages' }
  )
  if (!picked) {
    return
  }

  await vscode.workspace.getConfiguration().update('commit-gpt.model', picked.model.family, vscode.ConfigurationTarget.Global)
  vscode.window.showInformationMessage(`Commit GPT will now use "${picked.label}" to generate commit messages.`)
}
