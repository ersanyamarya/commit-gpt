# Change Log

All notable changes to the "commit-gpt" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Fixed

- Commit message goes to the repository whose Source Control button was clicked (or the active editor's repo) instead of always the first one
- Workspace paths and file names containing spaces no longer break the git diff
- Source files whose names contain words like `gql`, `lock` or `png` are no longer dropped from the diff

### Changed

- The prompt is no longer copied to the clipboard
- Generation can be cancelled from the progress notification
- Diffs larger than the model's input limit are truncated, with a warning
- The model sees unchanged context lines around each change
- Markdown code fences wrapping the model's reply are stripped
