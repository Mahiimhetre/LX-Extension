// Locator-X Web Extension - UI Controller
// Clean, minimal implementation with dependency synchronization

const LocatorX = {
    core: null,
    modal: null,
    evaluator: null,
    lastMetadata: null,
    lastLocators: [],
    lastLocatorTime: 0,
    lastElementInfo: null,
    lastElementType: null,
    _port: null,

    notifications: {
        show(message, type = 'info', duration = 3000) {
            const container = document.getElementById('notificationContainer');
            if (!container) return;

            const notification = document.createElement('div');
            notification.className = `notification ${type}`;

            const hasHtml = /<[a-z][\s\S]*>/i.test(message);
            const displayMessage = hasHtml ? message : LocatorX.utils.escapeHtml(message);

            notification.innerHTML = `
                <i class="bi ${this._getIcon(type)}"></i>
                <span class="message">${displayMessage}</span>
            `;

            container.appendChild(notification);

            // Animate in
            requestAnimationFrame(() => notification.classList.add('show'));

            // Auto remove
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, duration);
        },

        info(msg) { this.show(msg, 'info'); },
        success(msg) { this.show(msg, 'success'); },
        error(msg) { this.show(msg, 'error'); },
        warn(msg) { this.show(msg, 'warning'); },

        undoable(message, onUndo, duration = 6000) {
            const container = document.getElementById('notificationContainer');
            if (!container) return;

            const notification = document.createElement('div');
            notification.className = `notification warning undo-toast`;
            notification.innerHTML = `
                <i class="bi bi-arrow-counterclockwise"></i>
                <span class="message" style="flex:1;">${LocatorX.utils.escapeHtml(message)}</span>
                <button class="undo-btn" style="background:var(--accent);border:none;border-radius:4px;color:#fff;padding:2px 8px;cursor:pointer;font-size:11px;font-weight:600;">Undo</button>
            `;

            container.appendChild(notification);
            requestAnimationFrame(() => notification.classList.add('show'));

            let isUndone = false;
            const undoBtn = notification.querySelector('.undo-btn');

            const timeoutId = setTimeout(() => {
                if (!isUndone) {
                    notification.classList.remove('show');
                    setTimeout(() => notification.remove(), 300);
                }
            }, duration);

            undoBtn.addEventListener('click', () => {
                isUndone = true;
                clearTimeout(timeoutId);
                if (typeof onUndo === 'function') {
                    onUndo();
                    this.success('Action reversed');
                }
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            });
        },

        _getIcon(type) {
            switch (type) {
                case 'success': return 'bi-check-circle-fill';
                case 'error': return 'bi-exclamation-octagon-fill';
                case 'warning': return 'bi-exclamation-triangle-fill';
                default: return 'bi-info-circle-fill';
            }
        }
    },





    utils: {
        escapeHtml(unsafe) {
            if (typeof unsafe !== 'string') return unsafe;
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        },

        async copyToClipboard(text) {
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(text);
                    return true;
                }
                throw new Error('Clipboard API unavailable');
            } catch (err) {
                try {
                    const textArea = document.createElement("textarea");
                    textArea.value = text;
                    textArea.style.position = "fixed";
                    textArea.style.left = "-9999px";
                    textArea.style.top = "0";
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    const successful = document.execCommand('copy');
                    document.body.removeChild(textArea);
                    if (successful) return true;
                } catch (fallbackErr) {
                    console.error('Fallback copy failed:', fallbackErr);
                }
                return false;
            }
        },

        async triggerDebugger() {
            const btn = document.getElementById('freezeBtn');

            // Initialize service if not ready (lazy load)
            if (!LocatorX.debuggerService) {
                LocatorX.debuggerService = new DebuggerService();
                await LocatorX.debuggerService.init();
            }

            const service = LocatorX.debuggerService;

            // CASE 1: CANCEL
            if (service.timer) {
                service.cancel();
                return;
            }

            // CASE 2: START
            try {
                await service.startCountdown();
            } catch (err) {
                console.error('Debugger Error:', err);
                // UI reset is handled by service
            }
        },

        async evaluate(source, options = {}) {
            if (!LocatorX.evaluator) return 0;
            return LocatorX.evaluator.evaluate(source, { ...options, mode: LocatorX.tabs.current });
        },

        highlight(selector, action = 'highlightMatches', mode = 'home', index = null) {
            if (LocatorX.evaluator) {
                LocatorX.evaluator.highlight(selector, action, mode, index);
            }
        },

        _updateBadge(badge, count) {
            let el = typeof badge === 'string' ? document.getElementById(badge) : badge;
            if (el && el.dataset) {
                el.dataset.count = count;
                el.textContent = count; // Set text content directly
                el.classList.remove('hidden');
            }
        },

        setupInputGroups() {
            document.querySelectorAll('.input-group').forEach(group => {
                const input = group.querySelector('input');
                const clearBtn = group.querySelector('.clear-btn');

                if (!input || !clearBtn) return;

                const toggleBtn = () => {
                    if (input.value.length > 0) clearBtn.classList.remove('hidden');
                    else clearBtn.classList.add('hidden');
                };

                // Initial State
                toggleBtn();

                // Input Event
                input.addEventListener('input', toggleBtn);

                // Click Event
                clearBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent bubbling if needed
                    input.value = '';
                    toggleBtn();
                    input.focus();
                    // Trigger input event for bound listeners (like search)
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                });
            });

            // Navigation Button Listeners
            const prevBtn = document.getElementById('prevMatchBtn');
            const nextBtn = document.getElementById('nextMatchBtn');

            if (prevBtn) {
                prevBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (LocatorX.search && LocatorX.search.handlePrevMatch) {
                        LocatorX.search.handlePrevMatch();
                    }
                });
            }

            if (nextBtn) {
                nextBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (LocatorX.search && LocatorX.search.handleNextMatch) {
                        LocatorX.search.handleNextMatch();
                    }
                });
            }
        },

        autoFlip(input, dropdown, estimatedHeight = null) {
            if (!input || !dropdown) return;
            const rect = input.getBoundingClientRect();

            // Detect threshold dynamically from CSS (max-height, height, or min-height)
            const style = window.getComputedStyle(dropdown);

            const parseSize = (val) => {
                if (!val || val === 'none') return 0;
                const parsed = parseInt(val);
                return Number.isNaN(parsed) ? 0 : parsed;
            };

            const maxHeight = parseSize(style.maxHeight);
            const height = parseSize(style.height);
            const minHeight = parseSize(style.minHeight);

            // Use the largest of the defined heights as the threshold
            const threshold = estimatedHeight || maxHeight || height || minHeight || 200;

            // Initial space relative to viewport
            let spaceBelow = window.innerHeight - rect.bottom;
            let spaceAbove = rect.top;

            // Check if any parent container (like a modal) is clipping us
            let parent = input.parentElement;
            while (parent && parent !== document.body) {
                const pStyle = window.getComputedStyle(parent);
                const overflow = pStyle.overflow + pStyle.overflowY;
                if (overflow.includes('hidden') || overflow.includes('auto') || overflow.includes('scroll')) {
                    const parentRect = parent.getBoundingClientRect();
                    // How much space is left inside THIS container
                    spaceBelow = Math.min(spaceBelow, parentRect.bottom - rect.bottom);
                    spaceAbove = Math.min(spaceAbove, rect.top - parentRect.top);
                    break;
                }
                parent = parent.parentElement;
            }

            // Flip if space below is too small AND space above is better
            if (spaceBelow < threshold && spaceAbove > spaceBelow) { dropdown.classList.add('drop-up'); }
            else { dropdown.classList.remove('drop-up'); }
        },

        // --- NEW CONSOLIDATED BROWSER HELPERS ---

        /**
         * Broadcasts a message to the active tab, optionally targeting all frames.
         * Consolidates: chrome.tabs.query + chrome.webNavigation.getAllFrames + message loop.
         */
        broadcastToTab(action, payload = {}, options = {}) {
            return new Promise((resolve) => {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    const tab = tabs[0];
                    if (!tab || !tab.id) return resolve([]);

                    if (options.allFrames) {
                        chrome.webNavigation.getAllFrames({ tabId: tab.id }, (frames) => {
                            if (!frames || frames.length === 0) {
                                chrome.tabs.sendMessage(tab.id, { action, ...payload }, (res) => resolve(res ? [res] : []));
                                return;
                            }

                            let results = [];
                            let pending = frames.length;
                            frames.forEach(frame => {
                                chrome.tabs.sendMessage(tab.id, { action, ...payload }, { frameId: frame.frameId }, (res) => {
                                    if (!chrome.runtime.lastError && res) results.push(res);
                                    pending--;
                                    if (pending === 0) resolve(results);
                                });
                            });
                        });
                    } else {
                        chrome.tabs.sendMessage(tab.id, { action, ...payload }, (res) => resolve(res ? [res] : []));
                    }
                });
            });
        },

        /**
         * Async wrapper for chrome.storage.local.get to avoid nested callbacks.
         */
        getConfig(keys, defaultValues = {}) {
            return new Promise((resolve) => {
                chrome.storage.local.get(keys, (result) => {
                    const merged = { ...defaultValues };
                    Object.keys(result).forEach(k => {
                        if (result[k] !== undefined) merged[k] = result[k];
                    });
                    resolve(merged);
                });
            });
        }
    },

    // POM Management
    pom: {
        currentPageId: null,

        async init() {
            this.setupEventListeners();
            await this.loadPages();
        },

        setupEventListeners() {
            const select = document.getElementById('pomPageSelect');
            const addBtn = document.getElementById('addPageBtn');
            const editBtn = document.getElementById('editPageBtn');
            const deleteBtn = document.getElementById('deletePageBtn');
            const exportBtn = document.getElementById('exportPageBtn');

            if (select) { select.addEventListener('change', (e) => this.switchPage(e.target.value)); }
            if (addBtn) addBtn.addEventListener('click', () => this.createPage());
            if (editBtn) editBtn.addEventListener('click', () => this.renamePage());
            if (deleteBtn) deleteBtn.addEventListener('click', () => this.deletePage());
            if (exportBtn) exportBtn.addEventListener('click', () => this.exportPageCode());
            // Enable Ctrl+Scroll for horizontal scrolling
            const pomTableContainer = document.querySelector('.pom-container .table-container');
            if (pomTableContainer) {
                pomTableContainer.addEventListener('wheel', (e) => {
                    if (e.ctrlKey) {
                        e.preventDefault();
                        pomTableContainer.scrollLeft += e.deltaY;
                    }
                });
            }
        },

        async exportPageCode() {
            const page = await this.getCurrentPage();
            if (!page || !page.locators || page.locators.length === 0) {
                LocatorX.notifications.warn('No page or elements available to export.');
                return;
            }

            // Framework list modal html select
            const html = `
                <div style="margin-bottom:12px;">
                    <label style="display:block;margin-bottom:6px;font-size:11px;font-weight:600;color:var(--text-secondary);">Select Target Framework</label>
                    <select class="modal-select settings-select" style="width:100%;height:28px;box-sizing:border-box;">
                        <option value="playwright">Playwright (JS/TS)</option>
                        <option value="selenium-java">Selenium Java (PageFactory)</option>
                        <option value="selenium-python">Selenium Python</option>
                        <option value="cypress">Cypress (JS/TS)</option>
                    </select>
                </div>
            `;

            const framework = await LocatorX.modal.show({
                type: 'confirm',
                title: 'Export Page Object Code',
                message: html,
                confirmText: 'Export'
            });

            if (!framework) return;

            // Generate elements code data
            const rows = document.querySelectorAll('.pom-table tbody tr');
            const elementsData = page.locators.map((item, index) => {
                const elementLocators = Array.isArray(item) ? item : item.locators;
                let preferredType = '';
                let locatorValue = '';

                const row = rows[index];
                if (row) {
                    const strategySelect = row.querySelector('.strategy-select');
                    if (strategySelect) {
                        preferredType = strategySelect.value;
                        const selectedOpt = strategySelect.options[strategySelect.selectedIndex];
                        locatorValue = selectedOpt ? selectedOpt.getAttribute('data-locator') : '';
                    }
                }

                if (!locatorValue || locatorValue === '-') {
                    const best = this.getBestLocator(elementLocators);
                    preferredType = best.type;
                    locatorValue = best.value;
                }

                const varName = this.generateVariableName(elementLocators, index);

                return {
                    varName,
                    locatorTypeOfPreference: preferredType,
                    locatorValue
                };
            });

            let exportedCode = '';
            let fileExtension = 'js';
            const pascalName = this.toPascalCase(page.name);

            const escapeString = (str) => {
                if (!str) return '';
                return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
            };

            if (framework === 'playwright') {
                fileExtension = 'ts';
                exportedCode = `import { Page, Locator } from '@playwright/test';\n\n`;
                exportedCode += `export class ${pascalName} {\n`;
                exportedCode += `    readonly page: Page;\n`;
                elementsData.forEach(el => {
                    exportedCode += `    readonly ${el.varName}: Locator;\n`;
                });
                exportedCode += `\n    constructor(page: Page) {\n`;
                exportedCode += `        this.page = page;\n`;
                elementsData.forEach(el => {
                    exportedCode += `        this.${el.varName} = page.locator('${escapeString(el.locatorValue)}');\n`;
                });
                exportedCode += `    }\n`;
                exportedCode += `}\n`;
            } else if (framework === 'selenium-java') {
                fileExtension = 'java';
                exportedCode = `import org.openqa.selenium.WebDriver;\n`;
                exportedCode += `import org.openqa.selenium.WebElement;\n`;
                exportedCode += `import org.openqa.selenium.support.FindBy;\n`;
                exportedCode += `import org.openqa.selenium.support.PageFactory;\n\n`;
                exportedCode += `public class ${pascalName} {\n`;
                exportedCode += `    private WebDriver driver;\n\n`;
                elementsData.forEach(el => {
                    let type = el.locatorTypeOfPreference.toLowerCase();
                    let val = el.locatorValue;
                    if (type === 'id') {
                        exportedCode += `    @FindBy(id = "${escapeString(val.replace('#', ''))}")\n`;
                    } else if (type === 'name') {
                        const nameVal = val.match(/name=['"]?([^'"\]]+)['"]?/)?.[1] || val;
                        exportedCode += `    @FindBy(name = "${escapeString(nameVal)}")\n`;
                    } else if (type === 'css') {
                        exportedCode += `    @FindBy(css = "${escapeString(val)}")\n`;
                    } else {
                        exportedCode += `    @FindBy(xpath = "${escapeString(val)}")\n`;
                    }
                    exportedCode += `    private WebElement ${el.varName};\n\n`;
                });
                exportedCode += `    public ${pascalName}(WebDriver driver) {\n`;
                exportedCode += `        this.driver = driver;\n`;
                exportedCode += `        PageFactory.initElements(driver, this);\n`;
                exportedCode += `    }\n`;
                exportedCode += `}\n`;
            } else if (framework === 'selenium-python') {
                fileExtension = 'py';
                exportedCode = `from selenium.webdriver.common.by import By\n\n`;
                exportedCode += `class ${pascalName}:\n`;
                exportedCode += `    def __init__(self, driver):\n`;
                exportedCode += `        self.driver = driver\n`;
                elementsData.forEach(el => {
                    let type = el.locatorTypeOfPreference.toLowerCase();
                    let val = el.locatorValue;
                    let byType = 'XPATH';
                    let byVal = val;
                    if (type === 'id') {
                        byType = 'ID';
                        byVal = val.replace('#', '');
                    } else if (type === 'name') {
                        byType = 'NAME';
                        byVal = val.match(/name=['"]?([^'"\]]+)['"]?/)?.[1] || val;
                    } else if (type === 'css') {
                        byType = 'CSS_SELECTOR';
                    }
                    exportedCode += `        self.${el.varName} = lambda: self.driver.find_element(By.${byType}, "${escapeString(byVal)}")\n`;
                });
            } else if (framework === 'cypress') {
                fileExtension = 'js';
                exportedCode = `class ${pascalName} {\n`;
                elementsData.forEach(el => {
                    exportedCode += `    get ${el.varName}() {\n`;
                    exportedCode += `        return cy.get('${escapeString(el.locatorValue)}');\n`;
                    exportedCode += `    }\n\n`;
                });
                exportedCode += `}\n\n`;
                exportedCode += `export default new ${pascalName}();\n`;
            }

            this.downloadFile(`${pascalName}.${fileExtension}`, exportedCode);
            LocatorX.notifications.success(`POM code exported for ${pascalName}`);
        },

        downloadFile(filename, text) {
            const element = document.createElement('a');
            element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
            element.setAttribute('download', filename);
            element.style.display = 'none';
            document.body.appendChild(element);
            element.click();
            document.body.removeChild(element);
        },

        getBestLocator(elementItem) {
            const locators = Array.isArray(elementItem) ? elementItem : elementItem.locators;
            if (!locators || locators.length === 0) return { type: 'css', value: 'unknown' };

            const preferences = [
                { type: 'ID', name: 'id' },
                { type: 'Name', name: 'name' },
                { type: 'CSS', name: 'css' },
                { type: 'Relative XPath', name: 'xpath' },
                { type: 'OR XPath', name: 'xpath' },
                { type: 'Contains XPath', name: 'xpath' },
                { type: 'Link Text', name: 'linkText' },
                { type: 'TagName', name: 'tagName' },
                { type: 'Absolute XPath', name: 'xpath' }
            ];

            for (const pref of preferences) {
                const found = locators.find(l => l.type === pref.type);
                if (found && found.locator) {
                    return {
                        type: pref.name,
                        value: found.locator
                    };
                }
            }

            return {
                type: 'css',
                value: locators[0].locator
            };
        },

        generateVariableName(elementItem, index) {
            const locators = Array.isArray(elementItem) ? elementItem : elementItem.locators;
            if (!locators || locators.length === 0) return `element_${index + 1}`;

            const toCamelCase = (str) => {
                return str
                    .toLowerCase()
                    .replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase())
                    .replace(/[^a-zA-Z0-9]/g, '');
            };

            const idLoc = locators.find(l => l.type === 'ID');
            if (idLoc && idLoc.locator) {
                const raw = idLoc.locator.replace('#', '');
                return toCamelCase(raw);
            }

            const nameLoc = locators.find(l => l.type === 'Name');
            if (nameLoc && nameLoc.locator) {
                const match = nameLoc.locator.match(/name=['"]?([^'"\]]+)['"]?/);
                if (match && match[1]) {
                    return toCamelCase(match[1]);
                }
            }

            const linkLoc = locators.find(l => l.type === 'Link Text' || l.type === 'Partial Link Text');
            if (linkLoc && linkLoc.locator) {
                return toCamelCase(linkLoc.locator.replace(/[^a-zA-Z0-9 ]/g, '')) + 'Link';
            }

            const xpathLoc = locators.find(l => l.type === 'Relative XPath' || l.type === 'OR XPath');
            if (xpathLoc && xpathLoc.locator) {
                const textMatch = xpathLoc.locator.match(/text\(\)=['"]?([^'")]+)['"]?/) || 
                                  xpathLoc.locator.match(/normalize-space\(\)=['"]?([^'")]+)['"]?/);
                if (textMatch && textMatch[1]) {
                    const cleanText = textMatch[1].replace(/[^a-zA-Z0-9 ]/g, '');
                    if (cleanText.trim().length > 0) {
                        const tag = xpathLoc.locator.match(/^\/\/([a-zA-Z0-9]+)/);
                        const suffix = tag && tag[1] ? toCamelCase(tag[1]) : 'Element';
                        return toCamelCase(cleanText) + suffix.charAt(0).toUpperCase() + suffix.slice(1);
                    }
                }
            }

            const classLoc = locators.find(l => l.type === 'ClassName');
            if (classLoc && classLoc.locator) {
                const raw = classLoc.locator.replace(/^\./, '').split('.')[0];
                return toCamelCase(raw);
            }

            const tagLoc = locators.find(l => l.type === 'TagName');
            const tag = tagLoc && tagLoc.locator ? tagLoc.locator : 'element';
            return `${tag}_${index + 1}`;
        },

        toPascalCase(str) {
            if (!str) return 'Page';
            const clean = str.replace(/[^a-zA-Z0-9 ]/g, '');
            return clean
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join('');
        },

        async loadPages() {
            const pages = await LocatorX.core.getPOMPages();
            const select = document.getElementById('pomPageSelect');
            if (!select) return;

            select.innerHTML = '<option value="" disabled selected>Select Page</option>';

            pages.forEach(page => {
                const option = document.createElement('option');
                option.value = page.id;
                option.textContent = page.name;
                select.appendChild(option);
            });

            // Restore last selected page or default
            if (this.currentPageId && pages.find(p => p.id === this.currentPageId)) {
                select.value = this.currentPageId;
                await this.updateUI(this.currentPageId);
            } else if (pages.length > 0) {
                await this.switchPage(pages[0].id);
            } else {
                await this.updateUI(null);
            }
        },


        async createPage(defaultName = '') {
            const name = await LocatorX.modal.prompt(
                'Create New Page',
                defaultName,
                'Enter a descriptive name for your new POM page...'
            );
            if (!name) return null;

            const newPage = {
                id: `pom_${Date.now()}`,
                name: name,
                locators: []
            };

            await LocatorX.core.savePOMPage(newPage);
            await this.loadPages();
            await this.switchPage(newPage.id);
            return newPage;
        },

        async renamePage() {
            if (!this.currentPageId) return;

            const pages = await LocatorX.core.getPOMPages();
            const page = pages.find(p => p.id === this.currentPageId);
            if (!page) return;

            const newName = await LocatorX.modal.prompt(
                'Rename Page',
                page.name,
                `Enter a new name for "${page.name}"`
            );
            if (!newName || newName === page.name) return;

            page.name = newName;
            await LocatorX.core.savePOMPage(page);
            await this.loadPages();
        },

        async deletePage() {
            if (!this.currentPageId) return;

            const pages = await LocatorX.core.getPOMPages();
            const page = pages.find(p => p.id === this.currentPageId);
            const pageName = page ? page.name : 'this page';

            const confirmed = await LocatorX.modal.confirm(
                'Delete Page',
                `Are you sure you want to delete <span style="font-weight:600; color:var(--status-red-text);">"${pageName}"</span>?`,
                { icon: 'bi-exclamation-triangle-fill' }
            );
            if (!confirmed) return;

            const deletedPageId = this.currentPageId;
            const deletedPage = JSON.parse(JSON.stringify(page));

            await LocatorX.core.deletePOMPage(this.currentPageId);
            this.currentPageId = null;
            await this.loadPages();

            LocatorX.notifications.undoable(`Deleted POM page "${pageName}"`, async () => {
                await LocatorX.core.savePOMPage(deletedPage);
                await this.loadPages();
                await this.switchPage(deletedPageId);
            });
        },

        async switchPage(pageId) {
            this.currentPageId = pageId;
            const select = document.getElementById('pomPageSelect');
            if (select) select.value = pageId;

            await this.updateUI(pageId);
        },

        async getCurrentPage() {
            if (!this.currentPageId) return null;
            const pages = await LocatorX.core.getPOMPages();
            return pages.find(p => p.id === this.currentPageId);
        },

        async addLocatorToPage(locator) {
            const page = await this.getCurrentPage();
            if (!page) {
                LocatorX.notifications.warn('Please select or create a page first.');
                return;
            }

            // Check duplicates in the page
            const exists = page.locators.some(l => l.locator === locator.locator && l.type === locator.type);
            if (exists) return; // Silent return or notify

            page.locators.push(locator);
            await LocatorX.core.savePOMPage(page);
            await this.updateUI(this.currentPageId);
        },

        async updateUI(pageId) {
            const editBtn = document.getElementById('editPageBtn');
            const deleteBtn = document.getElementById('deletePageBtn');
            const tableBody = document.querySelector('.pom-table tbody');

            if (!pageId) {
                if (editBtn) editBtn.classList.add('disabled');
                if (deleteBtn) deleteBtn.classList.add('disabled');
                if (tableBody) tableBody.innerHTML = '';
                return;
            }

            if (editBtn) editBtn.classList.remove('disabled');
            if (deleteBtn) deleteBtn.classList.remove('disabled');

            // Render Table
            await this.renderTable(pageId);
        },

        async renderTable(pageId) {
            const pages = await LocatorX.core.getPOMPages();
            const page = pages.find(p => p.id === pageId);
            if (!page || !page.locators) return;

            const tbody = document.querySelector('.pom-table tbody');
            if (!tbody) return;
            tbody.innerHTML = '';

            // Retrieve structural info from filters (or recalculate if undefined)
            let structure = LocatorX.filters.pomStructure;
            if (!structure) {
                // Fallback if updatePOMTable hasn't run yet
                await LocatorX.filters.updatePOMTable();
                structure = LocatorX.filters.pomStructure;
            }

            const { standard, hasGrouped, groupedTypes } = structure;

            page.locators.forEach((item, index) => {
                // Handle legacy data (item is array) vs new data (item is {locators, fingerprint})
                const elementLocators = Array.isArray(item) ? item : item.locators;
                const hasFingerprint = !Array.isArray(item) && item.fingerprint;

                const row = document.createElement('tr');
                row.innerHTML = `<td>${index + 1}</td>`;

                // Render Standard Columns
                standard.forEach(type => {
                    const matching = elementLocators.find(l => l.type === type);
                    const val = matching ? matching.locator : '-';
                    // Add distinct style for empty
                    const style = matching ? '' : 'color: var(--secondary-text); opacity: 0.5;';
                    row.innerHTML += `<td class="lx-editable" data-target="pom-cell" data-locator-type="${type}" style="${style}">${LocatorX.utils.escapeHtml(val)}</td>`;
                });

                // Render Grouped Column (Relative XPath) if needed
                if (hasGrouped) {
                    // Only use enabled subtypes for the dropdown
                    if (groupedTypes.length > 0) {
                        // Find which locators actually exist for this element
                        const validGrouped = elementLocators.filter(l => groupedTypes.includes(l.type));

                        // 1. Try 'Relative XPath' if available and valid
                        let preferredType = '';
                        const relativeFn = validGrouped.find(l => l.type === 'Relative XPath');

                        if (relativeFn) { preferredType = 'Default'; }
                        else if (validGrouped.length > 0) { preferredType = validGrouped[0].type; }
                        else { preferredType = groupedTypes.includes('Default') ? 'Default' : groupedTypes[0]; }

                        const preferredLocatorFn = elementLocators.find(l => l.type === preferredType);
                        const preferredValue = preferredLocatorFn ? preferredLocatorFn.locator : '-';
                        const valStyle = preferredLocatorFn ? '' : 'color: var(--secondary-text); opacity: 0.5;';

                        // Create Dropdown Options
                        const options = groupedTypes.map(type => {
                            const loc = elementLocators.find(l => l.type === type);
                            const val = loc ? loc.locator : '-';
                            const isDisabled = !loc;
                            return `<option value="${LocatorX.utils.escapeHtml(type)}" data-locator="${LocatorX.utils.escapeHtml(val)}" ${type === preferredType ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}>${LocatorX.utils.escapeHtml(type)}</option>`;
                        }).join('');

                        row.innerHTML += `
                            <td class="strategy-cell">
                                <div class="pom-strategy-container">
                                     <select class="strategy-select">
                                        ${options}
                                     </select>
                                     <div class="strategy-value lx-editable" data-target="pom-cell" data-is-strategy="true" style="${valStyle}">${LocatorX.utils.escapeHtml(preferredValue)}</div>
                                </div>
                            </td>`;
                    } else {
                        // Should technically not happen if hasGrouped is true, but safe fallback
                        row.innerHTML += `<td class="lx-editable" data-target="pom-cell" data-locator-type="Strategy" style="color: var(--secondary-text); opacity: 0.5;"></td>`;
                    }
                }

                // Time Column
                const timestamp = item.timestamp || '-';
                const showTimestamp = LocatorX.filters.showTimestamp;
                row.innerHTML += `<td class="time-column ${showTimestamp ? '' : 'hidden'}">${timestamp}</td>`;

                // Actions Column
                row.innerHTML += `<td>
                        <i class="bi-clipboard" title="Copy" role="button" tabindex="0"></i>
                        <i class="bi-trash" title="Delete" role="button" tabindex="0"></i>
                    </td>
                `;

                // Bind Events
                if (hasGrouped) {
                    const select = row.querySelector('.strategy-select');
                    if (select) {
                        select.addEventListener('change', (e) => {
                            const newType = e.target.value;
                            const newValue = elementLocators.find(l => l.type === newType);
                            const valDiv = row.querySelector('.strategy-value');

                            if (valDiv) {
                                if (newValue) {
                                    valDiv.textContent = newValue.locator;
                                    valDiv.style.color = '';
                                    valDiv.style.opacity = '1';
                                } else {
                                    valDiv.textContent = '-';
                                    valDiv.style.color = 'var(--secondary-text)';
                                    valDiv.style.opacity = '0.5';
                                }
                            }
                        });
                    }
                }
                tbody.appendChild(row);
            });
        },

        async deleteLocator(row) {
            const tbody = row.parentElement;
            const index = Array.from(tbody.children).indexOf(row);

            if (index === -1) return;

            const page = await this.getCurrentPage();
            if (page && page.locators) {
                const deletedLocator = JSON.parse(JSON.stringify(page.locators[index]));

                page.locators.splice(index, 1);
                await LocatorX.core.savePOMPage(page);
                await this.renderTable(page.id);

                LocatorX.notifications.undoable('Deleted POM entry', async () => {
                    const currentPage = await this.getCurrentPage();
                    if (currentPage && currentPage.id === page.id) {
                        currentPage.locators.splice(index, 0, deletedLocator);
                        await LocatorX.core.savePOMPage(currentPage);
                        await this.renderTable(currentPage.id);
                    }
                });
            }
        },

        async updateLocator(row, type, newValue) {
            const tbody = row.parentElement;
            const index = Array.from(tbody.children).indexOf(row);

            if (index === -1) return;

            const page = await this.getCurrentPage();
            if (page && page.locators) {
                const item = page.locators[index];
                const elementLocators = Array.isArray(item) ? item : item.locators;

                if (elementLocators) {
                    const loc = elementLocators.find(l => l.type === type);
                    if (loc) {
                        loc.locator = newValue;
                    } else {
                        elementLocators.push({ type, locator: newValue, matches: 0 });
                    }
                    await LocatorX.core.savePOMPage(page);
                    LocatorX.notifications.success('POM locator updated');
                }
            }
        }
    },

    // Tab Management
    tabs: {
        current: 'home',

        init() {
            document.getElementById('navHome').addEventListener('click', () => this.switch('home'));
            document.getElementById('navPOM').addEventListener('click', () => this.switch('pom'));
            document.getElementById('navAxes').addEventListener('click', () => this.switch('axes'));

            // Dynamic View Close Button
            const closeBtn = document.getElementById('closeDynamicBtn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => LocatorX.dynamicView.hide());
            }

            // Open MultiScan Directly
            const navMultiScan = document.getElementById('navMultiScan');
            if (navMultiScan) {
                navMultiScan.addEventListener('click', (e) => {
                    e.stopPropagation();
                    LocatorX.dropdowns.closeAll();
                    LocatorX.multiScan.show();
                });
            }

            // Freeze/Debugger
            const freezeBtn = document.getElementById('freezeBtn');
            if (freezeBtn) {
                freezeBtn.addEventListener('click', () => LocatorX.utils.triggerDebugger());
            }

            this.switch('home');
        },

        switch(tab) {
            // Prevent switching if inspection is active (unless it is currently deactivating)
            if (LocatorX.inspect.isActive && !LocatorX.inspect._isDeactivating) {
                LocatorX.notifications.error('Please stop inspection before switching tabs.');
                return;
            }

            // Update UI
            // Update UI
            document.querySelectorAll('.nav-option').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));

            // Handle MultiScan Active State
            const navMultiScan = document.getElementById('navMultiScan');
            if (navMultiScan) navMultiScan.classList.remove('active');

            // 1. SAVE: Check current tab to decide if/what to save
            if (this.current === 'home') {
                LocatorX.filters.saveCurrentFilters('home');
            } else if (this.current === 'pom') {
                LocatorX.filters.saveCurrentFilters('pom');
            }
            // If current is 'axes' or 'dynamic', we do NOT save, preserving previous 'home'/'pom' states.

            // 2. LOAD & SWITCH UI
            if (tab === 'home') {
                LocatorX.filters.loadFilters('home');
                document.getElementById('navHome').classList.add('active');
                document.querySelector('.home-container').classList.add('active');
                LocatorX.filters.updateTable();
            } else if (tab === 'axes') {
                // Axes Tab (No filter loading)
                document.getElementById('navAxes').classList.add('active');
                document.querySelector('.axes-container').classList.add('active');
            } else if (tab === 'pom') {
                LocatorX.filters.loadFilters('pom');
                document.getElementById('navPOM').classList.add('active');
                document.querySelector('.pom-container').classList.add('active');
                LocatorX.filters.updatePOMTable();

                // Init POM if needed
                if (!LocatorX.pom.currentPageId) {
                    LocatorX.pom.init();
                } else {
                    // re-render in case filter changed
                    LocatorX.pom.renderTable(LocatorX.pom.currentPageId);
                }
            } else {
                // Dynamic View (Default)
                document.querySelector('.dynamic-container').classList.add('active');
                if (navMultiScan) navMultiScan.classList.add('active');
                this.current = 'dynamic'; // Ensure state reflects dynamic
            }
            this.current = tab;

            // Sync Inspect Mode if active
            if (LocatorX.inspect && LocatorX.inspect.isActive) {
                LocatorX.inspect.currentMode = tab;
                LocatorX.inspect.updateUI();
            }
            LocatorX.filters.updateFilterVisibility(tab);
        },
    },

    // Dynamic View Manager
    dynamicView: {
        lastTab: 'home',

        async show(title, content) {
            this.lastTab = LocatorX.tabs.current !== 'dynamic' ? LocatorX.tabs.current : 'home';

            const titleEl = document.getElementById('dynamicTitle');
            const contentEl = document.getElementById('dynamicContent');

            if (titleEl) titleEl.textContent = title;
            if (contentEl) contentEl.innerHTML = content;

            await LocatorX.tabs.switch('dynamic');
        },

        hide() {
            LocatorX.tabs.switch(this.lastTab);
        }
    },

    // Axes Management
    axes: {
        init() {
            const swapBtn = document.getElementById('axesSwapBtn');
            if (swapBtn) {
                swapBtn.addEventListener('click', () => this.swap());
            }

            const anchorBox = document.getElementById('axesAnchorBox');
            if (anchorBox) {
                anchorBox.addEventListener('click', () => {
                    // Activate inspect mode in axes tab, starting at anchor selection
                    if (LocatorX.inspect.isActive) {
                        LocatorX.inspect.deactivate();
                    }
                    LocatorX.inspect.activate('axes-anchor');
                });
            }

            const targetBox = document.getElementById('axesTargetBox');
            if (targetBox) {
                targetBox.addEventListener('click', () => {
                    // Activate inspect mode in axes tab, starting at target selection
                    const anchorVal = document.getElementById('axesAnchorValue');
                    if (!anchorVal || anchorVal.textContent.includes('Not Selected') || anchorVal.textContent.includes('Select Anchor')) {
                        LocatorX.notifications.warn('Please select an Anchor element first.');
                        return;
                    }
                    if (LocatorX.inspect.isActive) {
                        LocatorX.inspect.deactivate();
                    }
                    LocatorX.inspect.activate('axes-target');
                });
            }
        },

        swap() {
            const btn = document.getElementById('axesSwapBtn');
            if (btn) btn.style.opacity = '0.5';

            // 1. Swap UI Text Immediately for responsiveness
            const anchorVal = document.getElementById('axesAnchorValue');
            const targetVal = document.getElementById('axesTargetValue');

            if (anchorVal && targetVal) {
                const tempText = anchorVal.textContent;
                const tempColor = anchorVal.style.color;
                const tempWeight = anchorVal.style.fontWeight;

                anchorVal.textContent = targetVal.textContent;
                anchorVal.style.color = targetVal.style.color;
                anchorVal.style.fontWeight = targetVal.style.fontWeight;

                targetVal.textContent = tempText;
                targetVal.style.color = tempColor;
                targetVal.style.fontWeight = tempWeight;
            }

            // 2. Clear Result during swap
            const resultVal = document.getElementById('axesResultValue');
            const matchBadge = document.getElementById('axesMatchCount');

            if (resultVal) resultVal.textContent = 'Calculating...';
            if (matchBadge) {
                matchBadge.classList.add('hidden');
            }

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab && tab.id) {
                    chrome.tabs.sendMessage(tab.id, { action: 'swapAxes' }, () => {
                        // Response handled by message listener (axesResult), but we clear opacity here
                        if (btn) btn.style.opacity = '1';
                    });
                }
            });
        },

        updateResultMatch(locator) {
            LocatorX.utils.evaluate(locator, {
                type: 'xpath',
                badge: 'axesMatchCount'
            });
        }
    },

    // MultiScan Management
    multiScan: {
        mode: 'file', // 'file' or 'text'
        manager: null,
        overlay: null,
        detectionMode: 'auto', // 'auto', 'manual', 'hybrid'
        currentMatches: [],
        currentFile: null,

        init() {
            if (!this.manager && typeof MultiScanManager !== 'undefined') {
                this.manager = new MultiScanManager();
            }
            this.createModal();
        },

        createModal() {
            // Reuse existing modal if available
            if (this.overlay) return;

            // Ensure LocatorX.modal is initialized
            if (!LocatorX.modal) {
                LocatorX.modal = new LocatorXModal();
            }

            this.overlay = LocatorX.modal.overlay;
        },

        close() {
            if (this.overlay) this.overlay.classList.remove('active');
        },

        show() {
            this.createModal();
            // Capture Current URL
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].url) {
                    this.currentTabUrl = tabs[0].url;
                }
                this.renderInputState();
                this.overlay.classList.add('active');
            });

            // Custom Close Hander for Multiscan specific state cleanup if needed
            const closeBtn = this.overlay.querySelector('.modal-close');

        },

        renderInputState() {
            const title = this.overlay.querySelector('.modal-title');
            const body = this.overlay.querySelector('.modal-body');
            const footer = this.overlay.querySelector('.modal-footer');

            title.textContent = 'Multi-Locator Scan';
            footer.classList.add('hidden');

            const framework = document.getElementById('frameworkSelect') ? document.getElementById('frameworkSelect').value : 'selenium';

            body.innerHTML = `
                <!-- Tabs -->
                <div class="control-group ms-control-group">
                    <button class="save-btn ms-tab-btn ${this.mode === 'text' ? '' : 'ms-btn-inactive'}" id="msModeText">
                        <span>📝</span> Text
                    </button>
                    <button class="save-btn ms-tab-btn ${this.mode === 'file' ? '' : 'ms-btn-inactive'}" id="msModeFile">
                        <span>📁</span> File
                    </button>
                </div>

                <!-- Input Area -->
                <div class="control-group ms-input-area" id="msInputArea">
                    ${this.getInputHtml()}
                </div>

                <!-- Target URL (New) -->
                <div class="control-group ms-target-url-group">
                    <label class="setting-label" style="font-size: smaller;" title="Target URL (for verification)"> URL </label>
                    <input type="text" id="msTargetUrl" class="search-input" placeholder="https://example.com" value="${this.currentTabUrl || ''}" autocomplete="off">
                </div>

                <!-- Options -->
                <div class="control-group ms-setting-group">
                    <label class="setting-label" style="font-size: smaller;" title="Pattern Detection Strategy">Pattern </label>
                    <select id="msDetectionMode" class="ms-mode-select">
                        <option value="auto" ${this.detectionMode === 'auto' ? 'selected' : ''}>Auto-Analyse (Fast)</option>
                        <option value="manual" ${this.detectionMode === 'manual' ? 'selected' : ''}>Manual Pattern</option>
                        <option value="hybrid" ${this.detectionMode === 'hybrid' ? 'selected' : ''}>Hybrid (Auto + Manual)</option>
                    </select>
                </div>
                <div class="ms-setting-note" style="margin-top: -8px; margin-bottom: 8px;">
                     ${this.getModeNote(framework)}
                </div>

                <!-- Manual Pattern Input (Hidden if Auto) -->
                <div class="control-group ${this.detectionMode === 'auto' ? 'hidden' : ''}" id="msPatternContainer">
                    <input type="text" id="msSyntaxInput" class="search-input" placeholder="Select or type pattern ({type}, {locator})..." autocomplete="off">
                    <div id="msSyntaxDropdown" class="search-dropdown"></div>
                </div>

                <!-- Action -->
                <div class="modal-footer ms-modal-footer">
                    <button class="modal-btn primary ms-scan-btn" id="msScanBtn">Scan</button>
                </div>
                
                <!-- Result Area -->
                <div id="msResultContainer" class="ms-result-area hidden"></div>
            `;

            this.bindInputEvents();
        },

        getModeNote(framework) {
            if (this.detectionMode === 'auto') return `Automatically detect locators for ${framework}.`;
            if (this.detectionMode === 'manual') return `Use a custom pattern to find locators.`;
            return `Auto-detect ${framework} patterns AND apply your custom pattern.`;
        },

        getInputHtml() {
            if (this.mode === 'file') {
                if (this.currentFile) {
                    const size = this.currentFile.size > 1024 * 1024
                        ? (this.currentFile.size / (1024 * 1024)).toFixed(1) + ' MB'
                        : (this.currentFile.size / 1024).toFixed(1) + ' KB';
                    return `
                        <div class="ms-file-name">
                            <i class="bi-check-circle-fill ms-file-success-icon"></i>
                            <span>${this.currentFile.name}</span>
                            <span class="ms-file-size">(${size})</span>
                            <i class="bi-x-lg ms-remove-file" id="msRemoveFile"></i>
                        </div>`;
                }
                return UniversalDragDrop.getTemplate('msDropZone', 'msFileInput', '.js,.ts,.jsx,.tsx,.py,.java,.txt');
            } else {
                return `<textarea id="msTextInput" class="search-input ms-text-input" placeholder="Paste your code or text here..."></textarea>`;
            }
        },

        bindInputEvents() {
            document.getElementById('msModeFile').addEventListener('click', () => { this.mode = 'file'; this.renderInputState(); });
            document.getElementById('msModeText').addEventListener('click', () => { this.mode = 'text'; this.renderInputState(); });

            const modeSelect = document.getElementById('msDetectionMode');
            const patternContainer = document.getElementById('msPatternContainer');
            if (modeSelect) {
                modeSelect.addEventListener('change', (e) => {
                    this.detectionMode = e.target.value;
                    this.renderInputState();
                });
            }

            const scanBtn = document.getElementById('msScanBtn');
            scanBtn.addEventListener('click', () => this.performScan());

            if (this.mode === 'file') {
                const dropZone = document.getElementById('msDropZone');
                const fileInput = document.getElementById('msFileInput');
                const removeBtn = document.getElementById('msRemoveFile');

                if (removeBtn) {
                    removeBtn.addEventListener('click', () => {
                        this.currentFile = null;
                        this.renderInputState();
                    });
                }

                if (dropZone && fileInput && typeof UniversalDragDrop !== 'undefined') {
                    UniversalDragDrop.setup(dropZone, fileInput, (files) => {
                        if (files && files.length > 0) {
                            const file = files[0];
                            const allowedExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.txt'];
                            const maxSizeBytes = 2 * 1024 * 1024; // 2 MB
                            const extension = '.' + file.name.split('.').pop().toLowerCase();

                            if (!allowedExtensions.includes(extension)) {
                                LocatorX.notifications.error('Unsupported file type. Allowed: JS, TS, JSX, TSX, Python, Java, TXT');
                                return;
                            }

                            if (file.size > maxSizeBytes) {
                                LocatorX.notifications.error('File exceeds size limit of 2 MB.');
                                return;
                            }

                            this.currentFile = file;
                            this.renderInputState();
                        }
                    });
                }
            }

            // Pattern Input Logic
            const syntaxInput = document.getElementById('msSyntaxInput');
            const syntaxDropdown = document.getElementById('msSyntaxDropdown');
            if (syntaxInput && syntaxDropdown) {
                const handler = () => this.handleSyntaxInput(syntaxInput, syntaxDropdown);
                syntaxInput.addEventListener('focus', handler);
                syntaxInput.addEventListener('input', handler);
                syntaxInput.addEventListener('blur', () => setTimeout(() => syntaxDropdown.style.display = 'none', 200));
            }
        },

        // Reusing existing helper for syntax dropdown
        handleSyntaxInput(input, dropdown) {
            const query = input.value;
            const framework = document.getElementById('frameworkSelect') ? document.getElementById('frameworkSelect').value : 'selenium-java';
            const matches = this.manager.filterPatterns(query, framework);

            if (matches.length > 0) {
                dropdown.innerHTML = '';
                matches.forEach(p => {
                    const div = document.createElement('div');
                    div.className = 'dropdown-item';
                    div.innerHTML = `<span class="item-text">${p.label}</span>`;
                    div.addEventListener('click', () => {
                        input.value = p.template;
                        dropdown.style.display = 'none';
                    });
                    dropdown.appendChild(div);
                });
                dropdown.style.display = 'block';
                dropdown.classList.add('visible');

                LocatorX.utils.autoFlip(input, dropdown);
            } else {
                dropdown.style.display = 'none';
                dropdown.classList.remove('drop-up');
            }
        },

        performScan() {
            const scanBtn = document.getElementById('msScanBtn');
            const originalText = scanBtn.textContent;

            // UI Feedback
            scanBtn.classList.add('scanning');
            scanBtn.innerHTML = `<span class="ms-spinner"></span> Scanning...`;

            // READ INPUT
            let contentProm;
            let sourceName = 'Text Input';

            if (this.mode === 'file') {
                if (!this.currentFile) {
                    LocatorX.notifications.warn('Please select a file to scan.');
                    this.resetScanBtn(scanBtn, originalText);
                    return;
                }
                sourceName = this.currentFile.name;
                contentProm = this.manager.readFile(this.currentFile);
            } else {
                const textInput = document.getElementById('msTextInput');
                if (!textInput || !textInput.value.trim()) {
                    LocatorX.notifications.warn('Please enter text to scan.');
                    this.resetScanBtn(scanBtn, originalText);
                    return;
                }
                contentProm = Promise.resolve(textInput.value);
            }

            // EXECUTE SCAN
            contentProm.then(text => {
                const framework = document.getElementById('frameworkSelect') ? document.getElementById('frameworkSelect').value : 'all';
                let matches = [];

                const performAuto = () => this.manager.autoScan(text, framework);
                const performManual = () => {
                    const pattern = document.getElementById('msSyntaxInput').value;
                    if (!pattern) return [];
                    const regex = this.manager.convertSmartPatternToRegex(pattern);
                    return this.manager.findMatches(text, regex, true, pattern);
                };

                if (this.detectionMode === 'auto') {
                    matches = performAuto();
                } else if (this.detectionMode === 'manual') {
                    matches = performManual();
                    if (matches.length === 0) LocatorX.notifications.warn('No matches found for custom pattern.');
                } else if (this.detectionMode === 'hybrid') {
                    const autoMatches = performAuto();
                    const manualMatches = performManual();
                    // Merge and deduplicate by locator
                    const map = new Map();
                    [...autoMatches, ...manualMatches].forEach(m => map.set(m.locator, m));
                    matches = Array.from(map.values());
                }

                this.currentMatches = matches;

                // Final Button State
                scanBtn.textContent = 'Scan Again';
                scanBtn.classList.remove('scanning');

                setTimeout(() => this.renderResultState(matches.length, sourceName), 300);

            }).catch(err => {
                console.error(err);
                if (err.name === 'SyntaxError' || err.message.includes('Regex') || err.message.includes('pattern') || err.message.includes('regular expression')) {
                    LocatorX.notifications.error('Invalid Custom Pattern: ' + err.message);
                } else {
                    LocatorX.notifications.error('Scan Failed: ' + err.message);
                }
                this.resetScanBtn(scanBtn, originalText);
            });
        },

        resetScanBtn(btn, text) {
            btn.classList.remove('scanning');
            btn.textContent = text;
        },

        renderResultState(count, sourceName) {
            const container = document.getElementById('msResultContainer');
            if (!container) return;

            container.innerHTML = `
                <div class="ms-result-compact">
                    <div class="ms-result-info">
                        <i class="bi-check-circle-fill ms-success-icon-small"></i>
                        <span class="ms-result-text">Found <strong class="ms-result-count">${count}</strong> in "${sourceName}"</span>
                    </div>
                    <button class="modal-btn secondary small ms-compact-btn" id="msSeeResult">See Result</button>
                </div >
    `;

            container.classList.remove('hidden');

            const seeResult = document.getElementById('msSeeResult');
            if (seeResult) {
                seeResult.addEventListener('click', () => {
                    // Check URL Match
                    const targetUrlInput = document.getElementById('msTargetUrl');
                    const targetUrl = targetUrlInput ? targetUrlInput.value.trim() : '';

                    if (targetUrl) {
                        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                            const currentUrl = tabs[0].url;

                            // Simple normalization (remove trailing slash)
                            const normTarget = targetUrl.replace(/\/$/, '');
                            const normCurrent = currentUrl.replace(/\/$/, '');

                            if (!normCurrent.includes(normTarget)) {
                                LocatorX.modal.confirm(
                                    'URL Mismatch',
                                    `Target URL: <b>${targetUrl}</b><br>Current URL: <b>${currentUrl}</b><br><br>Verification might fail. Proceed?`,
                                    { icon: 'bi-exclamation-triangle-fill' }
                                ).then(confirmed => {
                                    if (confirmed) this.openResultsInTable();
                                });
                            } else {
                                this.openResultsInTable();
                            }
                        });
                    } else {
                        // No target URL, verify anyway? Or prompt? 
                        // Plan said: Optional for scanning, Mandatory for Verify.
                        // But "See Result" implies viewing them. Verification happens automatically in table.
                        this.openResultsInTable();
                    }
                });
            }
        },

        openResultsInTable() {
            this.close(); // Close Modal

            // Build Dynamic View Content
            const content = `
                <div class="table-container ms-table-container">
                    <table class="locator-table" id="msResultsTable">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Match</th>
                                <th>Type</th>
                                <th>Locator</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            `;

            LocatorX.dynamicView.show('Scan Results', content);

            // Add Rescan Button to Header (Injecting into dynamic header)
            const header = document.querySelector('.dynamic-header');
            if (header && !document.getElementById('headerRescanBtn')) {
                const rescanBtn = document.createElement('button');
                rescanBtn.id = 'headerRescanBtn';
                rescanBtn.className = 'save-btn ms-header-rescan';
                rescanBtn.textContent = 'Rescan';

                rescanBtn.addEventListener('click', () => {
                    LocatorX.dynamicView.hide(); // Go back? or just open modal?
                    this.show();
                });

                header.appendChild(rescanBtn);
            }

            this.renderTableRows(this.currentMatches);
        },

        renderTableRows(matches) {
            const tbody = document.querySelector('#msResultsTable tbody');
            if (!tbody) return;
            tbody.innerHTML = '';

            if (matches.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="ms-empty-row">No matches found.</td></tr>`;
                return;
            }

            matches.forEach((match) => {
                const { index, type, locator } = match;
                const row = document.createElement('tr');
                const matchId = `ms-match-${index}`; // Ensure unique ID per scan

                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td><span class="match-count" id="${matchId}" data-count="...">...</span></td>
                    <td class="lx-editable ms-type-cell">${LocatorX.utils.escapeHtml(type)}</td>
                    <td class="lx-editable">${LocatorX.utils.escapeHtml(locator)}</td>
                    <td>
                        <i class="bi-clipboard ms-copy-icon" title="Copy" role="button" tabindex="0"></i>
                    </td>
                `;
                tbody.appendChild(row);

                // Copy Action
                row.querySelector('.bi-clipboard').addEventListener('click', () => {
                    LocatorX.utils.copyToClipboard(locator);
                    LocatorX.notifications.success('Locator copied!');
                });
            });

            // Trigger Batch Validation
            this.batchValidateMatches(matches);
        },

        async batchValidateMatches(matches) {
            if (!matches || matches.length === 0) return;

            const items = matches.map(m => ({
                id: m.index !== undefined ? `ms-match-${m.index}` : m.id,
                selector: m.locator,
                type: m.type
            }));

            // Use unified broadcaster for ALL frames
            const allFrameResults = await LocatorX.utils.broadcastToTab('batchEvaluate', { items }, { allFrames: true });
            
            this._finalizeBatchResults(items, allFrameResults);
        },

        _finalizeBatchResults(items, allFrameResults) {
            items.forEach(async (item) => {
                let totalCount = 0;
                let autoSuggestion = null;
                let isError = false;
                let errorMessage = '';

                allFrameResults.forEach(frameResults => {
                    if (frameResults.results) {
                        const res = frameResults.results.find(r => r.id === item.id);
                        if (res) {
                            if (res.error) {
                                isError = true;
                                errorMessage = res.errorMessage || 'Invalid locator syntax';
                            } else {
                                totalCount += res.count || 0;
                                if (res.suggestion && !autoSuggestion) autoSuggestion = res.suggestion;
                            }
                        }
                    }
                });

                const badge = document.getElementById(item.id);
                if (isError) {
                    LocatorX.utils._updateBadge(item.id, 'ERR');
                    if (badge) {
                        badge.title = errorMessage;
                    }
                } else {
                    LocatorX.utils._updateBadge(item.id, totalCount);
                    if (badge) {
                        badge.removeAttribute('title');
                    }
                }

                if (autoSuggestion && autoSuggestion !== item.selector) {
                    const config = await LocatorX.utils.getConfig(['smartCorrectEnabled'], { smartCorrectEnabled: true });
                    if (config.smartCorrectEnabled !== false) {
                        this._applyAutoCorrection(item.id, autoSuggestion);
                    }
                }
            });
        },

        validateMatch(locator, type, matchId) {
            // Simplified: Now just a wrapper for a single-item batch
            this.batchValidateMatches([{ id: matchId, locator, type }]);
        },


        _applyAutoCorrection(matchId, suggestion) {
            const badge = document.getElementById(matchId);
            if (!badge) return;
            const row = badge.closest('tr');
            if (row) {
                // MultiScan: Locator is in 4th column (index 3)
                // Main Table: handled differently, but validateMatch is mostly MultiScan context
                if (row.cells[3]) {
                    const originalLocator = row.cells[3].textContent.trim();
                    const cleanOriginal = originalLocator.startsWith('✨') ? originalLocator.substring(2).trim() : originalLocator;

                    row.cells[3].innerHTML = `<span class="healed-locator" title="Auto-healed by Locator-X (Original: ${LocatorX.utils.escapeHtml(cleanOriginal)})">✨ ${LocatorX.utils.escapeHtml(suggestion)}</span>`;

                    // Visual Feedback
                    row.cells[3].style.transition = 'background-color 0.5s';
                    row.cells[3].style.backgroundColor = 'rgba(46, 204, 113, 0.2)'; // Green tint
                    setTimeout(() => {
                        row.cells[3].style.backgroundColor = '';
                    }, 1500);

                    LocatorX.notifications.info(`Auto - corrected to "${suggestion}"`);
                }
            }
        },

    },

    // Tab State Management
    stateManager: {
        lastTabId: null,

        init() {
            // Listen for tab changes from background
            chrome.runtime.onMessage.addListener((message) => {
                if (message.action === 'activeTabChanged') {
                    this.handleTabChange(message.tabId, message.state);
                }
            });

            // Initial load state for current tab
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab && tab.id) {
                    this.lastTabId = tab.id;
                    chrome.runtime.sendMessage({ action: 'getTabState', tabId: tab.id }, (response) => {
                        if (response && response.state) {
                            this.restoreState(response.state);
                        }
                    });
                }
            });

            // Periodically save state (every 3 seconds if active)
            setInterval(() => this.checkpoint(), 3000);
        },

        handleTabChange(tabId, state) {
            // Prevent redundant restores if we already tracked this change
            if (this.lastTabId === tabId) return;
            this.lastTabId = tabId;

            if (state) {
                this.restoreState(state);
            } else {
                this.resetUI();
            }
        },

        restoreState(state) {
            if (!state) return;

            // 1. Search UI
            const searchInput = document.querySelector('.search-input');
            if (searchInput && state.searchQuery !== undefined) {
                searchInput.value = state.searchQuery;
            }

            // 2. Results Table
            if (state.lastLocators) {
                LocatorX.filters.displayGeneratedLocators(
                    state.lastLocators,
                    state.lastElementInfo,
                    state.lastElementType,
                    state.lastMetadata
                );
            }

            // 3. Match Count for search bar (if exists)
            if (state.searchMatchCount !== undefined) {
                const searchBadge = document.getElementById('searchMatchBadge');
                if (searchBadge) {
                    searchBadge.textContent = state.searchMatchCount;
                    searchBadge.classList.toggle('hidden', state.searchMatchCount === 0);
                }
            }

            // 4. Inspection State
            if (state.inspecting) {
                if (!LocatorX.inspect.isActive) LocatorX.inspect.activate();
            } else {
                if (LocatorX.inspect.isActive) LocatorX.inspect.deactivate();
            }
        },

        resetUI() {
            const searchInput = document.querySelector('.search-input');
            if (searchInput) searchInput.value = '';

            const searchBadge = document.getElementById('searchMatchBadge');
            if (searchBadge) searchBadge.classList.add('hidden');

            LocatorX.filters.displayGeneratedLocators([], 'No element selected', null, null);
            if (LocatorX.inspect.isActive) LocatorX.inspect.deactivate();
        },

        checkpoint() {
            if (!this.lastTabId) return;

            const searchInput = document.querySelector('.search-input');
            const searchBadge = document.getElementById('searchMatchBadge');

            const state = {
                searchQuery: searchInput ? searchInput.value : '',
                searchMatchCount: searchBadge ? parseInt(searchBadge.textContent) : 0,
                lastLocators: LocatorX.filters.lastLocators || [],
                lastElementInfo: LocatorX.filters.lastElementInfo || 'No element selected',
                lastElementType: LocatorX.filters.lastElementType || null,
                lastMetadata: LocatorX.filters.lastMetadata || null,
                inspecting: LocatorX.inspect.isActive,
                activeTab: LocatorX.tabs.current
            };

            chrome.runtime.sendMessage({
                action: 'saveTabState',
                tabId: this.lastTabId,
                state: state
            }).catch(() => { });
        }
    },

    // Theme Management
    theme: {
        current: 'light',
        rotation: 0,

        async init() {
            await this.load();
            document.getElementById('themeBtn').addEventListener('click', () => this.toggle());
        },

        async toggle() {
            this.current = this.current === 'light' ? 'dark' : 'light';
            this.rotation += 180;
            document.getElementById('themeBtn').style.transform = `rotate(${this.rotation}deg)`;
            this.apply();
            await LocatorX.core.setTheme(this.current);
        },

        apply() {
            document.body.classList.toggle('dark-theme', this.current === 'dark');
        },

        async load() {
            this.current = await LocatorX.core.getTheme();
            this.apply();
        }
    },

    dropdowns: {
        list: [
            { btn: 'navAbout', dropdown: 'aboutDropdown' },
            { btn: 'navHistory', dropdown: 'customDropdown' },
            { btn: 'navSettings', dropdown: 'settingsDropdown' },
            { btn: 'userDropdownTrigger', dropdown: 'userDropdown' }
        ],

        init() {
            this.list.forEach(({ btn, dropdown }) => {
                const btnEl = document.getElementById(btn);
                const dropdownEl = document.getElementById(dropdown);

                if (btnEl && dropdownEl) {
                    btnEl.addEventListener('click', () => this.toggle(btn, dropdown));
                    dropdownEl.addEventListener('click', e => e.stopPropagation());
                }
            });

            document.addEventListener('click', e => {
                // Modified to include user-profile in the exception list
                if (e.target && e.target.closest &&
                    !e.target.closest('.nav-item') &&
                    !e.target.closest('.user-profile')) {
                    this.closeAll();
                }
            });
        },

        toggle(targetBtn, targetDropdown) {
            this.list.forEach(({ btn, dropdown }) => {
                const el = document.getElementById(dropdown);
                const btnEl = document.getElementById(btn);

                if (dropdown === targetDropdown) {
                    const isVisible = el.style.display === 'block';
                    el.style.display = isVisible ? 'none' : 'block';
                    btnEl.classList.toggle('active', !isVisible);

                    // Populate history dropdown when it opens
                    if (!isVisible && dropdown === 'customDropdown') {
                        this.renderHistory();
                    }
                } else {
                    el.style.display = 'none';
                    btnEl.classList.remove('active');
                }
            });
        },

        async renderHistory() {
            const dropdown = document.getElementById('customDropdown');
            if (!dropdown) return;

            const history = await LocatorX.core.getHistory();
            const content = dropdown.querySelector('.dropdown-content');
            if (!content) return;

            if (history.length === 0) {
                content.innerHTML = `
                    <div class="empty-state">
                        <i class="bi-clock-history" style="font-size: 24px; color: var(--border-dark); margin-bottom: 8px;"></i>
                        <p style="color: var(--secondary-text); margin: 0;">No recent activity</p>
                    </div>`;
                return;
            }

            content.innerHTML = history.slice(0, 30).map((item, index) => {
                const time = item.timestamp
                    ? new Date(item.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                    : '--:--';
                const elementLabel = item.element
                    ? `${item.element.tagName || ''}${item.element.id ? '#' + item.element.id : ''}${item.element.className ? '.' + String(item.element.className).split(' ')[0] : ''}`
                    : 'Element';
                // Pick the best locator to display (CSS or first available)
                const best = Array.isArray(item.locators)
                    ? (item.locators.find(l => l.type === 'CSS') || item.locators[0])
                    : null;
                const locatorText = best ? best.locator : '—';

                return `
                    <div class="saved-item history-item" data-index="${index}" style="cursor:default;">
                        <div class="saved-main">
                            <div class="saved-info">
                                <span class="saved-name" title="${LocatorX.utils.escapeHtml(locatorText)}">${LocatorX.utils.escapeHtml(elementLabel)}</span>
                                <span class="saved-type-badge" style="opacity:0.7;">${time}</span>
                            </div>
                            <div class="saved-actions">
                                <i class="bi-clipboard header-icon-button history-copy" title="Copy best locator" style="font-size:12px; margin:0 2px;" role="button" tabindex="0" data-locator="${LocatorX.utils.escapeHtml(locatorText)}"></i>
                            </div>
                        </div>
                        <div class="saved-locator-code" title="${LocatorX.utils.escapeHtml(locatorText)}">${LocatorX.utils.escapeHtml(locatorText)}</div>
                    </div>`;
            }).join('');

            // Copy handler
            content.querySelectorAll('.history-copy').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const locator = btn.dataset.locator;
                    const ok = await LocatorX.utils.copyToClipboard(locator);
                    if (ok) LocatorX.notifications.success('Copied!');
                    else LocatorX.notifications.error('Failed to copy');
                });
            });
        },

        closeAll() {
            this.list.forEach(({ btn, dropdown }) => {
                document.getElementById(dropdown).style.display = 'none';
                document.getElementById(btn).classList.remove('active');
            });
        }
    },

    // Locator Filter Management
    filters: {
        homeFilters: {},
        pomFilters: {},
        lastLocators: null,
        lastLocatorTime: 0,
        lastElementInfo: null,
        lastElementType: null,
        lastMetadata: null,
        showTimestamp: false,

        init() {
            this.setupSelectAll();
            this.setupCheckboxes();
            this.setupRelativeXPath();
            this.setupGeneratorSettings();
            this.setupTimestampSetting();
            this.setupSmartCorrectionSetting();
            this.setupMatchLimitSetting();
            this.setupResetBtn();
            this.setupBlacklistRegexSetting();
            this.loadFiltersFromStorage();
            this.saveCurrentFilters('home');
            this.updateTable();
        },

        updateFilterVisibility(tab) {
            const container = document.querySelector('.locator-options');
            if (container) {
                // 1. Setup Scroll Listener (Once)
                if (!container.dataset.hasScrollListener) {
                    container.addEventListener('wheel', (e) => {
                        if (e.deltaY !== 0) {
                            e.preventDefault();
                            container.scrollLeft += e.deltaY;
                        }
                    }, { passive: false });
                    container.dataset.hasScrollListener = 'true';
                }

                // 2. Update Visibility
                if (tab === 'home' || tab === 'pom') {
                    container.classList.remove('hidden');
                    // Ensure all individual filters are visible (reset potentially hidden ones)
                    // We can do this by removing display: none from any labels inside
                    container.querySelectorAll('label').forEach(label => label.style.display = '');
                } else {
                    container.classList.add('hidden');
                }
            }
        },

        async loadFiltersFromStorage() {
            const enabledFilters = await LocatorX.core.getEnabledFilters();
            if (enabledFilters && enabledFilters.length > 0) {
                // Set checkboxes based on stored filters
                document.querySelectorAll('.loc-type, .nested-loc-type').forEach(cb => {
                    cb.checked = enabledFilters.includes(cb.id);
                });
                this.updateNestedIcon();
            }
        },

        saveCurrentFilters(tab) {
            const filters = {};
            document.querySelectorAll('.loc-type').forEach(cb => {
                filters[cb.id] = cb.checked;
            });
            document.querySelectorAll('.nested-loc-type').forEach(cb => {
                filters[cb.id] = cb.checked;
            });

            if (tab === 'pom') {
                this.pomFilters = filters;
            } else {
                // Home and Axes share filters (or default)
                this.homeFilters = filters;
            }
        },

        setupGeneratorSettings() {
            const excludeNumbersCfg = document.getElementById('excludeNumbersCfg');
            if (excludeNumbersCfg) {
                const updateState = () => {
                    chrome.storage.local.get(['excludeNumbers', 'user'], (result) => {
                        const user = result.user || { plan: 'free' };
                        const plan = user.plan || 'free';
                        // Use safe fallback if plans not loaded, otherwise check feature
                        const isAllowed = (typeof LocatorXPlans !== 'undefined') ?
                            LocatorXPlans.FEATURES[plan].includes('ui.settings.excludeNumbers') || LocatorXPlans.FEATURES[plan] === 'ALL' :
                            false; // Default to blocked if unknown

                        if (!isAllowed) {
                            // Enforce default behavior (Exclude = true) and disable
                            excludeNumbersCfg.checked = true;
                            excludeNumbersCfg.disabled = true;
                            excludeNumbersCfg.parentElement.style.opacity = '0.6';
                            excludeNumbersCfg.parentElement.title = 'Upgrade to Pro to customize this setting';
                            this.syncConfigToTab({ excludeNumbers: true });
                        } else {
                            // User allowed, load stored preference
                            const val = result.excludeNumbers !== undefined ? result.excludeNumbers : true;
                            excludeNumbersCfg.checked = val;
                            excludeNumbersCfg.disabled = false;
                            excludeNumbersCfg.parentElement.style.opacity = '1';
                            excludeNumbersCfg.parentElement.title = '';
                            this.syncConfigToTab({ excludeNumbers: val });
                        }
                    });
                };

                // Initial load
                updateState();

                // Listen for changes (User toggles)
                excludeNumbersCfg.addEventListener('change', () => {
                    const val = excludeNumbersCfg.checked;
                    chrome.storage.local.set({ excludeNumbers: val });
                    this.syncConfigToTab({ excludeNumbers: val });
                });

                // Listen for Auth changes (User upgrades/logs and re-enables feature)
                chrome.runtime.onMessage.addListener((message) => {
                    if (message.action === 'AUTH_STATE_CHANGED') {
                        updateState();
                    }
                });
            }
        },

        setupTimestampSetting() {
            const showTimestampCfg = document.getElementById('showTimestampCfg');
            if (showTimestampCfg) {
                const updateState = () => {
                    chrome.storage.local.get(['showTimestamp'], (result) => {
                        const val = result.showTimestamp !== undefined ? result.showTimestamp : false;
                        this.showTimestamp = val;
                        showTimestampCfg.checked = val;
                        this.toggleTimestampColumn(val);
                    });
                };

                updateState();

                // Modified listener for showTimestampCfg
                showTimestampCfg.addEventListener('change', (e) => {
                    this.showTimestamp = e.target.checked;
                    chrome.storage.local.set({ showTimestamp: this.showTimestamp });
                    this.updateTable();
                });

            }
        },

        toggleTimestampColumn(show) {
            const cells = document.querySelectorAll('.time-column');
            cells.forEach(cell => {
                if (show) cell.classList.remove('hidden');
                else cell.classList.add('hidden');
            });
        },

        setupSmartCorrectionSetting() {
            const smartCorrectCfg = document.getElementById('smartCorrectCfg');
            if (smartCorrectCfg) {
                const updateState = () => {
                    chrome.storage.local.get(['smartCorrectEnabled', 'user'], (result) => {
                        const user = result.user || { plan: 'free' };
                        const plan = user.plan || 'free';

                        // Check if feature is allowed for current plan
                        const isAllowed = (typeof planService !== 'undefined') ?
                            planService.isEnabled('module.smartCorrect') : false;

                        if (!isAllowed) {
                            // Enforce disabled for Free users
                            smartCorrectCfg.checked = false;
                            smartCorrectCfg.disabled = true;
                            smartCorrectCfg.parentElement.style.opacity = '0.6';
                            smartCorrectCfg.parentElement.title = 'Upgrade to Pro to enable Smart Correction';
                        } else {
                            // Pro users: load stored preference (default: true)
                            const val = result.smartCorrectEnabled !== undefined ? result.smartCorrectEnabled : true;
                            smartCorrectCfg.checked = val;
                            smartCorrectCfg.disabled = false;
                            smartCorrectCfg.parentElement.style.opacity = '1';
                            smartCorrectCfg.parentElement.title = 'Automatically suggest corrections for typos in locators';
                        }
                    });
                };

                // Initial load
                updateState();

                // Listen for user toggles
                smartCorrectCfg.addEventListener('change', () => {
                    const val = smartCorrectCfg.checked;
                    chrome.storage.local.set({ smartCorrectEnabled: val });
                });

                // Listen for auth changes (user upgrades/downgrades)
                chrome.runtime.onMessage.addListener((message) => {
                    if (message.action === 'AUTH_STATE_CHANGED') {
                        updateState();
                    }
                });
            }
        },

        setupMatchLimitSetting() {
            const maxMatchLimitCfg = document.getElementById('maxMatchLimitCfg');
            if (maxMatchLimitCfg) {
                const maxCap = (typeof LocatorXConfig !== 'undefined') ? LocatorXConfig.LIMITS.MAX_MATCH_DEFAULT : 500;
                maxMatchLimitCfg.setAttribute('max', maxCap);
                chrome.storage.local.get(['maxMatchLimit'], (result) => {
                    let val = result.maxMatchLimit !== undefined ? result.maxMatchLimit : 150;
                    if (val > maxCap) val = maxCap;

                    maxMatchLimitCfg.value = val;
                    this.syncConfigToTab({ maxMatchLimit: val });
                    if (val !== result.maxMatchLimit) {
                        chrome.storage.local.set({ maxMatchLimit: val });
                    }
                });

                maxMatchLimitCfg.addEventListener('change', (e) => {
                    let val = parseInt(e.target.value);
                    if (isNaN(val)) val = 150;

                    const corrected = Math.min(Math.max(val, 10), maxCap);
                    if (val !== corrected) {
                        maxMatchLimitCfg.value = corrected;
                        val = corrected;
                        if (corrected === maxCap) {
                            LocatorX.notifications.show(`Max highlight limit is capped at ${maxCap} for performance.`, 'warning');
                        }
                    } else {
                        LocatorX.notifications.show(`Max highlights updated to ${val}`, 'info');
                    }

                    chrome.storage.local.set({ maxMatchLimit: val });
                    this.syncConfigToTab({ maxMatchLimit: val });
                });
            }
        },

        setupBlacklistRegexSetting() {
            const blacklistRegexCfg = document.getElementById('blacklistRegexCfg');
            if (blacklistRegexCfg) {
                chrome.storage.local.get(['blacklistPatterns'], (result) => {
                    const patterns = result.blacklistPatterns || [];
                    blacklistRegexCfg.value = patterns.join('\n');
                    this.syncConfigToTab({ blacklistPatterns: patterns });
                });

                blacklistRegexCfg.addEventListener('change', (e) => {
                    const lines = e.target.value.split('\n')
                        .map(l => l.trim())
                        .filter(l => l.length > 0);
                    
                    chrome.storage.local.set({ blacklistPatterns: lines });
                    this.syncConfigToTab({ blacklistPatterns: lines });
                    LocatorX.notifications.show('Blacklist patterns updated', 'info');
                });
            }
        },

        setupResetBtn() {
            const resetBtn = document.getElementById('resetSettingsBtn');
            if (resetBtn) {
                resetBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const confirmed = await LocatorX.modal.confirm(
                        'Reset Settings',
                        'Are you sure you want to reset all settings to defaults?',
                        { icon: 'bi-exclamation-triangle-fill' }
                    );
                    if (confirmed) await this.reset();
                });
            }
        },

        async reset() {
            // 1. CLEAR STORAGE
            const keysToClear = [
                'enabledFilters',
                'excludeNumbers',
                'showTimestamp',
                'smartCorrectEnabled',
                'maxMatchLimit',
                'locator-x-theme',
                'blacklistPatterns'
            ];

            // Clear Chrome Local Storage
            await new Promise(resolve => chrome.storage.local.remove(keysToClear, resolve));

            // Clear LocalStorage settings specifically (fallback/sync)
            localStorage.removeItem('locator-x-theme');
            localStorage.removeItem('locator-x-settings');

            // 2. RESTORE UI DEFAULTS
            // Framework
            const fwSelect = document.getElementById('frameworkSelect');
            if (fwSelect) fwSelect.value = 'all';

            // Filters (Default: All CORE checked)
            const allCores = LocatorXConfig.FILTER_GROUPS.CORE;
            const coreDomIds = allCores.map(key => this.FILTER_ID_MAP[key]).filter(id => id);

            document.querySelectorAll('.loc-type, .nested-loc-type').forEach(cb => {
                cb.checked = coreDomIds.includes(cb.id);
                cb.disabled = false;
                cb.parentElement.style.opacity = '1';
                cb.parentElement.title = '';
            });

            // Toggles & Inputs
            const excludeNumbersCfg = document.getElementById('excludeNumbersCfg');
            if (excludeNumbersCfg) excludeNumbersCfg.checked = true;

            const showTimestampCfg = document.getElementById('showTimestampCfg');
            if (showTimestampCfg) showTimestampCfg.checked = false;
            this.showTimestamp = false;
            this.toggleTimestampColumn(false);

            const smartCorrectCfg = document.getElementById('smartCorrectCfg');
            if (smartCorrectCfg) smartCorrectCfg.checked = true;

            const maxMatchLimitCfg = document.getElementById('maxMatchLimitCfg');
            if (maxMatchLimitCfg) maxMatchLimitCfg.value = 150;

            const blacklistRegexCfg = document.getElementById('blacklistRegexCfg');
            if (blacklistRegexCfg) blacklistRegexCfg.value = '';

            // Theme (Reset to Light)
            if (LocatorX.theme) {
                LocatorX.theme.current = 'light';
                LocatorX.theme.apply();
            }

            // 3. FINAL SYNC & UI REFRESH
            this.updateSelectAllState();
            this.updateNestedIcon();
            this.syncConfigToTab({
                excludeNumbers: true,
                maxMatchLimit: 150,
                showTimestamp: false,
                blacklistPatterns: []
            });

            if (LocatorX.tabs.current === 'home') this.updateTable();
            else this.updatePOMTable();

            LocatorX.notifications.success('Settings reset to defaults');
        },

        syncConfigToTab(config) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (tab && tab.id) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'updateConfig',
                        config: config
                    }).catch(() => {
                        // Ignore errors if tab is not ready or content script not loaded
                    });
                }
            });
        },

        loadFilters(tab) {
            const filters = tab === 'pom' ? this.pomFilters : this.homeFilters;

            if (Object.keys(filters).length === 0) return;

            Object.keys(filters).forEach(id => {
                const checkbox = document.getElementById(id);
                if (checkbox) checkbox.checked = filters[id];
            });

            this.updateSelectAllState();
            this.updateNestedIcon();
        },

        FILTER_ID_MAP: {
            'id': 'idLocator',
            'css': 'cssLocator',
            'name': 'nameLocator',
            'tagname': 'tagnameLocator',
            'linkText': 'linkTextLocator',
            'pLinkText': 'pLinkTextLocator',
            'className': 'classNameLocator',
            'relativeXpath': 'relativeXPath', // Parent Checkbox
            'absoluteXpath': 'absoluteLocator',
            'indexedXpath': 'indexedXpathLocator',
            'containsXpath': 'containsXpathLocator',
            'linkTextXpath': 'linkTextXpathLocator',
            'pLinkTextXpath': 'pLinkTextXpathLocator',
            'attributeXpath': 'attributeXpathLocator',
            'startsWithXpath': 'startsWithXpathLocator',
            'cssXpath': 'cssXpathLocator',
            'jsPath': 'jsPathLocator', // Assuming ID for completeness if it exists
            'jquery': 'jqueryLocator'   // Assuming ID for completeness if it exists
        },

        getRelevantFilterIds(tab) {
            // All tabs use CORE now
            return LocatorXConfig.FILTER_GROUPS.CORE;
        },

        updateSelectAllState() {
            const selectAll = document.getElementById('locTypeAll');
            if (!selectAll) return;

            const relevantKeys = this.getRelevantFilterIds(LocatorX.tabs.current);

            // Map Keys to DOM IDs
            const checkableIds = relevantKeys.map(key => this.FILTER_ID_MAP[key]).filter(id => id);

            const checkboxes = checkableIds.map(id => document.getElementById(id)).filter(el => el && !el.disabled);

            if (checkboxes.length === 0) return;

            const allChecked = checkboxes.every(cb => cb.checked);
            const noneChecked = checkboxes.every(cb => !cb.checked);

            selectAll.checked = allChecked;
            selectAll.indeterminate = !allChecked && !noneChecked;
        },

        updateFiltersForDependencies() {
            const framework = document.getElementById('frameworkSelect').value;

            // Framework-specific filter rules
            if (framework === 'cypress') {
                this.disableFilter('linkTextLocator');
                this.disableFilter('pLinkTextLocator');
            } else {
                this.enableFilter('linkTextLocator');
                this.enableFilter('pLinkTextLocator');
            }

            if (framework === 'playwright') {
                this.enableFilter('cssLocator');
                this.enableFilter('xpathLocator');
            }

            // Update tables based on current tab
            if (LocatorX.tabs.current === 'home') { this.updateTable(); }
            else { this.updatePOMTable(); }
        },

        disableFilter(filterId) {
            const checkbox = document.getElementById(filterId);
            if (checkbox) {
                checkbox.checked = false;
                checkbox.disabled = true;
                checkbox.parentElement.style.opacity = '0.5';
            }
        },

        enableFilter(filterId) {
            const checkbox = document.getElementById(filterId);
            if (checkbox) {
                checkbox.disabled = false;
                checkbox.parentElement.style.opacity = '1';
            }
        },

        setupSelectAll() {
            const selectAll = document.getElementById('locTypeAll');
            // const nestedCheckboxes = document.querySelectorAll('.nested-loc-type'); // Not needed if we map all

            if (selectAll) {
                selectAll.addEventListener('change', () => {
                    const relevantKeys = this.getRelevantFilterIds(LocatorX.tabs.current);

                    relevantKeys.forEach(key => {
                        const id = this.FILTER_ID_MAP[key];
                        if (!id) return;

                        const checkbox = document.getElementById(id);
                        // Only toggle if not disabled
                        if (checkbox && !checkbox.disabled) { checkbox.checked = selectAll.checked; }
                    });

                    this.updateNestedIcon();

                    // Save to storage
                    chrome.storage.local.set({ enabledFilters: this.getEnabledFilterIds() });

                    if (LocatorX.tabs.current === 'home') {
                        this.updateTable();
                    } else if (LocatorX.tabs.current === 'axes') {
                        this.updateTable(); // Reuse table update for axes if needed or just sync
                    } else if (LocatorX.tabs.current === 'pom') {
                        this.updatePOMTable();
                    }
                });
            }
        },

        setupCheckboxes() {
            const checkboxes = document.querySelectorAll('.loc-type');
            const nestedCheckboxes = document.querySelectorAll('.nested-loc-type');

            checkboxes.forEach(cb => {
                cb.addEventListener('change', () => {
                    this.updateSelectAllState();

                    // Save to storage
                    chrome.storage.local.set({ enabledFilters: this.getEnabledFilterIds() });

                    if (LocatorX.tabs.current === 'home') {
                        this.updateTable();
                    } else {
                        this.updatePOMTable();
                    }
                });
            });

            // Special handling for Relative XPath parent checkbox
            const relativeXPath = document.getElementById('relativeXPath');
            if (relativeXPath) {
                relativeXPath.addEventListener('change', () => {
                    if (relativeXPath.checked) {
                        const defaultXpath = document.getElementById('relativeXpathLocator');
                        if (defaultXpath && !defaultXpath.checked) defaultXpath.checked = true;
                    }
                    this.updateNestedIcon();
                    chrome.storage.local.set({ enabledFilters: this.getEnabledFilterIds() });

                    if (LocatorX.tabs.current === 'home') this.updateTable();
                    else this.updatePOMTable();
                });
            }

            nestedCheckboxes.forEach(cb => {
                cb.addEventListener('change', () => {
                    const relativeXPath = document.getElementById('relativeXPath');
                    const anyNested = Array.from(nestedCheckboxes).some(c => c.checked);

                    if (relativeXPath) relativeXPath.checked = anyNested;
                    this.updateNestedIcon();
                    this.updateSelectAllState();

                    // Save to storage
                    chrome.storage.local.set({ enabledFilters: this.getEnabledFilterIds() });

                    if (LocatorX.tabs.current === 'home') this.updateTable();
                    else this.updatePOMTable();
                });
            });
        },



        updateTable() {
            const tbody = document.querySelector('.locator-table tbody');
            if (!tbody) return;

            const checkedTypes = this.getCheckedTypes();
            const enabledIds = this.getEnabledFilterIds();

            // Save enabled filters to storage
            chrome.storage.local.set({ enabledFilters: enabledIds });

            tbody.innerHTML = '';

            const groupedTypes = [
                LocatorXConfig.STRATEGY_NAMES.relativeXpath,
                LocatorXConfig.STRATEGY_NAMES.containsXpath,
                LocatorXConfig.STRATEGY_NAMES.indexedXpath,
                LocatorXConfig.STRATEGY_NAMES.linkTextXpath,
                LocatorXConfig.STRATEGY_NAMES.pLinkTextXpath,
                LocatorXConfig.STRATEGY_NAMES.attributeXpath,
                LocatorXConfig.STRATEGY_NAMES.startsWithXpath,
                LocatorXConfig.STRATEGY_NAMES.orXpath,
                LocatorXConfig.STRATEGY_NAMES.cssXpath
            ];

            const standardTypes = checkedTypes.filter(t => !groupedTypes.includes(t));
            const activeGroupedTypes = checkedTypes.filter(t => groupedTypes.includes(t));

            // 1. Render Standard Types (Structure Only)
            standardTypes.forEach(type => {
                const row = document.createElement('tr');
                row.setAttribute('data-type', type);
                row.innerHTML = `
                    <td><span class="match-count" data-count="0"></span></td>
                    <td>${type}</td>
                    <td class="lx-editable" data-target="table-cell" style="color: var(--secondary-text); opacity: 0.5;"></td>
                    <td class="time-column ${this.showTimestamp ? '' : 'hidden'}">-</td>
                    <td>
                        <i class="bi-clipboard disabled" title="Copy" role="button" tabindex="0"></i>
                        <i class="bi-bookmark-plus disabled" title="Save" role="button" tabindex="0"></i>
                    </td>
                    `;
                tbody.appendChild(row);
            });

            // 2. Render Grouped Types (Structure Only)
            if (activeGroupedTypes.length > 0) {
                // Determine which strategy to show initially: preserve existing selection if possible
                let currentType = activeGroupedTypes.includes('Default')
                    ? 'Default'
                    : activeGroupedTypes[0];

                // If we have data, we might want to be smarter, but for structure, default is fine.
                // We pass [] as locators so it renders default state
                this.renderGroupRow(tbody, activeGroupedTypes, currentType, []);
            }

            // 3. If we have data, populate it now
            if (this.lastLocators && this.lastLocators.length > 0) {
                this.updateTableData(this.lastLocators);

                // Restore detail and badge
                const detailEl = document.getElementById('homeElementDetail');
                if (detailEl && this.lastElementInfo) {
                    detailEl.textContent = this.lastElementInfo;
                }

                const badge = document.getElementById('elementTypeBadge');
                if (badge) {
                    if (this.lastElementType) {
                        badge.textContent = this.lastElementType;
                        badge.setAttribute('data-type', this.lastElementType);
                        badge.classList.remove('hidden');
                    }
                    else badge.classList.add('hidden');
                }
            }
            this.updatePOMTable();
        },

        updateTableData(locators) {
            const tbody = document.querySelector('.locator-table tbody');
            if (!tbody) return;

            // Update Standard Rows
            const standardRows = tbody.querySelectorAll('tr[data-type]');
            standardRows.forEach(row => {
                const type = row.getAttribute('data-type');
                const locator = locators.find(l => l.type === type);

                const matchCell = row.querySelector('td:nth-child(1) span');
                const valCell = row.querySelector('td:nth-child(3)');
                const actions = row.querySelectorAll('i');

                if (locator) {
                    matchCell.setAttribute('data-count', locator.matches);
                    matchCell.textContent = locator.matches;

                    const displayValue = this.formatLocator(locator.locator, type);
                    valCell.innerHTML = `<span class="locator-wrapper"> <span class="locator-text">${LocatorX.utils.escapeHtml(displayValue)}</span>${this._createWarningIcon(locator.warnings)}</span > `;
                    valCell.title = locator.locator; // Tooltip shows raw

                    valCell.classList.add('locator-cell');
                    valCell.style.color = '';
                    valCell.style.opacity = '1';

                    // Update Time Cell (4th cell)
                    const timeCell = row.querySelector('.time-column');
                    if (timeCell) timeCell.textContent = this.lastMetadata?.timestamp || '-';

                    actions.forEach(btn => btn.classList.remove('disabled'));
                } else {
                    matchCell.setAttribute('data-count', '0');
                    matchCell.textContent = '0';
                    valCell.textContent = '-';
                    valCell.classList.remove('locator-cell');
                    valCell.style.color = 'var(--secondary-text)';
                    valCell.style.opacity = '0.5';

                    const timeCell = row.querySelector('.time-column');
                    if (timeCell) timeCell.textContent = '-';

                    actions.forEach(btn => btn.classList.add('disabled'));
                }
            });

            // Update Group Row
            const groupRow = tbody.querySelector('.strategy-row');
            if (groupRow) {
                const select = groupRow.querySelector('.strategy-dropdown');
                if (select) {
                    const availableTypes = Array.from(select.options).map(o => o.value);

                    // Find best strategy among available types
                    let bestType = null;

                    // 1. Try 'Default' if available and valid
                    const relative = locators.find(l => l.type === 'Default');
                    if (availableTypes.includes('Default') && relative) {
                        bestType = 'Default';
                    } else {
                        // 2. Try first available matching locator
                        const firstMatch = availableTypes.find(t => locators.some(l => l.type === t));
                        // 3. Fallback to first available option
                        bestType = firstMatch || availableTypes[0];
                    }

                    if (bestType) {
                        select.value = bestType;
                        const locator = locators.find(l => l.type === bestType);
                        this.updateGroupRow(groupRow, bestType, locator);

                        // Also update options disabled state maybe?
                        // renderGroupRow used allLocators to set disabled state.
                        // Here we should probably update options too.
                        Array.from(select.options).forEach(opt => {
                            const hasLoc = locators.some(l => l.type === opt.value);
                            opt.disabled = false; // Always enabled per user request 
                        });
                    }
                }
            }
        },

        renderRow(tbody, type, locator) {
            const row = document.createElement('tr');
            if (locator) {
                row.innerHTML = `
                    ${this._createMatchCell(locator.matches)}
                    <td>${LocatorX.utils.escapeHtml(locator.type)}</td>
                    <td class="lx-editable locator-cell" data-target="table-cell">
                        <span class="locator-wrapper">
                            <span class="locator-text">${LocatorX.utils.escapeHtml(locator.locator)}</span>
                            ${this._createWarningIcon(locator.warnings)}
                        </span>
                    </td>
                    <td class="time-column ${this.showTimestamp ? '' : 'hidden'}">${this.lastMetadata?.timestamp || '-'}</td>
                    ${this._createActionCell(false)}
`;
            } else {
                row.innerHTML = `
                    ${this._createMatchCell(0)}
                    <td>${LocatorX.utils.escapeHtml(type)}</td>
                    <td class="lx-editable locator-cell lx-text-disabled" data-target="table-cell"></td>
                    <td class="time-column ${this.showTimestamp ? '' : 'hidden'}">-</td>
                    ${this._createActionCell(true)}
`;
            }
            tbody.appendChild(row);
        },

        _createWarningIcon(warnings) {
            if (!warnings || warnings.length === 0) return '';
            const title = warnings.join('\n');
            return `<i class="bi bi-exclamation-circle-fill warning-icon" title = "${title}"></i > `;
        },

        renderGroupRow(tbody, availableTypes, currentType, allLocators) {
            const locator = allLocators.find(l => l.type === currentType);
            const row = document.createElement('tr');
            row.className = 'strategy-row';

            // Match Count
            const matchCount = locator ? locator.matches : '0';

            // Dropdown Options
            const options = availableTypes.map(type => {
                const typeLocator = allLocators.find(l => l.type === type);
                const isDisabled = false; // Always enabled per user request
                return `<option value = "${LocatorX.utils.escapeHtml(type)}" ${type === currentType ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}> ${LocatorX.utils.escapeHtml(type)}</option > `;
            }).join('');

            const locatorValue = locator ? `<span class="locator-wrapper"> <span class="locator-text">${LocatorX.utils.escapeHtml(locator.locator)}</span>${this._createWarningIcon(locator.warnings)}</span > ` : '-';
            const locatorStyle = locator ? '' : '';
            const locatorClass = locator ? 'locator-cell' : 'lx-text-disabled';
            const actionClass = locator ? '' : 'disabled';

            row.innerHTML = `
                ${this._createMatchCell(matchCount, 'strategyMatchCount')}
                <td class="strategy-cell">
                    <select id="strategySelect" class="strategy-dropdown">
                        ${options}
                    </select>
                </td>
                <td class="lx-editable ${locatorClass}" id="strategyLocator" data-target="table-cell" ${locatorStyle}>${locatorValue}</td>
                <td class="time-column ${this.showTimestamp ? '' : 'hidden'}">${this.lastMetadata?.timestamp || '-'}</td>
                ${this._createActionCell(!locator)}
            `;

            tbody.appendChild(row);

            // Add Event Listener for Dropdown
            const select = row.querySelector('#strategySelect');
            if (select) {
                select.addEventListener('change', (e) => {
                    const newType = e.target.value;
                    const locators = this.lastLocators || [];
                    const newLocator = locators.find(l => l.type === newType);
                    this.updateGroupRow(row, newType, newLocator);
                });
            }
        },

        updateGroupRow(row, type, locator) {
            const matchBadge = row.querySelector('#strategyMatchCount');
            const locatorCell = row.querySelector('#strategyLocator');
            const actions = row.querySelectorAll('.bi-clipboard, .bi-bookmark-plus');

            if (locator) {
                matchBadge.setAttribute('data-count', locator.matches);
                matchBadge.textContent = locator.matches;

                const displayValue = this.formatLocator(locator.locator, type);
                locatorCell.innerHTML = `<span class="locator-wrapper"> <span class="locator-text">${LocatorX.utils.escapeHtml(displayValue)}</span>${this._createWarningIcon(locator.warnings)}</span > `;

                // Store raw locator for copy/save actions if needed, or we copy formatted? 
                // Usually user wants to copy the code.
                locatorCell.title = locator.locator; // Tooltip shows raw

                locatorCell.classList.add('locator-cell');
                locatorCell.classList.remove('lx-text-disabled');
                locatorCell.style.color = '';
                locatorCell.style.opacity = '';

                actions.forEach(btn => btn.classList.remove('disabled'));
            } else {
                matchBadge.setAttribute('data-count', '0');
                matchBadge.textContent = '0';
                locatorCell.textContent = '-';
                locatorCell.classList.remove('locator-cell');
                locatorCell.classList.add('lx-text-disabled');
                locatorCell.style.color = '';
                locatorCell.style.opacity = '';

                actions.forEach(btn => btn.classList.add('disabled'));
            }
        },

        formatLocator(locatorValue, type) {
            if (typeof LocatorXPatterns === 'undefined') return locatorValue;

            const framework = document.getElementById('frameworkSelect') ? document.getElementById('frameworkSelect').value : 'selenium-java';
            // We assume the first pattern in the framework is the "default" for table display
            // unless we add specific pattern selection to the table rows later.
            const frameworkPatterns = LocatorXPatterns.getPatterns(framework);
            if (!frameworkPatterns || frameworkPatterns.length === 0) return locatorValue;

            // Strategy mapping to match Pattern terminology
            const standardType = type === 'ClassName' ? 'className' : type === 'TagName' ? 'tagName' : type.toLowerCase();
            
            return LocatorXPatterns.generate(framework, frameworkPatterns[0].id, standardType, locatorValue);
        },

        _createMatchCell(count, id = '') {
            const idAttr = id ? `id="${id}"` : '';
            return `<td><span class="match-count" data-count="${count}" ${idAttr}>${count}</span></td>`;
        },

        _createActionCell(isDisabled) {
            const cls = isDisabled ? 'disabled' : '';
            return `
    <td >
                    <i class="bi-clipboard ${cls}" title="Copy" role="button" tabindex="0"></i>
                    <i class="bi-bookmark-plus ${cls}" title="Save" role="button" tabindex="0"></i>
                </td >
    `;
        },

        displayGeneratedLocators(locators, elementInfo = null, elementType = null, metadata = null) {
            // Check for duplicate (same locators within 500ms)
            const now = Date.now();
            if (this.lastLocators &&
                (now - this.lastLocatorTime < 500) &&
                JSON.stringify(this.lastLocators) === JSON.stringify(locators)) {
                return;
            }
            this.lastLocators = locators;
            this.lastLocatorTime = now;
            this.lastElementInfo = elementInfo;
            this.lastElementType = elementType;
            this.lastMetadata = metadata;

            if (LocatorX.tabs.current === 'home') {
                // Data Update Only!
                this.updateTableData(locators);
                this.updateElementInfo(elementInfo, elementType, metadata);
            } else if (LocatorX.tabs.current === 'pom') {
                this.handlePOMDisplay(locators, metadata);
            }
        },

        updateElementInfo(info, type, metadata = null) {
            // Update detail text if available
            const detailText = document.getElementById('homeElementDetail');
            if (detailText) {
                if (metadata && metadata.isCrossOrigin) {
                    detailText.innerHTML = `<span style = "color: var(--danger); font-weight: bold;"> [Security Warning]</span > Element is inside a cross - origin iframe.Browser security blocks access. <br /> <small style="opacity: 0.7;">Only the iframe selector itself can be captured.</small>`;
                } else {
                    detailText.textContent = info || 'No element selected';
                }
            }

            // Update Element Type Badge
            const badge = document.getElementById('elementTypeBadge');
            if (badge) {
                let displayType = type;
                let isDynamic = false;

                if (metadata) {
                    if (metadata.isInIframe) {
                        displayType = metadata.isCrossOrigin ? 'Iframe (Cross-Origin)' : 'Iframe (Captured)';
                    }
                    if (metadata.isDynamic) isDynamic = true;
                }

                if (displayType && displayType !== 'Normal') {
                    badge.textContent = displayType;
                    badge.setAttribute('data-type', displayType);
                    badge.classList.remove('hidden');

                    // Reset dynamic styling for standard badge
                    badge.style.background = '';
                    badge.style.color = '';
                } else if (isDynamic) {
                    // Show Dynamic Badge if standard type is normal
                    badge.textContent = 'Dynamic Element';
                    badge.setAttribute('data-type', 'dynamic'); // For CSS styling if needed
                    badge.classList.remove('hidden');

                    // distinct style for dynamic
                    badge.style.background = '#fff3cd'; // Light yellow
                    badge.style.color = '#856404';      // Dark yellow/brown
                    badge.style.border = '1px solid #ffeeba';
                } else {
                    badge.classList.add('hidden');
                }

                // If both (e.g. Iframe + Dynamic), append dynamic warning?
                // For simplicity, Iframe status takes precedence as it affects capture strategy more.
                // But we could append text:
                if (displayType && displayType !== 'Normal' && isDynamic) badge.textContent += ' (Dynamic)';
            }
        },

        async handlePOMDisplay(locators, metadata = null) {
            // Check if page selected
            let currentPage = await LocatorX.pom.getCurrentPage();

            // Auto-create page if none exists or none selected
            if (!currentPage) {
                LocatorX.modal.prompt(
                    'Create First Page',
                    'Page 1',
                    'No pages exist yet. Enter a name to create your first POM page:'
                )
                    .then(async name => {
                        if (name) {
                            // Create page manually to get the ID and object
                            const newPage = {
                                id: `pom_${Date.now()} `,
                                name: name,
                                locators: []
                            };
                            await LocatorX.core.savePOMPage(newPage);
                            await LocatorX.pom.loadPages();
                            await LocatorX.pom.switchPage(newPage.id);
                            currentPage = newPage;

                            // Now add the locators
                            await this.addLocatorsToPage(currentPage, locators, metadata);
                        }
                    });
                return;
            }

            await this.addLocatorsToPage(currentPage, locators, metadata);
            await this.updatePOMTable();
        },

        async addLocatorsToPage(page, locators, metadata = null) {
            const tbody = document.querySelector('.pom-container .pom-table tbody');
            if (!tbody) return;

            const isDuplicate = page.locators.some(l => {
                const existingLocators = Array.isArray(l) ? l : l.locators;
                return JSON.stringify(existingLocators) === JSON.stringify(locators);
            });

            if (isDuplicate) {
                LocatorX.notifications.warn(`Already added to "${page.name}"`);
                return;
            }

            // Add to storage
            page.locators.push({
                locators,
                timestamp: metadata?.timestamp || new Date().toLocaleTimeString('en-US', { hour12: false })
            });
            await LocatorX.core.savePOMPage(page);

            // Re-render
            await LocatorX.pom.renderTable(page.id);
        },

        getEnabledFilterIds() {
            const enabledIds = [];
            const checkboxes = document.querySelectorAll('.loc-type:checked, .nested-loc-type:checked');
            checkboxes.forEach(cb => enabledIds.push(cb.id));
            return enabledIds;
        },

        async updatePOMTable() {
            const table = document.querySelector('.pom-table');
            if (!table) return;

            // 1. CLEAR & BUILD HEADER
            let thead = table.querySelector('thead');
            if (!thead) {
                thead = document.createElement('thead');
                table.appendChild(thead);
            }
            thead.innerHTML = '';

            const checkedTypes = this.getCheckedTypes();
            const groupedTypes = [
                LocatorXConfig.STRATEGY_NAMES.relativeXpath,
                LocatorXConfig.STRATEGY_NAMES.containsXpath,
                LocatorXConfig.STRATEGY_NAMES.indexedXpath,
                LocatorXConfig.STRATEGY_NAMES.linkTextXpath,
                LocatorXConfig.STRATEGY_NAMES.pLinkTextXpath,
                LocatorXConfig.STRATEGY_NAMES.attributeXpath,
                LocatorXConfig.STRATEGY_NAMES.startsWithXpath,
                LocatorXConfig.STRATEGY_NAMES.orXpath,
                LocatorXConfig.STRATEGY_NAMES.cssXpath
            ];

            const standardTypes = checkedTypes.filter(t => !groupedTypes.includes(t));
            const hasGrouped = checkedTypes.some(t => groupedTypes.includes(t));

            // Store active structure for Row Renderer to use
            this.pomStructure = {
                standard: standardTypes,
                hasGrouped: hasGrouped,
                groupedTypes: checkedTypes.filter(t => groupedTypes.includes(t)) // Pass enabled options for dropdown
            };

            // Build Header Row
            const headerRow = document.createElement('tr');
            headerRow.innerHTML = '<th>#</th>'; // Index

            // Standard Headers
            standardTypes.forEach(type => {
                headerRow.innerHTML += `<th>${type}</th>`;
            });

            // Grouped Header
            if (hasGrouped) {
                headerRow.innerHTML += `<th>Relative XPath</th>`;
            }

            headerRow.innerHTML += `<th class="time-column ${this.showTimestamp ? '' : 'hidden'}">Time</th>`;
            headerRow.innerHTML += '<th>Actions</th>';
            thead.appendChild(headerRow);

            // 2. TRIGGER ROW UPDATE (re-render current page with new structure)
            if (LocatorX.pom && LocatorX.pom.currentPageId) {
                await LocatorX.pom.renderTable(LocatorX.pom.currentPageId);
            }
        },

        getCheckedTypes() {
            const types = [];
            const typeMap = {
                'idLocator': 'ID',
                'nameLocator': 'Name',
                'tagnameLocator': 'TagName',
                'classNameLocator': 'ClassName',
                'cssLocator': 'CSS',
                'linkTextLocator': 'Link Text',
                'pLinkTextLocator': 'Partial Link Text',
                'absoluteLocator': 'Absolute XPath'
            };

            Object.keys(typeMap).forEach(id => {
                const checkbox = document.getElementById(id);
                if (checkbox && checkbox.checked) {
                    types.push(typeMap[id]);
                }
            });

            const relativeXPath = document.getElementById('relativeXPath');
            if (relativeXPath && relativeXPath.checked) {
                const nestedTypes = {
                    'relativeXpathLocator': LocatorXConfig.STRATEGY_NAMES.relativeXpath,
                    'containsXpathLocator': LocatorXConfig.STRATEGY_NAMES.containsXpath,
                    'indexedXpathLocator': LocatorXConfig.STRATEGY_NAMES.indexedXpath,
                    'linkTextXpathLocator': LocatorXConfig.STRATEGY_NAMES.linkTextXpath,
                    'pLinkTextXpathLocator': LocatorXConfig.STRATEGY_NAMES.pLinkTextXpath,
                    'attributeXpathLocator': LocatorXConfig.STRATEGY_NAMES.attributeXpath,
                    'startsWithXpathLocator': LocatorXConfig.STRATEGY_NAMES.startsWithXpath,
                    'orXpathLocator': LocatorXConfig.STRATEGY_NAMES.orXpath,
                    'cssXpathLocator': LocatorXConfig.STRATEGY_NAMES.cssXpath
                };

                Object.keys(nestedTypes).forEach(id => {
                    const checkbox = document.getElementById(id);
                    if (checkbox && checkbox.checked) {
                        types.push(nestedTypes[id]);
                    }
                });
            }

            return types;
        },

        setupRelativeXPath() {
            const arrow = document.getElementById('relativeDropdownArrow');
            const nested = document.getElementById('relativeXPathNested');
            const checkbox = document.getElementById('relativeXPath');
            const nestedIcon = document.getElementById('nestedSelectAll');

            if (arrow && nested) {
                arrow.addEventListener('click', e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const isVisible = nested.style.display === 'block';

                    if (isVisible) {
                        nested.style.display = 'none';
                        arrow.classList.remove('expanded');
                    } else {
                        // Calculate position relative to viewport
                        const rect = arrow.getBoundingClientRect();
                        nested.style.top = `${rect.bottom + 2}px`;
                        nested.style.left = `${rect.right - 90}px`; // Align right edge
                        nested.style.display = 'block';
                        arrow.classList.add('expanded');
                    }
                });

                nested.addEventListener('click', e => e.stopPropagation());
            }

            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    if (!checkbox.checked) {
                        document.querySelectorAll('.nested-loc-type').forEach(cb => cb.checked = false);
                    }
                });
            }

            if (nestedIcon) {
                nestedIcon.addEventListener('click', e => {
                    e.stopPropagation();
                    const nestedCheckboxes = document.querySelectorAll('.nested-loc-type');
                    const allChecked = Array.from(nestedCheckboxes).every(cb => cb.checked);
                    nestedCheckboxes.forEach(cb => cb.checked = !allChecked);
                    this.updateNestedIcon();
                });
            }

            document.addEventListener('click', e => {
                const container = document.querySelector('.relative-xpath-container');
                if (container && !container.contains(e.target) && !nested.contains(e.target)) {
                    nested.style.display = 'none';
                    arrow.classList.remove('expanded');
                }
            });
        },

        updateNestedIcon() {
            const icon = document.getElementById('nestedSelectAll');
            const checkboxes = document.querySelectorAll('.nested-loc-type');

            if (icon) {
                const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                icon.className = allChecked ?
                    'bi-check2-square nested-select-all all-selected' :
                    'bi-square nested-select-all';
            }
        }
    },

    codeMode: {
        presets: [
            '@FindBy({type}="{value}") @CacheLookup private WebElement selectorname;',
            'driver.findElement(By.{type}("{value}"))',
            'cy.get("{value}")',
            'driver.find_element(*(By.{TYPE},"{value}"))',
            "await page.locator('{type}={value}')",
            'FindBy({type}="{value}")'
        ],

        init() {
            const navBtn = document.getElementById('navCodeMode');
            const section = document.getElementById('codeModeSection');
            const input = document.getElementById('codeModeInput');
            const dropdown = document.getElementById('codeModeDropdown');

            if (navBtn && section) {
                navBtn.addEventListener('click', () => {
                    const isHidden = section.classList.contains('hidden');
                    if (isHidden) {
                        section.classList.remove('hidden');
                        navBtn.classList.add('active');
                    } else {
                        section.classList.add('hidden');
                        navBtn.classList.remove('active');
                    }
                });
            }

            if (input && dropdown) {
                const showDropdown = () => {
                    const val = input.value.toLowerCase();
                    dropdown.innerHTML = '';
                    this.presets.forEach(p => {
                        if (p.toLowerCase().includes(val)) {
                            const div = document.createElement('div');
                            div.className = 'dropdown-item';
                            div.innerHTML = `<span class="item-text">${p}</span>`;
                            div.addEventListener('mousedown', (e) => {
                                e.preventDefault(); // Prevent blur
                                input.value = p;
                                dropdown.style.display = 'none';
                                dropdown.classList.remove('visible');

                                // Update table immediately
                                if (LocatorX.filters && LocatorX.filters.lastLocators) {
                                    LocatorX.filters.updateTableData(LocatorX.filters.lastLocators);
                                }
                            });
                            dropdown.appendChild(div);
                        }
                    });

                    if (dropdown.children.length > 0) {
                        dropdown.style.display = 'block';
                        dropdown.classList.add('visible');
                        LocatorX.utils.autoFlip(input, dropdown);
                    } else {
                        dropdown.style.display = 'none';
                        dropdown.classList.remove('visible');
                    }
                };

                input.addEventListener('focus', showDropdown);
                input.addEventListener('input', () => {
                    showDropdown();
                    // Refreshes the table with new pattern
                    if (LocatorX.filters && LocatorX.filters.lastLocators) {
                        LocatorX.filters.updateTableData(LocatorX.filters.lastLocators);
                    }
                });

                input.addEventListener('blur', () => {
                    setTimeout(() => {
                        dropdown.style.display = 'none';
                        dropdown.classList.remove('visible');
                    }, 200);
                });
            }
        }
    },

    dependencies: {
        init() {
            const framework = document.getElementById('frameworkSelect');

            if (framework) {
                framework.addEventListener('change', e => {
                    this.updateDisplay('frameworkDisplay', e.target.value);
                    LocatorX.filters.updateFiltersForDependencies();
                });
                this.updateDisplay('frameworkDisplay', framework.value);
            }
        },

        updateDisplay(displayId, value) {
            const display = document.getElementById(displayId);
            if (display) display.textContent = value;
        }
    },

    settings: {
        init() {
            // Note: resetSettingsBtn click is handled by filters.setupResetBtn()
            // to avoid duplicate handlers and conflicting reset flows.
        },

        async resetToDefaults() {
            const confirmed = await LocatorX.modal.confirm(
                'Reset Settings',
                'Are you sure you want to reset all settings to their defaults?',
                { icon: 'bi-arrow-counterclockwise', confirmText: 'Reset', confirmClass: 'lx-yes' }
            );

            if (!confirmed) return;

            // 1. Reset Framework to Selenium
            const frameworkSelect = document.getElementById('frameworkSelect');
            if (frameworkSelect) {
                frameworkSelect.value = 'selenium';
                // Trigger change event to update dependencies display and filters availability
                frameworkSelect.dispatchEvent(new Event('change'));
            }

            // 2. Check all AVAILABLE checkboxes (respecting the framework constraints)
            // The change event above invalidates disabled states, so we can select non-disabled ones
            const checkboxes = document.querySelectorAll('.loc-type:not(:disabled), .nested-loc-type:not(:disabled)');
            checkboxes.forEach(cb => cb.checked = true);

            // Update parent checkboxes state
            const selectAll = document.getElementById('locTypeAll');
            if (selectAll) selectAll.checked = true;

            const relativeXPath = document.getElementById('relativeXPath');
            if (relativeXPath && !relativeXPath.disabled) relativeXPath.checked = true;

            LocatorX.filters.updateNestedIcon();

            // 3. Reset Scope to Home
            if (LocatorX.tabs.current !== 'home') {
                LocatorX.tabs.switch('home');
            }

            // 4. Update Storage and Table
            // We save the current "all checked" state
            chrome.storage.local.set({ enabledFilters: LocatorX.filters.getEnabledFilterIds() });

            LocatorX.filters.updateTable();

            // 5. Notification
            LocatorX.notifications.success('Settings reset to defaults');
        }
    },

    // Search Suggestions
    search: {
        manager: null,
        selectedIndex: -1,

        init() {
            if (!this.manager && typeof SuggestionManager !== 'undefined') {
                this.manager = new SuggestionManager();
            }

            const input = document.getElementById('searchInput');
            const dropdown = document.getElementById('searchDropdown');

            if (input && dropdown) {
                input.addEventListener('input', () => this.handleInput(input, dropdown));
                input.addEventListener('keydown', (e) => this.handleKeydown(e, input, dropdown));
                input.addEventListener('blur', () => {
                    setTimeout(() => {
                        dropdown.classList.remove('visible');
                        setTimeout(() => dropdown.style.display = 'none', 150);
                    }, 200);
                });
                input.addEventListener('focus', () => {
                    if (input.value.length > 0) {
                        this.handleInput(input, dropdown);
                    }
                });
            }
        },

        async handleInput(input, dropdown) {
            const value = input.value.trim();
            if (value.length === 0) {
                dropdown.classList.remove('visible');
                dropdown.style.display = 'none';
                const badge = document.getElementById('searchMatchBadge');
                if (badge) {
                    badge.setAttribute('data-count', '0');
                    badge.textContent = '0';
                    badge.classList.add('hidden');
                }
                // Also clear highlights on page
                if (LocatorX.evaluator) {
                    LocatorX.evaluator.highlight('', 'highlightMatches');
                }
                return;
            }

            // Sync with current DOM structure for truly "related" suggestions
            await this.refreshDOMContext();

            // Use SuggestionManager for precise filtering
            const suggestions = this.manager.getSuggestions(value);

            // Trigger live evaluation (debounced)
            clearTimeout(this.evalTimeout);
            this.evalTimeout = setTimeout(() => {
                this.performEvaluation(value, suggestions, dropdown);
            }, 300);

            this.renderDropdown(suggestions, value, dropdown, null);
            dropdown.style.display = 'block';
            dropdown.offsetHeight;
            dropdown.classList.add('visible');

            LocatorX.utils.autoFlip(input, dropdown);

            this.selectedIndex = -1;
        },

        async refreshDOMContext() {
            return new Promise((resolve) => {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    const tab = tabs[0];
                    if (tab && tab.id) {
                        chrome.tabs.sendMessage(tab.id, { action: 'getPageStructure' }, (response) => {
                            if (chrome.runtime.lastError) {
                                // Context might be invalidated or tab loading
                                resolve();
                                return;
                            }
                            if (response) {
                                this.manager.updatePageContext(response);
                            }
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                });
            });
        },

        async performEvaluation(query, suggestions, dropdown) {
            const badge = document.getElementById('searchMatchBadge');
            let foundResult = false;

            LocatorX.utils.evaluate(query, {
                badge: badge,
                callback: (totalCount, response) => {
                    if (response && response.count === 1 && !foundResult) {
                        foundResult = true;
                        LocatorX.filters.updateElementInfo(response.elementInfo, response.elementType);
                        if (response.locators) {
                            LocatorX.filters.displayGeneratedLocators(
                                response.locators,
                                response.elementInfo,
                                response.elementType,
                                response.metadata
                            );
                        }
                    }
                    LocatorX.search.finalizeEvaluation(totalCount, suggestions, query, dropdown, badge, foundResult, response ? response.suggestedLocator : null);
                }
            });
        },

        finalizeEvaluation(totalCount, suggestions, query, dropdown, badge, foundResult, suggestedLocator = null) {
            LocatorX.search.renderDropdown(suggestions, query, dropdown, totalCount, suggestedLocator);

            if (!foundResult && totalCount !== 1) {
                LocatorX.filters.updateElementInfo(null, null);
                LocatorX.filters.displayGeneratedLocators([], null, null, null);
            }

            // Navigation Controls Logic
            const prevBtn = document.getElementById('prevMatchBtn');
            const nextBtn = document.getElementById('nextMatchBtn');

            if (prevBtn && nextBtn) {
                // Check if user has access to navigation feature
                const isPremium = typeof window.planService !== 'undefined' &&
                    window.planService.isEnabled('ui.matchtravel');

                if (isPremium && totalCount > 1) {
                    prevBtn.classList.remove('hidden');
                    nextBtn.classList.remove('hidden');
                } else {
                    prevBtn.classList.add('hidden');
                    nextBtn.classList.add('hidden');
                }
            }
        },

        handlePrevMatch() {
            if (LocatorX.evaluator) {
                LocatorX.evaluator.navigate(-1);
            }
        },

        handleNextMatch() {
            if (LocatorX.evaluator) {
                LocatorX.evaluator.navigate(1);
            }
        },

        highlightMatchesInAllFrames(query) {
            LocatorX.utils.highlight(query, 'highlightMatches', 'home', 0);
        },

        clearMatchHighlightsInAllFrames() {
            LocatorX.utils.highlight('', 'clearMatchHighlights');
        },

        renderDropdown(matches, query, dropdown, activeMatchCount, suggestedLocator = null) {
            dropdown.innerHTML = '';

            // 0. Smart Correction Suggestion
            if (suggestedLocator && suggestedLocator !== query) {
                const suggestionItem = document.createElement('div');
                suggestionItem.className = 'dropdown-item suggestion-item';
                suggestionItem.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
                suggestionItem.style.background = 'rgba(255, 193, 7, 0.1)'; // Amber tint for suggestion

                suggestionItem.innerHTML = `
                    <div class="dropdown-item-wrapper" style="display: flex; align-items: center; width: 100%; gap: 8px;">
                        <div class="match-count" style="background:none; color:#ffc107;">⚡</div>
                        <span class="item-text" style="flex: 1; min-width: 0;">
                            <span style="opacity:0.7">Did you mean:</span> 
                            <strong>${LocatorX.utils.escapeHtml(suggestedLocator)}</strong>
                        </span>
                    </div>
                `;
                suggestionItem.addEventListener('click', () => {
                    const input = document.getElementById('searchInput');
                    input.value = suggestedLocator;
                    // Trigger evaluation for the correction
                    this.handleInput(input, dropdown);
                    input.focus();
                });
                dropdown.appendChild(suggestionItem);
            }

            // Add "Live Test" item if query looks like a selector
            // Add "Live Test" item if query looks like a selector AND not already in matches
            // Check for exact duplicate in suggestions to avoid double entry
            const isDuplicate = matches.some(m =>
                (m.locator && m.locator.toLowerCase() === query.toLowerCase()) ||
                (m.name && m.name.toLowerCase() === query.toLowerCase()) ||
                (m.type && m.type.toLowerCase() === query.toLowerCase())
            );

            if (query.length > 2 && !isDuplicate) {
                const liveItem = document.createElement('div');
                liveItem.className = 'dropdown-item live-test-item';
                const countVal = typeof activeMatchCount === 'number' ? activeMatchCount : '...';
                liveItem.innerHTML = `
                    <div class="dropdown-item-wrapper" style="display: flex; align-items: center; width: 100%; gap: 8px;">
                        <div class="match-count" data-count="${countVal}">${countVal}</div>
                        <span class="item-text" style="flex: 1; min-width: 0;"><strong>${LocatorX.utils.escapeHtml(query)}</strong></span>
                    </div>
                `;
                liveItem.addEventListener('click', () => {
                    this.performEvaluation(query, matches, dropdown);
                });
                dropdown.appendChild(liveItem);
            }

            matches.forEach((match, index) => {
                const div = document.createElement('div');
                div.className = 'dropdown-item';
                div.setAttribute('role', 'option');

                const text = match.type;
                const lowerText = text.toLowerCase();
                const queryIndex = lowerText.indexOf(query.toLowerCase());

                let html = '';
                if (queryIndex >= 0) {
                    html = LocatorX.utils.escapeHtml(text.substring(0, queryIndex)) +
                        '<strong>' + LocatorX.utils.escapeHtml(text.substring(queryIndex, queryIndex + query.length)) + '</strong>' +
                        LocatorX.utils.escapeHtml(text.substring(queryIndex + query.length));
                } else {
                    html = LocatorX.utils.escapeHtml(text);
                }

                // Show match count BEFORE the locator as requested
                // Show category if it's not a standard one
                const categoryInfo = ['Tag', 'ID', 'Class', 'Name'].includes(match.category)
                    ? ''
                    : `<span class="category-tag"> (${match.category})</span > `;

                div.innerHTML = `
                    <div class="dropdown-item-wrapper" style="display: flex; align-items: center; width: 100%; gap: 8px;">
                        <div class="match-count" data-count="${match.count}">${match.count}</div>
                        <span class="item-text" style="flex: 1; min-width: 0;">${categoryInfo}${html}</span>
                    </div>
                `;
                div.addEventListener('click', () => {
                    const input = document.getElementById('searchInput');
                    input.value = match.type;
                    dropdown.classList.remove('visible');
                    dropdown.style.display = 'none';
                    this.handleInput(input, dropdown);
                    input.focus();
                });

                // Add hover highlighting
                div.addEventListener('mouseenter', () => {
                    this.highlightMatchesInAllFrames(match.type);
                });

                div.addEventListener('mouseleave', () => {
                    this.clearMatchHighlightsInAllFrames();
                });

                dropdown.appendChild(div);
            });
        },

        handleKeydown(e, input, dropdown) {
            if (!dropdown.classList.contains('visible')) return;

            const items = dropdown.querySelectorAll('.dropdown-item');
            if (items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex + 1) % items.length;
                this.updateSelection(dropdown);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex - 1 + items.length) % items.length;
                this.updateSelection(dropdown);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (this.selectedIndex >= 0) {
                    items[this.selectedIndex].click();
                }
            } else if (e.key === 'Escape') {
                dropdown.classList.remove('visible');
                dropdown.style.display = 'none';
            }
        },

        updateSelection(dropdown) {
            const items = dropdown.querySelectorAll('.dropdown-item');
            items.forEach((item, index) => {
                if (index === this.selectedIndex) {
                    item.classList.add('active');
                    item.setAttribute('aria-selected', 'true');
                    item.scrollIntoView({ block: 'nearest' });
                } else {
                    item.classList.remove('active');
                    item.setAttribute('aria-selected', 'false');
                }
            });
        }
    },

    // Inspect Button Management
    inspect: {
        isActive: false,
        _isDeactivating: false,
        currentMode: 'home',
        trackedTabId: null,


        init() {
            const inspectBtn = document.getElementById('inspectBtn');
            if (inspectBtn) {
                inspectBtn.addEventListener('click', () => this.toggle());
                // Right-click to turn off inspect mode for both home and POM
                inspectBtn.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    if (this.isActive) {
                        this.deactivate();
                    }
                });
            }

            // Listen for messages from content script
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                if (message.action === 'locatorsGenerated') {
                    LocatorX.filters.displayGeneratedLocators(
                        message.locators,
                        message.elementInfo,
                        message.elementType,
                        message.metadata
                    );
                    // Auto-deactivate picking in Home mode after successful capture
                    if (LocatorX.tabs.current === 'home') {
                        this.deactivate();
                    }
                } else if (message.action === 'deactivateInspect') {
                    // Handle ESC key and right-click deactivation from content script
                    this.deactivate();
                } else if (message.action === 'tabNavigated') {
                    if (this.isActive && message.tabId === this.trackedTabId) {
                        this.trackedTabId = null;
                        this.deactivate();
                        LocatorX.notifications.warn('Inspection stopped: page navigated.');
                    }
                } else if (message.action === 'notification') {
                    if (message.type === 'success') LocatorX.notifications.success(message.message);
                    else if (message.type === 'error') LocatorX.notifications.error(message.message);
                } else if (message.action === 'axesAnchorCaptured') {
                    // Update UI for Anchor - Simplified Status
                    const anchorVal = document.getElementById('axesAnchorValue');

                    if (anchorVal) {
                        // Show element tag + ID but cleanly, OR just "Captured" based on request
                        // User said "remove content show text like captured"
                        // We will show "Captured: Tag#ID" for clarity but keep it simple text
                        anchorVal.textContent = `Captured: ${message.elementInfo.tagName} `;
                        anchorVal.style.color = 'var(--text-primary)';
                        anchorVal.style.fontWeight = '500';
                    }

                    // Switch pulse to purple for Target
                    const inspectBtn = document.getElementById('inspectBtn');
                    if (inspectBtn) {
                        inspectBtn.classList.remove('yellow');
                        inspectBtn.classList.add('purple');
                    }

                    // Update Target to show it's next
                    const targetVal = document.getElementById('axesTargetValue');
                    if (targetVal) {
                        targetVal.textContent = 'Select Target...';
                        targetVal.style.color = 'var(--text-secondary)';
                    }

                } else if (message.action === 'axesResult') {
                    // Update UI for Target
                    const targetVal = document.getElementById('axesTargetValue');

                    if (targetVal) {
                        targetVal.textContent = `Captured: ${message.elementInfo.tagName} `;
                        targetVal.style.color = 'var(--text-primary)';
                        targetVal.style.fontWeight = '500';
                    }
                    // Update Result
                    const resultVal = document.getElementById('axesResultValue');
                    const matchBadge = document.getElementById('axesMatchCount');

                    if (resultVal) {
                        resultVal.textContent = message.locator || 'No result found';
                    }

                    if (matchBadge) {
                        if (message.locator) {
                            LocatorX.axes.updateResultMatch(message.locator);
                        } else {
                            matchBadge.setAttribute('data-count', 0);
                        }
                    }
                    this.deactivate();
                }
            });
        },

        toggle() {
            if (!SiteSupport.isSupported) return;
            if (this.isActive) {
                this.deactivate();
            } else {
                // If not in a standard mode, switch to Home first
                const standardModes = ['home', 'pom', 'axes'];
                if (!standardModes.includes(LocatorX.tabs.current)) {
                    LocatorX.tabs.switch('home');
                }
                this.activate();
            }
        },

        activate(mode = null) {
            this.isActive = true;
            this.currentMode = mode || LocatorX.tabs.current;

            this.updateUI();

            const inspectBtn = document.getElementById('inspectBtn');
            const isAxesMode = this.currentMode === 'axes' || this.currentMode === 'axes-anchor' || this.currentMode === 'axes-target';
            if (isAxesMode && inspectBtn) {
                inspectBtn.classList.add('yellow');

                // Reset UI Text
                if (this.currentMode !== 'axes-target') {
                    const anchorVal = document.getElementById('axesAnchorValue');
                    const targetVal = document.getElementById('axesTargetValue');
                    const resultVal = document.getElementById('axesResultValue');

                    if (anchorVal) {
                        anchorVal.textContent = 'Select Anchor...';
                        anchorVal.style.color = 'var(--text-secondary)';
                    }
                    if (targetVal) {
                        targetVal.textContent = 'Waiting...';
                        targetVal.style.color = 'var(--text-secondary)';
                    }
                    if (resultVal) resultVal.textContent = 'Capture Elements to get the result...';
                } else {
                    const targetVal = document.getElementById('axesTargetValue');
                    if (targetVal) {
                        targetVal.textContent = 'Select Target...';
                        targetVal.style.color = 'var(--text-secondary)';
                    }
                }
            }

            // Lock to current tab
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].id) {
                    this.trackedTabId = tabs[0].id;
                    // Tell background which tab we're tracking
                    if (LocatorX._port) {
                        try {
                            LocatorX._port.postMessage({ action: 'setTrackedTab', tabId: this.trackedTabId });
                        } catch (e) { }
                    }
                }
            });

            // Broadcast to ALL frames
            this.broadcastActionToTab({ action: 'startScanning', mode: this.currentMode });
        },

        deactivate() {
            this._isDeactivating = true;
            this.isActive = false;

            const inspectBtn = document.getElementById('inspectBtn');
            if (inspectBtn) {
                inspectBtn.classList.remove('yellow', 'purple');
            }

            this.updateUI();

            // Broadcast to ALL frames
            this.broadcastActionToTab({ action: 'stopScanning' });

            setTimeout(() => {
                this._isDeactivating = false;
            }, 100);
        },


        broadcastActionToTab(payload) {
            chrome.runtime.sendMessage({
                action: 'broadcastToTab',
                tabId: this.trackedTabId,
                payload: payload
            }).catch(() => { });
        },

        updateUI() {
            const inspectBtn = document.getElementById('inspectBtn');
            if (!inspectBtn) return;

            // Reset base classes to ensure clean state
            inspectBtn.className = 'inspect-button header-icon-button';
            inspectBtn.style.animation = 'none';
            inspectBtn.style.color = '';

            if (!SiteSupport.isSupported) {
                inspectBtn.classList.add('bi-arrow-up-left-circle', 'disabled');
                inspectBtn.style.color = 'var(--border-dark)';
                return;
            }

            if (this.isActive) {
                inspectBtn.classList.add('bi-arrow-up-left-circle-fill');

                // Active Pulse Animation based on mode
                if (this.currentMode === 'home') {
                    // Green Pulse for Home (Standard)
                    inspectBtn.style.animation = 'pulse-green 2s infinite';
                    inspectBtn.style.color = '#28a745';
                } else if (this.currentMode === 'axes') {
                    // Yellow Pulse for Axes
                    inspectBtn.style.animation = 'pulse-yellow 2s infinite';
                    inspectBtn.style.color = '#f1c40f';
                } else {
                    // Red Pulse for POM (Recording)
                    inspectBtn.style.animation = 'pulse-red 2s infinite';
                    inspectBtn.style.color = '#dc3545';
                }
            } else {
                // Inactive State - Clean
                inspectBtn.classList.add('bi-arrow-up-left-circle');
                inspectBtn.style.color = 'var(--secondary-text)';
            }
        },
    },

    // Authentication Management
    auth: {
        init() {
            this.loginBtn = document.getElementById('loginBtn');
            this.logoutBtn = document.getElementById('logoutBtn');
            this.userProfile = document.getElementById('userProfile');
            this.userAvatar = document.getElementById('userAvatar');
            this.userInitials = document.getElementById('userInitials');
            this.dropdownUserAvatar = document.getElementById('dropdownUserAvatar');
            this.dropdownUserInitials = document.getElementById('dropdownUserInitials');
            this.userName = document.getElementById('userName');
            this.userPlan = document.getElementById('userPlan');
            this.triggerPlanBadge = document.getElementById('triggerPlanBadge');
            this.headerLogo = document.getElementById('headerLogo');
            this.lastUserState = null;
            this.updateTimeout = null;

            if (this.loginBtn) {
                this.loginBtn.addEventListener('click', () => this.login());
            }
            if (this.logoutBtn) {
                this.logoutBtn.addEventListener('click', () => this.logout());
            }

            // Listen for storage changes (external login or manual logout)
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'local' && (changes.authToken || changes.user)) {
                    this.checkStatus();
                }
            });

            // Listen for broadcast messages from background
            chrome.runtime.onMessage.addListener((message) => {
                console.log('PanelController: Received message', message);
                if (message.action === 'AUTH_STATE_CHANGED') {
                    this.checkStatus();
                }
            });

            this.checkStatus();
        },

        checkStatus() {
            // Debounce updates to handle rapid storage changes
            if (this.updateTimeout) clearTimeout(this.updateTimeout);
            this.updateTimeout = setTimeout(() => this._performCheck(), 50);
        },

        async _performCheck() {
            const data = await chrome.storage.local.get(['authToken', 'user']);
            if (data.authToken && data.user) {
                this.showLoggedIn(data.user);
            } else {
                this.showLoggedOut();
            }
        },

        showLoggedIn(user) {
            // State Comparison: Skip if no actual change detected
            const userState = JSON.stringify({
                avatar: user.avatar,
                name: user.name,
                plan: user.plan,
                updated: user._lastUpdated
            });

            if (this.lastUserState === userState) return;
            this.lastUserState = userState;

            if (this.loginBtn) this.loginBtn.classList.add('hidden');
            if (this.userProfile) {
                this.userProfile.classList.remove('hidden');

                if (this.userAvatar) {
                    if (user.avatar) {
                        this.userAvatar.classList.remove('hidden');
                        if (this.userInitials) this.userInitials.classList.add('hidden');
                        if (this.dropdownUserAvatar) this.dropdownUserAvatar.classList.remove('hidden');
                        if (this.dropdownUserInitials) this.dropdownUserInitials.classList.add('hidden');

                        const avatarUrl = user.avatar + (user._lastUpdated ? `? t = ${user._lastUpdated} ` : '');

                        // Only update .src if it's different to prevent flicker
                        if (this.userAvatar.getAttribute('src') !== avatarUrl) {
                            this.userAvatar.src = avatarUrl;
                        }
                        if (this.dropdownUserAvatar && this.dropdownUserAvatar.getAttribute('src') !== avatarUrl) {
                            this.dropdownUserAvatar.src = avatarUrl;
                        }

                        // Handle broken image -> Switch to initials
                        const handleError = () => {
                            this.userAvatar.classList.add('hidden');
                            if (this.dropdownUserAvatar) this.dropdownUserAvatar.classList.add('hidden');
                            this._showInitials(user.name);
                        };
                        this.userAvatar.onerror = handleError;
                        if (this.dropdownUserAvatar) this.dropdownUserAvatar.onerror = handleError;
                    } else {
                        this.userAvatar.classList.add('hidden');
                        if (this.dropdownUserAvatar) this.dropdownUserAvatar.classList.add('hidden');
                        this._showInitials(user.name);
                    }
                }
                if (this.userName && this.userName.textContent !== (user.name || 'User')) {
                    this.userName.textContent = user.name || 'User';
                }
                const planText = (typeof planService !== 'undefined' ? planService.getPlanName() : (user.plan || 'Free')).toUpperCase();
                if (this.userPlan && this.userPlan.textContent !== planText) {
                    this.userPlan.textContent = planText;
                }

                if (this.triggerPlanBadge) {
                    this.triggerPlanBadge.textContent = planText;
                    this.triggerPlanBadge.classList.remove('hidden');
                }
            }

            // CRITICAL: Update Feature Gates based on user plan
            if (typeof planService !== 'undefined') {
                planService.applyUIGates();

                // If history is disabled, clear the dropdown to avoid stale data access
                if (!planService.isEnabled('module.history')) {
                    const historyDropdown = document.getElementById('customDropdown');
                    if (historyDropdown) {
                        const content = historyDropdown.querySelector('.dropdown-content');
                        if (content) content.innerHTML = '<div class="empty-state"><p style="color:var(--secondary-text)">Upgrade to view history</p></div>';
                    }
                }
            }
        },

        _showInitials(name) {
            const initial = name ? name.charAt(0).toUpperCase() : '?';
            if (this.userInitials) {
                this.userInitials.textContent = initial;
                this.userInitials.classList.remove('hidden');
            }
            if (this.dropdownUserInitials) {
                this.dropdownUserInitials.textContent = initial;
                this.dropdownUserInitials.classList.remove('hidden');
            }

            // Deterministic background color
            const colors = ['#8e44ad', '#2980b9', '#27ae60', '#d35400', '#c0392b', '#16a085'];
            const charCodeSum = (name || 'User').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
            const color = colors[charCodeSum % colors.length];

            if (this.userInitials) this.userInitials.style.backgroundColor = color;
            if (this.dropdownUserInitials) this.dropdownUserInitials.style.backgroundColor = color;
        },

        showLoggedOut() {
            if (this.lastUserState === 'loggedOut') return;
            this.lastUserState = 'loggedOut';

            // Reset Header Logo to default
            // if (this.headerLogo) { this.headerLogo.src = '../../../assets/icons/default.png';}

            if (this.loginBtn) this.loginBtn.classList.remove('hidden');
            if (this.userProfile) this.userProfile.classList.add('hidden');

            // CRITICAL: Revert to Free plan features & Enforce Teardown
            if (typeof planService !== 'undefined') {
                planService.applyUIGates();

                // Teardown: If current tab is now disabled, switch home
                const currentTab = LocatorX.tabs.current;
                const featureMap = {
                    'pom': 'module.pom',
                    'axes': 'module.axes',
                    'dynamic': 'module.multiScan' // dynamic view is mainly MultiScan 
                };

                // Check if current tab is restricted
                if (featureMap[currentTab] && !planService.isEnabled(featureMap[currentTab])) {
                    LocatorX.tabs.switch('home');
                    LocatorX.notifications.info('Feature disabled on Free plan');
                }
            }
        },

        login() {
            const baseUrl = LocatorXConfig.AUTH_DOMAIN || 'http://localhost:3000';
            window.open(`${baseUrl}/auth/login`, '_blank');
        },

        logout() {
            chrome.storage.local.remove(['authToken', 'user', 'locator-x-plan'], () => {
                this.checkStatus();
                LocatorX.notifications.success('Logged out successfully');
                // Broadcast logout to ensure other parts update
                chrome.runtime.sendMessage({ action: 'LOGOUT' });
            });
        }
    },

    // DevTools Conflict Management
    conflict: {
        init() {
            this.warningOverlay = document.getElementById('devtoolsWarning');
            if (this.warningOverlay) {
                this.checkStatus();
                this.setupListeners();
            }
        },

        async checkStatus() {
            const data = await chrome.storage.local.get('devtoolsActive');
            this.toggleWarning(!!data.devtoolsActive);
        },

        setupListeners() {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'local' && changes.devtoolsActive) {
                    this.toggleWarning(!!changes.devtoolsActive.newValue);
                }
            });
        },

        toggleWarning(show) {
            if (!this.warningOverlay) return;
            if (show) {
                if (LocatorX.inspect && LocatorX.inspect.isActive) {
                    LocatorX.inspect.deactivate();
                }
                this.warningOverlay.classList.remove('hidden');
            } else {
                this.warningOverlay.classList.add('hidden');
            }
        }
    },

    // Initialize all modules
    accessibility: {
        init() {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    const el = document.activeElement;
                    // Only trigger if the element is actually one of our custom buttons
                    if (el && (el.getAttribute('role') === 'button' || el.tagName === 'I' || el.tagName === 'LI')) {
                        if (!el.classList.contains('disabled') && el.getAttribute('aria-disabled') !== 'true') {
                            e.preventDefault();
                            el.click();
                        }
                    }
                }
            });
        }
    },

    async init() {
        this.modal = new LocatorXModal();
        this.core = new LocatorXCore();
        this.evaluator = new Evaluator();
        await this.core.initialize();

        if (typeof planService !== 'undefined') { await planService.init(); }

        this.tabs.init();
        await this.theme.init();
        this.dropdowns.init();

        if (typeof planService !== 'undefined') { planService.applyUIGates(); } // Initialize features early to apply gates

        this.settings.init();
        await this.filters.init();
        this.dependencies.init();
        this.search.init();
        this.multiScan.init();
        await this.pom.init();
        this.table.init();
        await this.savedLocators.init();
        this.inspect.init();

        this.auth.init();
        this.conflict.init();
        this.accessibility.init();
        this.stateManager.init();

        // Check site support
        if (typeof SiteSupport !== 'undefined') {
            SiteSupport.init();
        }

        // Establish persistent connection to background for lifecycle management
        this._port = chrome.runtime.connect({ name: 'locatorx-panel' });
        this._port.onDisconnect.addListener(() => {
            // Detect Service Worker Restart
            if (LocatorX.inspect.isActive) {
                LocatorX.inspect.trackedTabId = null;
                LocatorX.inspect.deactivate();
                LocatorX.notifications.error('Connection lost. Inspection stopped.');
            }
            this._port = null;
        });
    },

    // Saved Locators Management
    savedLocators: {
        async init() {
            await this.updateDropdown();
            this.setupSavedActions();
        },

        async updateDropdown() {
            const dropdown = document.getElementById('aboutDropdown');
            if (!dropdown) return;

            const saved = await LocatorX.core.getSavedLocators(LocatorX.activeProjectId);

            if (saved.length === 0) {
                dropdown.innerHTML = `
                    <div class="dropdown-header">
                        <strong>Saved Locators</strong>
                    </div>
                    <div class="dropdown-content">
                        <div class="empty-state">
                            <i class="bi-bookmark-dash" style="font-size: 24px; color: var(--border-dark); margin-bottom: 8px;"></i>
                            <p>No saved locators yet</p>
                        </div>
                    </div>
                `;
            } else {
                let content = `
                    <div class="dropdown-header">
                        <strong>Saved Locators</strong> 
                        <span class="badge-count">${saved.length}</span>
                    </div>
                    <div class="dropdown-content">
                `;

                saved.forEach((item, index) => {
                    const typeClass = item.type ? item.type.toLowerCase().replace(/\s+/g, '-') : 'manual';
                    const icon = (item.id) ? 'bi-trash' : 'bi-trash'; // Keep it simple
                    content += `
                        <div class="saved-item" data-index="${index}" data-id="${item.id}">
                            <div class="saved-main">
                                <div class="saved-info">
                                    <span class="saved-name lx-editable" title="Double-click to rename" data-target="saved-name" data-index="${index}">${LocatorX.utils.escapeHtml(item.name)}</span>
                                    <span class="saved-type-badge ${typeClass}">${LocatorX.utils.escapeHtml(item.type)}</span>
                                </div>
                                <div class="saved-actions">
                                    <i class="bi-clipboard header-icon-button saved-copy" title="Copy Locator" style="font-size: 12px; margin: 0 2px;" role="button" tabindex="0"></i>
                                    <i class="bi-trash header-icon-button saved-delete" title="Delete" style="font-size: 12px; margin: 0 2px;" role="button" tabindex="0"></i>
                                </div>
                            </div>
                            <div class="saved-locator-code" title="${LocatorX.utils.escapeHtml(item.locator)}">${LocatorX.utils.escapeHtml(item.locator)}</div>
                        </div>
                    `;
                });

                content += '</div>';
                dropdown.innerHTML = content;

                // Re-apply feature gates to the new dynamic content
                if (typeof planService !== 'undefined') { planService.applyUIGates(); }
            }

            // Always setup actions after updating content
            this.setupSavedActions();
        },

        setupSavedActions() {
            // Use event delegation on the dropdown container
            const dropdown = document.getElementById('aboutDropdown');
            if (dropdown) {
                // Remove existing listener
                dropdown.removeEventListener('click', this.handleSavedClick);

                // Add new listener with proper binding
                this.handleSavedClick = async (e) => {
                    if (e.target.classList.contains('saved-copy') || e.target.closest('.saved-copy')) {
                        const item = e.target.closest('.saved-item');
                        const locator = item.querySelector('.saved-locator-code').textContent;
                        const success = await LocatorX.utils.copyToClipboard(locator);
                        if (success) LocatorX.notifications.success('Copied!');
                        else LocatorX.notifications.error('Failed to copy');
                    }

                    if (e.target.classList.contains('saved-delete') || e.target.closest('.saved-delete')) {
                        const item = e.target.closest('.saved-item');
                        const index = parseInt(item.dataset.index);
                        const saved = await LocatorX.core.getSavedLocators(LocatorX.activeProjectId);
                        const deletedLocator = saved[index];
                        if (!deletedLocator) return;

                        await LocatorX.core.deleteLocator(deletedLocator.id);
                        await this.updateDropdown();

                        LocatorX.notifications.undoable(`Deleted "${deletedLocator.name}"`, async () => {
                            await LocatorX.core.saveLocator({
                                name: deletedLocator.name,
                                type: deletedLocator.type,
                                locator: deletedLocator.locator
                            });
                            await this.updateDropdown();
                        });
                    }
                };
                dropdown.addEventListener('click', this.handleSavedClick);
            }
        },
    },

    // Table Management
    table: {
        init() {
            this.setupCopyButtons();
            this.setupEventListeners();
            this.setupEditableCells();
            this.setupSaveButton();
        },

        setupSaveButton() {
            const saveBtn = document.querySelector('.save-btn');
            const saveInput = document.querySelector('.save-input');
            const searchInput = document.querySelector('.search-input');

            if (saveBtn && saveInput && searchInput) {
                saveBtn.addEventListener('click', async () => {
                    // FEATURE GATE: Check for Saved Locator Limit
                    if (typeof planService !== 'undefined') {
                        const saved = await LocatorX.core.getSavedLocators();
                        const limit = planService.getLimit('MAX_SAVED_LOCATORS');
                        // Only enforce limit when adding a new locator.
                        const locatorVal = searchInput.value.trim();
                        const exists = saved.some(item => item.locator === locatorVal);

                        if (!exists && saved.length >= limit) {
                            planService._showUpgradePrompt('Saved Locator Limit Reached');
                            return;
                        }
                    }

                    const locator = searchInput.value.trim();
                    let name = saveInput.value.trim();

                    if (!locator) {
                        LocatorX.notifications.error('Please enter a locator in the search field');
                        return;
                    }

                    const saved = await LocatorX.core.getSavedLocators();
                    const existing = saved.find(item => item.locator === locator);

                    if (existing) {
                        const isTimestampName = /^\d{4}-\d{2}-\d{2}/.test(existing.name);
                        if (isTimestampName) {
                            if (!name) name = LocatorX.core.generateAutoName();
                            existing.name = name;
                            await LocatorX.core.saveLocator(name, existing.type, existing.locator);
                            LocatorX.notifications.success(`Locator renamed to "${name}"`);
                        } else {
                            const rename = await LocatorX.modal.confirm(
                                'Rename Locator',
                                `Locator already exists as "${existing.name}". Do you want to rename it?`
                            );
                            if (rename) {
                                if (!name) name = LocatorX.core.generateAutoName();
                                await LocatorX.core.saveLocator(name, existing.type, existing.locator);
                                LocatorX.notifications.success(`Locator renamed to "${name}"`);
                            } else {
                                LocatorX.notifications.info('Save cancelled');
                                return;
                            }
                        }
                    } else {
                        if (!name) name = LocatorX.core.generateAutoName();
                        const type = LocatorX.table.detectLocatorType(locator);
                        const toSave = {
                            name,
                            type,
                            locator
                        };
                        await LocatorX.core.saveLocator(toSave);
                        LocatorX.notifications.success(`Locator saved as "${name}"`);
                    }

                    saveInput.value = '';
                    await LocatorX.savedLocators.updateDropdown();
                });
            }
        },

        setupCopyButtons() {
            document.addEventListener('click', async (e) => {
                if (!e.target || !e.target.closest) return;

                if (e.target.classList.contains('bi-clipboard')) {
                    const row = e.target.closest('tr');
                    let locator = '';

                    // MultiScan: Locator is in 4th column (index 3)
                    if (row.closest('#msResultsTable')) { locator = row.cells[3].textContent; }
                    else {
                        // Main Table: Locator is in #strategyLocator or .lx-editable
                        const locatorCell = row.querySelector('#strategyLocator') || row.querySelector('.lx-editable');
                        if (locatorCell) locator = locatorCell.textContent;
                    }

                    if (locator) {
                        LocatorX.utils.copyToClipboard(locator).then(success => {
                            if (success) LocatorX.notifications.success('Locator copied to clipboard');
                            else LocatorX.notifications.error('Failed to copy');
                        });
                    }
                }
                if (e.target.classList.contains('bi-bookmark-plus')) {
                    const row = e.target.closest('tr');
                    const locatorCell = row.querySelector('.lx-editable');
                    const locator = locatorCell.textContent;
                    let type = row.getAttribute('data-type');
                    if (!type) {
                        const strategySelect = row.querySelector('.strategy-dropdown');
                        type = strategySelect ? strategySelect.value : row.cells[1].textContent;
                    }

                    // Save with auto-generated name
                    const saved = await LocatorX.core.getSavedLocators();
                    const isDuplicate = saved.some(item => item.locator === locator && item.type === type);

                    if (isDuplicate) {
                        LocatorX.notifications.warn('Locator already saved');
                        return;
                    }

                    // FEATURE GATE: Check for Saved Locator Limit
                    if (typeof planService !== 'undefined') {
                        const limit = planService.getLimit('MAX_SAVED_LOCATORS');
                        if (saved.length >= limit) {
                            planService._showUpgradePrompt('Saved Locator Limit Reached');
                            return;
                        }
                    }

                    if (!type || type === 'Manual') { type = this.detectLocatorType(locator); }

                    const autoName = LocatorX.core.generateAutoName();
                    await LocatorX.core.saveLocator({
                        name: autoName,
                        type,
                        locator
                    });
                    await LocatorX.savedLocators.updateDropdown();
                    LocatorX.notifications.success(`Locator saved as "${autoName}"`);
                }
                if (e.target.classList.contains('bi-trash')) {
                    const row = e.target.closest('tr');
                    if (row) {
                        if (row.closest('.pom-table')) { await LocatorX.pom.deleteLocator(row); }
                        else {
                            row.remove();
                            this.updateRowNumbers();
                        }
                    }
                }
            });
        },

        detectLocatorType(locator) {
            if (!locator) return 'Unknown';
            locator = locator.trim();
            if (locator.startsWith('/') || locator.startsWith('(') || locator.startsWith('xpath:')) return 'XPath';
            if (locator.startsWith('#')) return 'ID';
            if (locator.startsWith('.')) return 'Class';
            // Simple heuristics for CSS
            if (locator.includes('[') || locator.includes('>') || locator.includes(':') || locator.includes(' ')) return 'CSS';
            // Default to Tag or general text
            return 'CSS';
        },

        updateRowNumbers() {
            const pomTable = document.querySelector('.pom-container .locator-table tbody');
            if (pomTable) {
                const rows = pomTable.querySelectorAll('tr');
                rows.forEach((row, index) => {
                    row.cells[0].textContent = index + 1;
                });
            }
        },

        setupEventListeners() {
            // Centralized Event Listener for Update Logic
            document.addEventListener('locatorx-update', async (e) => {
                const { newValue, element, context } = e.detail;
                const targetType = context.target;

                if (targetType === 'saved-name') {
                    const index = parseInt(context.index);
                    const saved = await LocatorX.core.getSavedLocators();
                    if (saved[index]) {
                        const item = saved[index];
                        await LocatorX.core.saveLocator(newValue, item.type, item.locator);
                        await LocatorX.savedLocators.updateDropdown();
                        LocatorX.notifications.success('Locator renamed');
                    }
                } else if (targetType === 'table-cell') {
                    this.updateMatchCount(element);
                } else if (targetType === 'axes-result') {
                    LocatorX.axes.updateResultMatch(newValue);
                } else if (targetType === 'pom-cell') {
                    const row = element.closest('tr');
                    let type = context.locatorType;
                    if (context.isStrategy === 'true') {
                        const select = row.querySelector('.strategy-select');
                        type = select ? select.value : 'Relative XPath';
                    }
                    if (row && type) {
                        await LocatorX.pom.updateLocator(row, type, newValue);
                    }
                } else if (targetType === 'multiscan-cell') {
                    // Real-time update for MultiScan
                    const row = element.closest('tr');
                    const badge = row.querySelector('.match-count');

                    // Column 3 is Type, Column 4 is Locator
                    const type = row.querySelector('td:nth-child(3)').textContent;
                    const locator = row.querySelector('td:nth-child(4)').textContent;

                    if (badge) {
                        badge.dataset.count = '...';
                        LocatorX.multiScan.validateMatch(locator, type, badge.id);
                    }
                }
            });
        },

        setupEditableCells() {
            let clickCount = 0;
            let clickTimeout;

            document.addEventListener('click', (e) => {
                // Check for generic editable class
                const editableEl = e.target.closest('.lx-editable');
                if (!editableEl) return;

                // Ignore if already editing
                if (editableEl.classList.contains('editing')) return;

                clickCount++;

                if (clickCount === 1) {
                    clickTimeout = setTimeout(() => {
                        // Single click - highlight in search (Table Cells only - heuristic)
                        if (editableEl.dataset.target === 'table-cell') {
                            const locator = editableEl.textContent;
                            const searchInput = document.querySelector('.search-input');
                            if (searchInput) {
                                searchInput.value = locator;
                                searchInput.focus();
                            }
                        }
                        clickCount = 0;
                    }, 300);
                } else if (clickCount === 2) {
                    // Double click detected
                    clearTimeout(clickTimeout);
                    clickCount = 0;

                    // FEATURE GATE: Check for Quick Edit permission
                    if (typeof planService !== 'undefined' && !planService.isEnabled('ui.quickEdit')) {
                        planService._showUpgradePrompt('Quick Edit');
                        return;
                    }

                    this.makeEditable(editableEl);
                }
            });
        },

        makeEditable(cell) {
            const currentValue = cell.textContent;
            const originalHTML = cell.innerHTML;
            cell.classList.add('editing');

            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentValue.trim(); // Trim input for better UX

            cell.innerHTML = '';
            cell.appendChild(input);
            input.focus();
            input.select();

            const finishEdit = () => {
                const newValue = input.value; // Allow empty

                // If unchanged, restore original structure (preserves formatting/icons)
                if (newValue === currentValue.trim()) {
                    cell.innerHTML = originalHTML;
                    cell.classList.remove('editing');
                    return;
                }

                cell.textContent = newValue;
                cell.classList.remove('editing');

                // Dispatch generic update event
                cell.dispatchEvent(new CustomEvent('locatorx-update', {
                    bubbles: true,
                    detail: {
                        oldValue: currentValue,
                        newValue: newValue,
                        element: cell,
                        context: cell.dataset
                    }
                }));
            };

            input.addEventListener('blur', finishEdit);
            let axesEvalTimeout;
            input.addEventListener('input', () => {
                if (cell.dataset.target === 'axes-result') {
                    clearTimeout(axesEvalTimeout);
                    axesEvalTimeout = setTimeout(() => {
                        LocatorX.axes.updateResultMatch(input.value);
                    }, 300);
                }
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') finishEdit();
                if (e.key === 'Escape') {
                    cell.innerHTML = originalHTML;
                    cell.classList.remove('editing');
                }
            });
        },

        updateMatchCount(cell) {
            const row = cell.closest('tr');
            if (!row) return;

            const badge = row.querySelector('.match-badge') || row.querySelector('.match-count');
            const typeCell = row.cells[1];
            const type = typeCell ? typeCell.textContent.trim().toLowerCase() : 'auto';

            LocatorX.utils.evaluate(cell, {
                type: type,
                badge: badge
            });
        }
    }
};

// Initialize the application with error handling
LocatorX.init().then(() => {
    // Initialize Axes after main init
    if (LocatorX.axes) LocatorX.axes.init();
    if (LocatorX.codeMode) LocatorX.codeMode.init();
    if (LocatorX.utils.setupInputGroups) LocatorX.utils.setupInputGroups();
}).catch(err => {
    console.error('Failed to initialize Locator-X:', err);
});

// Export API for external use
window.LocatorXAPI = {
    switchToHome: () => LocatorX.tabs.switch('home'),
    switchToPOM: () => LocatorX.tabs.switch('pom'),
    getCurrentTab: () => LocatorX.tabs.current,
    toggleTheme: () => LocatorX.theme.toggle(),
    getCurrentTheme: () => LocatorX.theme.current,
    closeAllDropdowns: () => LocatorX.dropdowns.closeAll()
};