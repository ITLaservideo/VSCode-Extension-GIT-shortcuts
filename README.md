# install
```bash
npm install -g @vscode/vsce # install `vsce`
npm install # download `node_modules`
npm install typescript -g # install `tsc`
code.cmd --version # verify using the vscode CLI
```
```bash
  vsce package -o packaged.vsix # Generates a .vsix fileecho %CD%
  code.cmd --install-extension packaged.vsix
```
# Git Extension Wrap

Right-click a folder → **Open Git Bash** — opens a dedicated window with a Git Bash terminal and a shortcuts panel side-by-side.

## Features

- One-click commands
- Branch names persisted per-workspace; terminal and panel close together

## Configuration

`.git-extension-wrap/configuration.json` is created on first use:

```json
{
    "main-branch-name": "main",
    "local-branch-name": "temporary-branch",
    "git-exe": "C:\\Program Files\\Git\\cmd\\git.exe",
    "bash-exe": "C:\\Program Files\\Git\\bin\\bash.exe"
}
```

`bash-exe` is preferred; falls back to `git-exe` if not found.

## Requirements

Git for Windows. Adjust `git-exe` / `bash-exe` for portable or custom installs.

## Known Issues

- Closing the main VS Code window does not close the detached window.
- you can avoid prompt and go on with your bash commands, on confirm it writes the value inserted