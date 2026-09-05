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
```

There's a single Mocha test file (`src/test/suite/extension.test.ts`); there's no per-test filtering wired up — `npm test` always runs the whole suite via `src/test/suite/index.ts` (globs `**/**.test.js` under `out/test`). To run/debug the extension interactively instead of via the test harness, open the project in VS Code and press F5 to launch an Extension Development Host.

`npm test` needs to download a real copy of VS Code the first time (or after `.vscode-test/` is deleted). If it ever fails with `spawn .../MacOS/Electron ENOENT`, that means `@vscode/test-electron` is older than the version that knows VS Code renamed its macOS binary from `Electron` to `Code` (VS Code 1.110+) — bump `@vscode/test-electron` rather than working around it with a manual symlink.

## Architecture

- `src/extension.ts` — activation entry point. Registers two commands: `commit-gpt.generateCommit` and `commit-gpt.selectModel`.
- `src/selectModel.ts` — `selectModel()` lists available Copilot chat models via `vscode.lm.selectChatModels({ vendor: 'copilot' })`, lets the user pick one via `showQuickPick`, and persists the chosen model's `family` to the `commit-gpt.model` global setting.
- `src/generateCommit.ts` — the whole feature lives in one function, `generateCommit()`:
  1. Shells out (`cp.exec` via the local `execShell` helper) to `git diff --name-only --cached` / `git diff --cached`, filtered through a `grep -vE` pattern that excludes lockfiles, binaries, and generated/schema files from the diff that gets sent to the model.
  2. Builds a fixed prompt template (conventional-commit style: `<type>(<scope>): <subject>`) embedding those changes.
  3. Copies the prompt to the clipboard, then resolves a chat model: tries the family configured via `commit-gpt.model` first, falls back to any available `copilot`-vendor model, and warns if none are available (Copilot not installed/signed in).
  4. Sends the prompt via `model.sendRequest(messages, {}, token)` and streams `chatResponse.text` into the active repo's SCM input box, obtained via `vscode.extensions.getExtension('vscode.git')!.exports.getAPI(1).repositories[0].inputBox`.
  - All of this runs inside a single `vscode.window.withProgress` callback so the user sees step-by-step progress notifications; the callback's cancellation token is passed through to `sendRequest`.
- Bundling: webpack (`webpack.config.js`) bundles `src/extension.ts` to `dist/extension.js` via `ts-loader`, targeting Node, with `vscode` externalized (provided by the VS Code host at runtime, not bundled).
- Linting: ESLint flat config (`eslint.config.js`) using `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` directly (no `typescript-eslint` meta-package). There's no `.eslintrc.*` — this project is on ESLint 9+, which requires flat config.
