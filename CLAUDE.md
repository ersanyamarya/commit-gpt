# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Commit GPT is a VS Code extension that generates a commit message from staged git changes using VS Code's Language Model API (`vscode.lm`), routed through whichever GitHub Copilot chat model the user has access to, then writes the result into the Source Control input box. No separate API key is needed — access is via the user's own Copilot entitlement.

## Commands

```bash
npm install              # install deps
npm run compile          # dev build (webpack, unminified, to dist/extension.js)
npm run watch            # webpack --watch, for use alongside F5 debugging
npm run package          # production build (minified, hidden source maps) - run before publishing
npm run lint             # eslint src/**/*.ts (flat config in eslint.config.js)
npm run format           # prettier --write across the repo
npm run compile-tests    # tsc -p . --outDir out (compiles src/test/** for Mocha)
npm test                 # pretest (compile-tests + compile + lint) then downloads VS Code and runs the Mocha suite
npm run vsce:package      # build a .vsix locally (no publish)
npm run vsce:install-local # build a .vsix and install it into your own VS Code
npm run vsce:login        # one-time: store a Marketplace PAT for publisher ersanyamarya
npm run release:patch     # test, bump version (commit + tag), publish to the Marketplace, push; also release:minor / release:major
```

The Mocha tests live in `src/test/generateCommit.test.ts` (sinon-stubbed `vscode` + `child_process.execFile`) and `src/test/suite/extension.test.ts`; there's no per-test filtering wired up — `npm test` always runs the whole suite via `src/test/suite/index.ts` (globs `**/**.test.js` under `out/test`). To run/debug the extension interactively instead of via the test harness, open the project in VS Code and press F5 to launch an Extension Development Host.

`npm test` needs to download a real copy of VS Code the first time (or after `.vscode-test/` is deleted). If it ever fails with `spawn .../MacOS/Electron ENOENT`, that means `@vscode/test-electron` is older than the version that knows VS Code renamed its macOS binary from `Electron` to `Code` (VS Code 1.110+) — bump `@vscode/test-electron` rather than working around it with a manual symlink.

## Architecture

- `src/extension.ts` — activation entry point. Registers two commands: `commit-gpt.generateCommit` and `commit-gpt.selectModel`.
- `src/selectModel.ts` — `selectModel()` lists available Copilot chat models via `vscode.lm.selectChatModels({ vendor: 'copilot' })`, lets the user pick one via `showQuickPick`, and persists the chosen model's `family` to the `commit-gpt.model` global setting.
- `src/generateCommit.ts` — the feature entry point is `generateCommit(sourceControl?)` (the SCM title button passes the clicked `SourceControl`; the command palette passes nothing):
  1. `resolveRepository()` picks the target repo from the `vscode.git` API (`getAPI(1)`, activating the extension if needed): the clicked repo, else the active editor's repo, else the first workspace folder's repo, else `repositories[0]`.
  2. Runs git via `cp.execFile` (the `execGit` helper, `cwd` = repo root, no shell): `git diff --cached --name-only -z`, drops files matching `isExcludedFile()` (lockfiles, images, generated/schema files), then `git diff --cached -- <files>` with normal context lines.
  3. Resolves a chat model: tries the family configured via `commit-gpt.model` first, falls back to any available `copilot`-vendor model, and warns if none are available (Copilot not installed/signed in).
  4. `fitPromptToModel()` embeds the diff in the fixed conventional-commit prompt (`buildPrompt`) and, using `model.countTokens`/`maxInputTokens`, truncates the diff to fit 90% of the input limit (warning the user when it does).
  5. Sends the prompt via `model.sendRequest(messages, {}, token)`, collects `chatResponse.text`, strips any wrapping Markdown fence (`stripCodeFences`), and writes it to that repo's SCM `inputBox`.
  - All of this runs inside a cancellable `vscode.window.withProgress` callback (whose promise `generateCommit` returns); the cancellation token is passed through to `countTokens`/`sendRequest`.
- Bundling: webpack (`webpack.config.js`) bundles `src/extension.ts` to `dist/extension.js` via `ts-loader`, targeting Node, with `vscode` externalized (provided by the VS Code host at runtime, not bundled).
- Linting: ESLint flat config (`eslint.config.js`) using `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` directly (no `typescript-eslint` meta-package). There's no `.eslintrc.*` — this project is on ESLint 9+, which requires flat config.
