const js_running = document.createElement("div");
js_running.className = "js-running-check-ok";
const extensionVersion = window.__EXTENSION_VERSION__ ?? 'unknown';
js_running.innerText = `js v${extensionVersion} ✓`;
document.body.appendChild(js_running);

const vscode = acquireVsCodeApi();

Locale.applyAll();

let chosenButton = document.getElementById("workspace-cd-btn");
function markChosen(button) {
    if (chosenButton) {
        chosenButton.classList.remove('the-chosen-one');
    }
    chosenButton = button;
    button.classList.add('the-chosen-one');
}

const buttonCommands = {
    'status-btn': 'status',
    'log-btn': 'log',
    'branch-btn': 'branch',
    'add-png-btn': 'addPng',
    'add-svg-btn': 'addSvg',
    'add-jpeg-btn': 'addJpeg',
    'add-woff2-btn': 'addWoff2',
    'add-xaml-btn': 'addXaml',
    'add-css-btn': 'addCss',
    'rebase-interactive-btn': 'rebaseInteractive',
    'reset-hard-btn': 'resetHard',
    'reset-soft-btn': 'resetSoft',
    'reset-hard-commit-btn': 'resetHardCommit',
    'pull-btn': 'pull',
    'push-btn': 'push',
    'submodule-add-btn': 'submoduleAdd',
    'submodule-cd-btn': 'cdSubmodule',
    'submodule-pull-btn': 'submodulePull',
    'submodule-push-btn': 'submodulePush',
    'workspace-cd-btn': 'cdWorkspace',
    'reset-hard-push-btn': 'resetHardPush',
    'cherry-pick-btn': 'cherryPick',
};

for (const [id, command] of Object.entries(buttonCommands)) {
    const button = document.getElementById(id);
    if (button) {
        button.addEventListener('click', () => {
            if ((button.id ?? '').endsWith("-cd-btn")) {
                markChosen(button);
            }
            vscode.postMessage({ command });
        });
    }
}

const branchCommands = {
    'branch-delete-btn': 'branchDelete',
    'branch-delete-fr-btn': 'branchDeleteForReal',
    'checkout-new-btn': 'checkoutNew',
    'checkout-btn': 'checkout',
    'log-to-file-btn': 'logToFile',
};

function setupSaveButton(btnId, inputId, configKey) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) { return; }

    let savedValue = input.value;
    btn.classList.add('btn-save-hidden');

    input.addEventListener('keyup', () => {
        btn.classList.toggle('btn-save-hidden', input.value.trim() === savedValue);
    });

    btn.addEventListener('click', () => {
        const value = input.value;
        vscode.postMessage({ command: 'saveConfig', key: configKey, value });
        savedValue = value;
        btn.classList.add('btn-save-hidden');
        btn.classList.add('saved');
        setTimeout(() => btn.classList.remove('saved'), 1500);
    });
}

setupSaveButton('save-main-branch-btn', 'main-branch-name', 'main-branch-name');
setupSaveButton('save-branch-btn', 'branch-name', 'local-branch-name');

const mainBranchCommands = {
    'main-log-to-file-btn': 'mainLogToFile',
    'main-checkout-btn': 'mainCheckout',
};

