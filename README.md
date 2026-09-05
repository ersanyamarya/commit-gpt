# Commit GPT - Visual Studio Code Extension

Commit GPT is a Visual Studio Code extension that generates commit messages using your GitHub Copilot chat model access, via VS Code's Language Model API. It helps developers create descriptive and meaningful commit messages based on the staged changes in their Git repository.

![Alt Text](/assets/images/usage-1.gif)

## Features

- **Commit Message Generation**: Automatically generates commit messages based on the staged changes in your Git repository.
- **Copilot Integration**: Uses VS Code's Language Model API to generate human-like and context-aware commit messages via your GitHub Copilot access — no separate API key needed.
- **Customizable**: Lets you choose which Copilot chat model family to use for generation.
- **Easy to Use**: Simple commands to generate commit messages and select a chat model directly within VS Code.

## Requirements

- Visual Studio Code (version 1.91.0 or higher)
- GitHub Copilot (installed and signed in) — Commit GPT generates messages via VS Code's Language Model API, using whichever Copilot chat model you have access to. No separate API key needed.

## Installation

1. Install Visual Studio Code on your system if you haven't already: [Download VS Code](https://code.visualstudio.com/download).
2. Launch VS Code.
3. Go to Extensions (or press `Ctrl+Shift+X`).
4. Search for "Commit GPT".
5. Click **Install** to install the extension.

## Usage

1. **(Optional) Choose a chat model**:

   - Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac).
   - Type `Commit GPT: Select Chat Model` and press Enter.
   - Pick which Copilot chat model family to use from the list. If you skip this step, Commit GPT uses whichever Copilot model is available.

2. **Generate Commit Message**:
   - Stage your changes in Git.
   - Open the Command Palette.
   - Type `Commit GPT: Generate Commit Message` and press Enter.
   - The generated commit message will be set in the commit message area of the Source Control tab.

## Configuration

- **`commit-gpt.model`**: The Copilot chat model family used to generate commit messages. Set this using the `commit-gpt.selectModel` command or directly in your VS Code settings.

## Known Issues

- No known issues.

## Release Notes

### Version 1.0.0

- Initial release of Commit GPT extension.

## Feedback and Contributing

- If you find any issues or have suggestions for improvement, please [report them](https://github.com/ersanyamarya/commit-gpt/issues).
- Contributions are always welcome! Fork the repository and submit a pull request.

## License

This extension is licensed under the [MIT License](LICENSE).

---

Feel free to replace placeholders such as `your-repo-url` with the appropriate links to your GitHub repository or issue tracker. Additionally, you can add more sections, such as "Acknowledgments," "Support," or "Author," to provide further information about your extension.
