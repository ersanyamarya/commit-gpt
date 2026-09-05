---
name: record-window-gif
description: Records the user's active macOS window for a specified duration and converts it to a GIF. Use this when the user wants to record a screen, capture an operation, or make a GIF of a terminal/browser/app.
---

# Record Window to GIF

This skill uses a bundled bash script to capture the currently active macOS window and output a GIF.

## Instructions for Claude

1. **Identify Parameters:** Determine the desired recording duration in seconds (default: 5) and the output filename (default: `output.gif`).
2. **Execute the Script:** Run `.claude/skills/record-window-gif/scripts/record-window.sh <duration> <filename>` from within this skill's directory.
3. **Handle Missing Tools:** The script checks for `ffmpeg` and `gifski`. If it exits with an error indicating these are missing, ask the user for permission to run `brew install ffmpeg gifski`. Once installed, automatically retry the script.
4. **Handle OS Permissions:** If the script fails because it cannot fetch window coordinates or fails to record, inform the user that they must grant **Accessibility** and **Screen Recording** permissions to their Terminal in macOS System Settings.