for (const [id, command] of Object.entries(mainBranchCommands)) {
    const button = document.getElementById(id);
    if (button) {
        button.addEventListener('click', () => {
            markChosen(button);
            const branchName = document.getElementById('main-branch-name').value;
            vscode.postMessage({ command, branchName });
        });
    }
}
for (const [id, command] of Object.entries(branchCommands)) {
    const button = document.getElementById(id);
    if (button) {
        button.addEventListener('click', () => {
            markChosen(button);
            const branchName = document.getElementById('branch-name').value;

            vscode.postMessage({ command, branchName });
        });
    }
}
class MockUiBuilder {
    /**
     * Builds a custom dropdown selector (not a native `<select>`): a clickable "selected" label
     * that toggles a floating options list, closing on an outside click. There is no destroy
     * hook - the outside-click listener self-unregisters once `container` is no longer attached
     * to the document, so it doesn't keep the closure (and subtree) alive forever.
     *
     * @param {Object} options
     * @param {string[]} options.titles - Option labels, in display order; index lines up with `next` and `onSelectionChange`.
     * @param {Array<Function>} [options.next] - Per-option click callback: `next[index]()`, called right after the displayed label updates and before `onSelectionChange`.
     * @param {Function} [options.onSelectionChange] - Called with the selected option's index, after `next[index]` (if any) has run.
     * @param {string} [options.label] - Prefix shown before the current title, both on initial render (paired with `titles[0]`) and after each pick.
     * @param {'top'|'bottom'} [options.direction_open='top'] - Which side the options list opens toward; also drives the `dd-visible-{direction_open}` class toggled on open/close.
     * @param {boolean} [options.stealth=true] - When false, adds `cddown-selected-not-stealth` for a more visible resting style on the selected label.
     * @param {string} [options.max_selections_height='210px'] - CSS `max-height` for the options list before it scrolls.
     * @param {string} [options.icon_code] - `Icons.create()` codepoint for an optional leading icon.
     * @returns {HTMLElement} The dropdown container.
     */
    static createDropDownButtonSelector({ titles, next, onSelectionChange, label, direction_open = 'top', stealth = true, max_selections_height = '210px', icon_code = undefined }) {
        const container = document.createElement("div");
        container.className = "custom-dropdown-container";

        if (icon_code) {
            const leftIcon = Icons.create(icon_code);
            leftIcon.classList.add("cdc-icon-left");
            container.classList.add("has-left-icon");
            container.appendChild(leftIcon);
        }

        const arrow_down = Icons.create('e313');
        arrow_down.classList.add("cdc-arrow-open");
        container.appendChild(arrow_down);

        // if (label) {
        //     const lb = document.createElement("label");
        //     lb.textContent = label;
        //     lb.className = "custom-dropdown-label";
        //     container.appendChild(lb);
        // }

        const dropdown = document.createElement("div");
        dropdown.className = "custom-dropdown";

        const selected = document.createElement("div");
        selected.className = "custom-dropdown-selected";
        const tmp_first = `${label ?? ''} ${titles[0]}`.trim();
        selected.textContent = `${tmp_first}`;
        if (!stealth) {
            selected.classList.add("cddown-selected-not-stealth");
        }

        const optionsList = document.createElement("div");
        optionsList.className = "custom-dropdown-options hidden";
        optionsList.style.maxHeight = max_selections_height;
        optionsList.classList.add(direction_open);
        titles.forEach((title, index) => {
            const option = document.createElement("div");
            option.className = "custom-dropdown-option";
            option.textContent = title;

            option.addEventListener("click", () => {
                const content_selected = (`${label ?? ''} ${title}`.trim());
                selected.textContent = `${content_selected}`;
                optionsList.classList.add("hidden");

                if (next && typeof next[index] === "function") {
                    next[index]();
                }

                if (typeof onSelectionChange === "function") {
                    onSelectionChange(index);
                }
            });

            optionsList.appendChild(option);
        });

        selected.addEventListener("click", () => {
            setTimeout(() => {
                if (optionsList.classList.toggle("hidden")) {
                    selected.classList.toggle(`dd-visible-${direction_open}`, false);
                } else {
                    selected.classList.toggle(`dd-visible-${direction_open}`, true);
                }
            }, 0);
        });

        dropdown.appendChild(selected);
        dropdown.appendChild(optionsList);
        container.appendChild(dropdown);

        // Close dropdown if clicked outside
        document.addEventListener("click", function onDocumentClick(e) {
            if (!document.body.contains(container)) {
                // container was discarded without ever being explicitly torn down
                // (this builder has no destroy hook) - self-unregister so this
                // closure doesn't keep listening (and keep the whole subtree alive) forever
                document.removeEventListener("click", onDocumentClick);
                return;
            }
            if (!container.contains(e.target)) {
                optionsList.classList.add("hidden");
                selected.classList.toggle(`dd-visible-${direction_open}`, false);
            }
        });

        return container;
    }
}

class Icons {
    /**
     * @param {*} code_point https://fonts.google.com/icons Code point ex `e86c`
     * @param {*} user_attribute_before true = `<div class="f-icon" data-icon='&#xef71;'></div>`
     * @returns 
     */
    static create(code_point, user_attribute_before = false) {
        const icon_character_code = document.createElement('div');
        const char = String.fromCodePoint(parseInt(code_point, 16));
        if (user_attribute_before) {
            icon_character_code.classList.add('f-icon');
            icon_character_code.setAttribute('data-icon', char);
        } else {
            icon_character_code.classList.toggle("f-icon-i", true);
            icon_character_code.innerText = char;
        }
        return icon_character_code;
        //<div class="f-icon-i">&#xef71;</div>      //ef71 icon_code
        //<div class="f-icon" data-icon=""></div>
    }
    //e314 - keyboard_arrow_left
}

const toolbar = document.querySelector('.toolbar');
if (toolbar) {
    const langCodes = ['en', 'it', 'de'];
    const langTitles = ['English', 'Italiano', 'Deutsch'];

    const langDropdown = MockUiBuilder.createDropDownButtonSelector({
        titles: langTitles,
        icon_code: 'e64c',
        onSelectionChange: (index) => {
            const lang = langCodes[index];
            Locale.setLang(lang);
            vscode.postMessage({ command: 'saveConfig', key: 'language', value: lang });
        },
        direction_open: 'top',
    });
    langDropdown.id = 'whole-lang-select-container';

    const selectedLabel = langDropdown.querySelector('.custom-dropdown-selected');
    const currentIndex = langCodes.indexOf(Locale.lang);
    if (selectedLabel && currentIndex >= 0) {
        selectedLabel.textContent = langTitles[currentIndex];
    }

    toolbar.appendChild(langDropdown);
}
setTimeout(() => {
    document.body.style.opacity='1';
}, 150);