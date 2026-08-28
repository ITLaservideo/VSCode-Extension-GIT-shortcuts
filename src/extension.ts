import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { ExtConfig, logError, loadOrCreateConfig, saveConfig } from './local_configuration';

function toBashPath(p: string): string {
    return p.replace(/\\/g, '/');
}

function findExecutableInPath(name: string): string | undefined {
    try {
        const cmd = process.platform === 'win32' ? `where ${name}` : `which ${name}`;
        const result = execSync(cmd, { encoding: 'utf8' }).trim();
        return result.split('\n')[0].trim();
    } catch (e) {
        console.error(e);
        return undefined;
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "gitextensionwrap" is now active!');

    // const helloDisposable = vscode.commands.registerCommand('gitextensionwrap.helloWorld', () => {
    //     vscode.window.showInformationMessage('GitShortcuts Extension Active!');
    // });

    vscode.commands.registerCommand('gitextensionwrap.openGitBash', async (uri: vscode.Uri) => {
        let targetPath: string;

        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            targetPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        } else if (uri) {
            try {
                const stat = fs.statSync(uri.fsPath);
                targetPath = stat.isDirectory() ? uri.fsPath : path.dirname(uri.fsPath);
            } catch (err) {
                vscode.window.showErrorMessage('Git Shortcuts: failed to read selected path.');
                return;
            }
        } else {
            vscode.window.showErrorMessage('No folder selected and no workspace open.');
            return;
        }

        try {
            const config = loadOrCreateConfig(targetPath);
            const gitExe = config['git-exe'];
            const bashExe = config['bash-exe'];

            // fs.writeFileSync(path.join(targetPath, `debug.log`), (JSON.stringify(await vscode.commands.getCommands())), 'utf8');
            const file_path_main_log = path.join(targetPath, `${config['main-branch-name']}`);
            const file_path_temp_log = path.join(targetPath, `${config['local-branch-name']}`);
            let the_vscode_diff: vscode.Tab | null = null;
            if (fs.existsSync(file_path_main_log) && fs.existsSync(file_path_temp_log)) {
                await vscode.commands.executeCommand('vscode.diff', vscode.Uri.file(file_path_main_log), vscode.Uri.file(file_path_temp_log), 'Main Log ↔ Local Log');
                the_vscode_diff = vscode.window.tabGroups.activeTabGroup.activeTab ?? null;
                // await vscode.commands.executeCommand('workbench.action.moveEditorToNewWindow');
            }
            let maybe_shellPath = fs.existsSync(bashExe) ? bashExe : gitExe;
            if (!fs.existsSync(maybe_shellPath)) {
                // 1. Try bash directly from PATH
                let detected_bash_exe = findExecutableInPath('bash');
                // 2. Derive bash from git's installation root (Git\cmd\git.exe → Git\bin\bash.exe)
                if (!detected_bash_exe || !fs.existsSync(detected_bash_exe)) {
                    const detected_git_exe = findExecutableInPath('git');
                    if (detected_git_exe) {
                        const gitRoot = path.dirname(path.dirname(detected_git_exe));
                        for (const candidate of ['bin\\bash.exe', 'usr\\bin\\bash.exe']) {
                            const p = path.join(gitRoot, candidate);
                            if (fs.existsSync(p)) { detected_bash_exe = p; break; }
                        }
                        config['git-exe'] = detected_git_exe;
                        saveConfig(targetPath, 'git-exe', detected_git_exe);
                    }
                }
                if (detected_bash_exe && fs.existsSync(detected_bash_exe)) {
                    maybe_shellPath = detected_bash_exe;
                    config['bash-exe'] = detected_bash_exe;
                    saveConfig(targetPath, 'bash-exe', detected_bash_exe);
                } else {
                    // 3. Ask user — must pick bash.exe from Git\bin
                    const picked = await vscode.window.showOpenDialog({
                        title: 'Git Shortcuts: Select bash.exe (inside Git\\bin)',
                        openLabel: 'Select bash.exe',
                        canSelectMany: false,
                        canSelectFolders: false,
                        filters: { 'bash.exe': ['exe'] },
                        defaultUri: vscode.Uri.file('C:\\Program Files\\Git\\bin'),
                    });
                    const newPath = picked?.[0]?.fsPath;
                    if (!newPath) {
                        vscode.window.showErrorMessage('Git Shortcuts: No executable selected. Aborting.');
                        return;
                    }
                    if (path.basename(newPath).toLowerCase() !== 'bash.exe') {
                        vscode.window.showErrorMessage(`Git Shortcuts: Expected bash.exe but got "${path.basename(newPath)}". Aborting.`);
                        return;
                    }
                    config['bash-exe'] = newPath;
                    saveConfig(targetPath, 'bash-exe', newPath);
                    maybe_shellPath = newPath;
                }
            }
            const shellPath = maybe_shellPath;
            // Open panel in main window first, then move it to a new window.
            const the_panel_shortcuts = vscode.window.createWebviewPanel(
                'gitShortcuts',
                'Git Shortcuts',
                vscode.ViewColumn.Nine,
                {
                    enableScripts: true,
                    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, '/src/ui_panel')],
                }
            );

            try {
                the_panel_shortcuts.webview.html = getWebviewContent(the_panel_shortcuts.webview, context.extensionUri, config, targetPath);
            } catch (err) {
                logError(targetPath, 'getWebviewContent', err);
                the_panel_shortcuts.webview.html = `<body style="color:red;font-family:sans-serif;padding:1em">
                    <b>Git Shortcuts failed to load.</b><br>
                    Check <code>.extension-always-learn/errors.log</code> for details.
                </body>`;
            }

            await vscode.commands.executeCommand('workbench.action.moveEditorGroupToNewWindow');

            // Give the new window time to open and become the active window.
            await new Promise<void>(resolve => setTimeout(resolve, 500));
            await vscode.commands.executeCommand('workbench.action.toggleWindowAlwaysOnTop');
            // Terminal is created in the now-active new window, beside the panel.
            const terminal = vscode.window.createTerminal({
                name: 'Git Bash',
                shellPath,
                cwd: targetPath,
                location: { viewColumn: vscode.ViewColumn.Beside },
            });
            terminal.show();
            // await vscode.commands.executeCommand('workbench.action.terminal.fontZoomReset');
            //await vscode.commands.executeCommand('workbench.action.terminal.fontZoomOut');
            // await new Promise<void>(resolve => setTimeout(resolve, 500));
            // for (let i = 0; i < 10; i++) {
            //     await vscode.commands.executeCommand("workbench.action.increaseViewWidth");
            // }

            // --- mutual close logic ---
            let disposed = false;
            let onTerminalClose: vscode.Disposable;
            let onFolderChange: vscode.Disposable;

            async function closeAll() {
                if (disposed) { return; }
                disposed = true;
                // await vscode.commands.executeCommand('workbench.action.terminal.fontZoomReset');
                terminal.dispose();
                the_panel_shortcuts.dispose();
                onTerminalClose.dispose();
                onFolderChange.dispose();
                if (the_vscode_diff) {
                    let tab_closed = false;
                    for (const group of vscode.window.tabGroups.all) {
                        if (tab_closed) { break; }
                        for (const tab of group.tabs) {
                            if (tab.input instanceof vscode.TabInputTextDiff) {
                                const input = tab.input as vscode.TabInputTextDiff;
                                if (input.original.fsPath === file_path_main_log || input.modified.fsPath === file_path_temp_log) {
                                    if (await vscode.window.tabGroups.close(tab)) {
                                        tab_closed = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            the_panel_shortcuts.onDidDispose(closeAll);

            onTerminalClose = vscode.window.onDidCloseTerminal(t => {
                if (t === terminal) { closeAll(); }
            });

            onFolderChange = vscode.workspace.onDidChangeWorkspaceFolders(() => {
                if (!vscode.workspace.workspaceFolders?.length) { closeAll(); }
            });

            context.subscriptions.push({ dispose: closeAll });
            // --------------------------

            the_panel_shortcuts.webview.onDidReceiveMessage(async (message: { command: string; branchName?: string; key?: string; value?: string }) => {
                try {
                    const b = (message.branchName ?? '').trim();

                    if (message.command === 'saveConfig' && message.key) {
                        saveConfig(targetPath, message.key as keyof ExtConfig, message.value ?? '');
                        return;
                    }

                    if (message.command === 'branchDelete') {
                        const answer = await vscode.window.showWarningMessage(
                            `Delete branch "${b}"? This cannot be undone.`,
                            { modal: true },
                            'Delete'
                        );
                        if (answer !== 'Delete') { return; }
                        terminal.show();
                        terminal.sendText(`git branch -D ${b}_backup`, true);
                        terminal.sendText(`git branch -m ${b} ${b}_backup`, true);
                        terminal.sendText(`git checkout ${config['main-branch-name'] ?? 'main'}`, true);
                        terminal.sendText(`git branch`, true);
                        return;
                    }

                    if (message.command === 'branchDeleteForReal') {
                        const answer = await vscode.window.showWarningMessage(
                            `Delete branch "${b}"? No backup will be made.`,
                            { modal: true },
                            'Delete'
                        );
                        if (answer !== 'Delete') { return; }
                        terminal.show();
                        terminal.sendText(`git branch -D ${b}`, true);
                        return;
                    }

                    const defs: Record<string, { text: string; run: boolean }> = {
                        status: { text: 'git status', run: true },
                        log: { text: 'git log > main', run: true },
                        branch: { text: 'git branch', run: true },
                        addPng: { text: 'git add *.png', run: true },
                        addSvg: { text: 'git add *.svg', run: true },
                        addJpeg: { text: 'git add *.jpeg', run: true },
                        addWoff2: { text: 'git add *.woff2', run: true },
                        addXaml: { text: 'git add *.xaml', run: true },
                        addCss: { text: 'git add *.css', run: true },
                        addMin: { text: 'git add *.min.*', run: true },
                        resetSoft: { text: 'git reset --soft HEAD^', run: true },
                        resetHardCommit: { text: 'git reset --hard ', run: false },
                        rebaseInteractive: { text: 'git rebase -i HEAD~', run: false },
                        resetHard: { text: 'git reset --hard origin/main', run: false },
                        resetHardPush: { text: 'git push origin main --force', run: false },
                        cherryPick: { text: `git cherry-pick `, run: false },
                        pull: { text: 'git pull', run: true },
                        push: { text: 'git push', run: true },
                        submoduleAdd: { text: 'git submodule add ', run: false },
                        cdSubmodule: { text: '', run: false },
                        submodulePull: { text: `git submodule foreach 'git pull'`, run: true },
                        submodulePush: { text: `git submodule foreach 'git push'`, run: true },
                        cdWorkspace: { text: `cd "${toBashPath(targetPath)}"`, run: true },
                        checkoutNew: { text: `git checkout -b ${b}`, run: true },
                        checkout: { text: `git checkout ${b}`, run: true },
                        logToFile: { text: `git log > ${b}`, run: true },
                        mainLogToFile: { text: `git log > ${b}`, run: true },
                        mainCheckout: { text: `git checkout ${b}`, run: true },
                    };
                    const def = defs[message.command];
                    if (def) {
                        terminal.show();
                        switch (message.command) {
                            case "branchDelete":
                                vscode.window.showErrorMessage('Invalid branchDelete command.');
                                break;
                            case "cherryPick":
                                terminal.sendText(def.text, false);
                                let from_lipboard = '';
                                try {
                                    from_lipboard = `${(await vscode.env.clipboard.readText()) ?? ''}`.trim().match(/[0-9a-f]{7,40}/)?.at(0) ?? '';
                                } catch (error) { }
                                let commit_id = (await vscode.window.showInputBox({
                                    title: 'Git Shortcuts: Cherry-Pick Commit',
                                    prompt: 'Enter the commit ID to cherry-pick:',
                                    value: from_lipboard,
                                    ignoreFocusOut: true,
                                }) ?? '').trim();
                                if (commit_id.length === 0) { return; }
                                if (commit_id.length > 40) {
                                    commit_id = commit_id.substring(commit_id.length - 40);
                                }
                                if (/*not a valid commit ID */ !/^[0-9a-f]{7,40}$/i.test(commit_id)) {
                                    vscode.window.showErrorMessage('Invalid commit ID.');
                                    return;
                                }
                                terminal.sendText(`${commit_id}`, def.run);
                                break;
                            case 'resetHardCommit': {
                                let rhc_clipboard = '';
                                try {
                                    rhc_clipboard = `${(await vscode.env.clipboard.readText()) ?? ''}`.trim().match(/[0-9a-f]{7,40}/)?.at(0) ?? '';
                                } catch (_) { }
                                let rhc_commit_id = (await vscode.window.showInputBox({
                                    title: 'Git Shortcuts: Hard Reset to Commit',
                                    prompt: 'Enter the commit ID to reset to:',
                                    value: rhc_clipboard,
                                    ignoreFocusOut: true,
                                }) ?? '').trim();
                                if (rhc_commit_id.length === 0) { return; }
                                if (rhc_commit_id.length > 40) {
                                    rhc_commit_id = rhc_commit_id.substring(rhc_commit_id.length - 40);
                                }
                                if (!/^[0-9a-f]{7,40}$/i.test(rhc_commit_id)) {
                                    vscode.window.showErrorMessage('Invalid commit ID.');
                                    return;
                                }
                                terminal.sendText(`${def.text}${rhc_commit_id}`, def.run);
                                break;
                            }
                            case 'resetHardPush':
                                const branch_name_rhp = (await vscode.window.showInputBox({
                                    title: 'Git Shortcuts: Hard Push',
                                    prompt: 'Enter branch name:',
                                    value: config['main-branch-name'] ?? 'main',
                                    ignoreFocusOut: true,
                                }) ?? '').trim();
                                terminal.sendText(def.text.replace("main", branch_name_rhp), def.run);
                                break;
                            case 'resetHard':
                                const branch_name_rh = (await vscode.window.showInputBox({
                                    title: 'Git Shortcuts: Hard Push',
                                    prompt: 'Enter branch name:',
                                    value: config['main-branch-name'] ?? 'main',
                                    ignoreFocusOut: true,
                                }) ?? '').trim();
                                terminal.sendText(def.text.replace("main", branch_name_rh), def.run);
                                break;
                            case 'cdSubmodule': {
                                let submodulePaths: string[] = [];
                                try {
                                    const gitmodulesContent = fs.readFileSync(path.join(targetPath, '.gitmodules'), 'utf8');
                                    submodulePaths = [...gitmodulesContent.matchAll(/^\s*path\s*=\s*(.+)$/gm)].map(m => m[1].trim());
                                } catch (err) {
                                    logError(targetPath, 'cdSubmodule', err);
                                }
                                if (submodulePaths.length === 0) {
                                    vscode.window.showErrorMessage('Git Shortcuts: No submodules found in .gitmodules.');
                                    return;
                                }
                                let chosenSubPath = submodulePaths[0];
                                if (submodulePaths.length > 1) {
                                    const picked = await vscode.window.showQuickPick(submodulePaths, {
                                        title: 'Git Shortcuts: Select Submodule',
                                        placeHolder: 'Choose a submodule to cd into',
                                        ignoreFocusOut: true,
                                    });
                                    if (!picked) { return; }
                                    chosenSubPath = picked;
                                }
                                terminal.sendText(`cd "${toBashPath(path.join(targetPath, chosenSubPath))}"`, true);
                                break;
                            }
                            case 'submoduleAdd': {
                                const repoUrl = (await vscode.window.showInputBox({
                                    title: 'Git Shortcuts: Add Submodule',
                                    prompt: 'Enter the repository URL:',
                                    ignoreFocusOut: true,
                                }) ?? '').trim();
                                if (!repoUrl) { return; }
                                const subPath = (await vscode.window.showInputBox({
                                    title: 'Git Shortcuts: Add Submodule',
                                    prompt: 'Enter the local path/FolderName for the submodule:',
                                    ignoreFocusOut: true,
                                }) ?? '').trim();
                                if (!subPath) { return; }
                                terminal.sendText(`git submodule add ${repoUrl} ${subPath}`, true);
                                break;
                            }
                            default:
                                terminal.sendText(def.text, def.run);
                                break;

                        }
                    }
                } catch (err) {
                    logError(targetPath, `webview message: ${message.command}`, err);
                }
            });

        } catch (err) {
            logError(targetPath, 'openGitBash', err);
            vscode.window.showErrorMessage(`Git Shortcuts error — see .extension-always-learn/errors.log`);
        }
    });

    // context.subscriptions.push(helloDisposable, gitBashDisposable);
}


// ── webview HTML ──────────────────────────────────────────────────────────────

function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < 32; i++) { text += chars.charAt(Math.floor(Math.random() * chars.length)); }
    return text;
}

function loadAllLocaleData(extensionUri: vscode.Uri): Record<string, Record<string, string>> {
    const result: Record<string, Record<string, string>> = {};
    for (const lang of ['en', 'it', 'de']) {
        try {
            const src = fs.readFileSync(
                path.join(extensionUri.fsPath, 'src', 'ui_panel', 'locale', 'data', `${lang}.js`), 'utf8'
            );
            result[lang] = JSON.parse(src.replace(/^export\s+const\s+data\s*=\s*/, '').replace(/;\s*$/, '').trim());
        } catch {
            result[lang] = {};
        }
    }
    return result;
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, config: ExtConfig, workspacePath: string): string {
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, '/src/ui_panel', 'panel.css'));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, '/src/ui_panel', 'panel.js'));
    const localeUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, '/src/ui_panel', 'locale', 'locale.js'));
    const htmlPath = path.join(extensionUri.fsPath, '/src/ui_panel', 'panel.html');

    const nonce = getNonce();
    const language = config['language'] ?? 'en';
    const localesJson = JSON.stringify(loadAllLocaleData(extensionUri))
        .replace(/<\/script>/gi, '<\\/script>');
    const localeDataScript = `<script nonce="${nonce}">window.__LOCALES__=${localesJson};window.__LOCALE_LANG__='${language}';</script>`;
    const extensionVersion = JSON.parse(fs.readFileSync(path.join(extensionUri.fsPath, 'package.json'), 'utf8')).version ?? 'unknown';
    const extensionVersionScript = `<script nonce="${nonce}">window.__EXTENSION_VERSION__='${extensionVersion.replace(/'/g, "\\'")}';</script>`;

    const tokens: Record<string, string> = {
        '{{cssUri}}': cssUri.toString(),
        '{{jsUri}}': jsUri.toString(),
        '{{localeUri}}': localeUri.toString(),
        '{{cspSource}}': webview.cspSource,
        '{{nonce}}': nonce,
        '{{mainBranchName}}': config['main-branch-name'],
        '{{localBranchName}}': config['local-branch-name'],
        '{{localeDataScript}}': localeDataScript,
        '{{extensionVersionScript}}': extensionVersionScript,
        '{{submoduleForeachHidden}}': fs.existsSync(path.join(workspacePath, '.gitmodules')) ? '' : 'hidden',
    };

    return fs.readFileSync(htmlPath, 'utf8')
        .replace(/\{\{[^}]+\}\}/g, (match) => tokens[match] ?? match);
}

export function deactivate() { }
