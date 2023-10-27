# Commit GPT - Visual Studio Code Extension

Commit GPT is a Visual Studio Code extension that generates commit messages using OpenAI's GPT (Generative Pre-trained Transformer) technology. It helps developers create descriptive and meaningful commit messages based on the staged changes in their Git repository.

![Alt Text](/assets/images/usage-1.gif)

## Features

- **Commit Message Generation**: Automatically generates commit messages based on the staged changes in your Git repository.
- **OpenAI Integration**: Utilizes OpenAI's API to generate human-like and context-aware commit messages.
- **Customizable**: Allows users to set their OpenAI API key for personalized commit message generation.
- **Easy to Use**: Simple commands to generate commit messages and set the OpenAI API key directly within VS Code.

## Requirements

- Visual Studio Code (version 1.60.0 or higher)
- OpenAI API Key (Get your API key from [OpenAI](https://www.openai.com/))

## Installation

1. Install Visual Studio Code on your system if you haven't already: [Download VS Code](https://code.visualstudio.com/download).
2. Launch VS Code.
3. Go to Extensions (or press `Ctrl+Shift+X`).
4. Search for "Commit GPT".
5. Click **Install** to install the extension.
6. Set your OpenAI API key using the `commit-gpt.setOpenAIKey` command (see Usage section below).

## Usage

1. **Set OpenAI API Key**:
   - Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac).
   - Type `Commit GPT: Set OpenAI API Key` and press Enter.
   - Enter your OpenAI API key in the input box and press Enter to save it.

2. **Generate Commit Message**:
   - Stage your changes in Git.
   - Open the Command Palette.
   - Type `Commit GPT: Generate Commit Message` and press Enter.
   - The generated commit message will be set in the commit message area of the Source Control tab.

## Configuration

- **`commit-gpt.open-ai-key`**: Your OpenAI API key. You can set this using the `commit-gpt.setOpenAIKey` command or directly in your VS Code settings.

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