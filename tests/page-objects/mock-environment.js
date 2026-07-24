/**
 * Mock Environment for LocatorX
 * Simulates a standard browser environment (DOM, window, events) and Chrome Extension APIs.
 */

const fs = require('fs');
const path = require('path');

// 1. Mock Node and HTML constants
global.Node = {
    ELEMENT_NODE: 1,
    DOCUMENT_POSITION_CONTAINED_BY: 16,
    DOCUMENT_POSITION_CONTAINS: 8,
    DOCUMENT_POSITION_FOLLOWING: 4,
    DOCUMENT_POSITION_PRECEDING: 2
};

global.XPathResult = {
    ORDERED_NODE_SNAPSHOT_TYPE: 7
};

// 2. Element Class Mock
class MockElement {
    constructor(tagName = 'DIV', id = '') {
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this.className = '';
        this.textContent = '';
        this.value = '';
        this.type = this.tagName === 'INPUT' ? 'text' : undefined;
        this.checked = false;
        this.disabled = false;
        this.title = '';
        this.style = {};
        this.dataset = {};
        this.attributes = {};
        this.children = [];
        this.listeners = {};
        this.classList = {
            classes: new Set(),
            add: (c) => this.classList.classes.add(c),
            remove: (c) => this.classList.classes.delete(c),
            contains: (c) => this.classList.classes.has(c),
            toggle: (c, force) => {
                const has = this.classList.classes.has(c);
                const want = force !== undefined ? !!force : !has;
                if (want) {
                    this.classList.classes.add(c);
                    return true;
                } else {
                    this.classList.classes.delete(c);
                    return false;
                }
            }
        };
    }

    get parentElement() {
        if (this.tagName === 'BODY') return null;
        return this.parentNode || (global.document ? global.document.body : null);
    }

    getAttribute(name) {
        return this.attributes[name] || null;
    }

    setAttribute(name, val) {
        this.attributes[name] = String(val);
        if (name === 'data-feature') this.dataset.feature = val;
        if (name === 'type') this.type = String(val);
        if (name === 'value') this.value = String(val);
        if (name === 'disabled') this.disabled = (val === 'true' || val === true);
        if (name === 'checked') this.checked = (val === 'true' || val === true);
    }

    removeAttribute(name) {
        delete this.attributes[name];
        if (name === 'data-feature') delete this.dataset.feature;
        if (name === 'type') this.type = this.tagName === 'INPUT' ? 'text' : undefined;
        if (name === 'value') this.value = '';
        if (name === 'disabled') this.disabled = false;
        if (name === 'checked') this.checked = false;
    }

    addEventListener(event, cb) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(cb);
    }

    removeEventListener(event, cb) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(l => l !== cb);
    }

    dispatchEvent(event) {
        const type = typeof event === 'string' ? event : event.type;
        if (this.listeners[type]) {
            this.listeners[type].forEach(cb => cb({ target: this, preventDefault: () => {}, stopPropagation: () => {} }));
        }
    }

    click() {
        this.dispatchEvent('click');
    }

    appendChild(child) {
        this.children.push(child);
        child.parentNode = this;
    }

    removeChild(child) {
        this.children = this.children.filter(c => c !== child);
        delete child.parentNode;
    }

    remove() {
        if (this.parentNode) {
            this.parentNode.removeChild(this);
        }
    }

    getBoundingClientRect() {
        return { top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 };
    }

    querySelector(selector) {
        if (selector.startsWith('#')) {
            const id = selector.substring(1);
            return findElementById(this, id);
        }
        if (selector.startsWith('.')) {
            const cls = selector.substring(1);
            return findElementByClass(this, cls);
        }
        return this.children.find(c => c.tagName.toLowerCase() === selector.toLowerCase()) || null;
    }

    querySelectorAll(selector) {
        const results = [];
        const scan = (el) => {
            if (selector.startsWith('.')) {
                const cls = selector.substring(1);
                if (el.classList.contains(cls)) results.push(el);
            } else if (selector.startsWith('#')) {
                const id = selector.substring(1);
                if (el.id === id) results.push(el);
            } else if (selector === '*') {
                results.push(el);
            } else {
                if (el.tagName.toLowerCase() === selector.toLowerCase()) results.push(el);
            }
            el.children.forEach(scan);
        };
        this.children.forEach(scan);
        return results;
    }
}

function findElementById(root, id) {
    if (root.id === id) return root;
    for (const child of root.children) {
        const found = findElementById(child, id);
        if (found) return found;
    }
    return null;
}

function findElementByClass(root, cls) {
    if (root.classList.contains(cls)) return root;
    for (const child of root.children) {
        const found = findElementByClass(child, cls);
        if (found) return found;
    }
    return null;
}

// 3. Mock document and window
const documentElements = {};

const knownElements = {
    'relativeXPath': { attrs: { 'data-feature': 'locator.relativeXpath', type: 'checkbox' }, classes: ['loc-type'], checked: true },
    'absoluteLocator': { attrs: { 'data-feature': 'locator.absoluteXpath', type: 'checkbox' }, classes: ['loc-type'], checked: false },
    'idLocator': { attrs: { type: 'checkbox' }, classes: ['loc-type'], checked: true },
    'nameLocator': { attrs: { type: 'checkbox' }, classes: ['loc-type'], checked: true },
    'tagnameLocator': { attrs: { type: 'checkbox' }, classes: ['loc-type'], checked: true },
    'classNameLocator': { attrs: { type: 'checkbox' }, classes: ['loc-type'], checked: true },
    'cssLocator': { attrs: { type: 'checkbox' }, classes: ['loc-type'], checked: true },
    'linkTextLocator': { attrs: { type: 'checkbox' }, classes: ['loc-type'], checked: true },
    'pLinkTextLocator': { attrs: { type: 'checkbox' }, classes: ['loc-type'], checked: true },
    
    'relativeXpathLocator': { attrs: { 'data-feature': 'locator.relativeXpath', type: 'checkbox' }, classes: ['nested-loc-type'], checked: true },
    'containsXpathLocator': { attrs: { 'data-feature': 'locator.containsXpath', type: 'checkbox' }, classes: ['nested-loc-type'], checked: true },
    'indexedXpathLocator': { attrs: { 'data-feature': 'locator.indexedXpath', type: 'checkbox' }, classes: ['nested-loc-type'], checked: true },
    'linkTextXpathLocator': { attrs: { 'data-feature': 'locator.linkTextXpath', type: 'checkbox' }, classes: ['nested-loc-type'], checked: true },
    'pLinkTextXpathLocator': { attrs: { 'data-feature': 'locator.pLinkTextXpath', type: 'checkbox' }, classes: ['nested-loc-type'], checked: true },
    'attributeXpathLocator': { attrs: { 'data-feature': 'locator.attributeXpath', type: 'checkbox' }, classes: ['nested-loc-type'], checked: true },
    'startsWithXpathLocator': { attrs: { 'data-feature': 'locator.startsWithXpath', type: 'checkbox' }, classes: ['nested-loc-type'], checked: true },
    'orXpathLocator': { attrs: { 'data-feature': 'locator.orXpath', type: 'checkbox' }, classes: ['nested-loc-type'], checked: true },
    'cssXpathLocator': { attrs: { 'data-feature': 'locator.cssXpath', type: 'checkbox' }, classes: ['nested-loc-type'], checked: true },
    
    'smartCorrectCfg': { attrs: { 'data-feature': 'module.smartCorrect', type: 'checkbox' }, classes: [], checked: true },
    'excludeNumbersCfg': { attrs: { type: 'checkbox' }, classes: [], checked: true },
    'showTimestampCfg': { attrs: { 'data-feature': 'ui.settings.showTimestamp', type: 'checkbox' }, classes: [], checked: true },
    'navPOM': { attrs: { 'data-feature': 'module.pom' }, classes: ['nav-option'] },
    'navAxes': { attrs: { 'data-feature': 'module.axes' }, classes: ['nav-option'] },
    'navMultiScan': { attrs: { 'data-feature': 'module.multiScan' }, classes: ['nav-item'] },
    'navHistory': { attrs: { 'data-feature': 'module.history' }, classes: ['nav-item'] },
    'navLinkAuditor': { attrs: { 'data-feature': 'module.checkLinks' }, classes: ['nav-item'] },
    'auditorExportBtn': { attrs: { 'data-feature': 'ui.checkLinks.export' }, classes: ['reset-settings-btn'] },
    'mainAuditorExclusions': { attrs: { 'data-feature': 'ui.checkLinks.exclusions' }, classes: ['settings-textarea'] },
    'resetSettingsBtn': { attrs: { 'data-feature': 'ui.settings.reset' }, classes: [] }
};

function inferTagName(nameOrSelector) {
    const lower = nameOrSelector.toLowerCase();
    if (lower.endsWith('locator') || lower.endsWith('input') || lower.endsWith('cfg') || lower.includes('checkbox') || lower.includes('search') || lower.includes('email') || lower.includes('password')) {
        return 'INPUT';
    }
    if (lower.endsWith('btn') || lower.endsWith('button')) {
        return 'BUTTON';
    }
    if (lower.endsWith('select')) {
        return 'SELECT';
    }
    if (lower.endsWith('textarea')) {
        return 'TEXTAREA';
    }
    return 'DIV';
}

Object.entries(knownElements).forEach(([id, config]) => {
    const el = new MockElement(inferTagName(id), id);
    if (config.attrs) {
        Object.entries(config.attrs).forEach(([k, v]) => {
            el.setAttribute(k, v);
        });
    }
    if (config.classes) {
        config.classes.forEach(c => el.classList.add(c));
    }
    if (config.checked !== undefined) {
        el.checked = config.checked;
    }
    documentElements[id] = el;
});

global.document = {
    body: new MockElement('BODY'),
    createElement: (tag) => new MockElement(tag),
    getElementById: (id) => {
        if (!documentElements[id]) {
            documentElements[id] = new MockElement(inferTagName(id), id);
            const config = knownElements[id];
            if (config) {
                if (config.attrs) {
                    Object.entries(config.attrs).forEach(([k, v]) => {
                        documentElements[id].setAttribute(k, v);
                    });
                }
                if (config.classes) {
                    config.classes.forEach(c => documentElements[id].classList.add(c));
                }
                if (config.checked !== undefined) {
                    documentElements[id].checked = config.checked;
                }
            }
        }
        return documentElements[id];
    },
    querySelector: (selector) => {
        const list = global.document.querySelectorAll(selector);
        return list.length > 0 ? list[0] : null;
    },
    querySelectorAll: (selector) => {
        const results = [];
        if (selector.includes(',')) {
            const parts = selector.split(',').map(s => s.trim());
            parts.forEach(part => {
                results.push(...global.document.querySelectorAll(part));
            });
            return results;
        }

        const isClass = selector.startsWith('.');
        const isId = selector.startsWith('#');
        const isAttribute = selector.startsWith('[') && selector.endsWith(']');
        let attrName = null;
        let attrValue = null;
        
        if (isAttribute) {
            const inner = selector.substring(1, selector.length - 1);
            if (inner.includes('=')) {
                const parts = inner.split('=');
                attrName = parts[0].trim();
                let val = parts[1].trim();
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.substring(1, val.length - 1);
                }
                attrValue = val;
            } else {
                attrName = inner.trim();
            }
        }

        const targetName = isClass ? selector.substring(1) : (isId ? selector.substring(1) : selector);

        Object.values(documentElements).forEach(el => {
            if (isClass && el.classList.contains(targetName)) {
                results.push(el);
            } else if (isId && el.id === targetName) {
                results.push(el);
            } else if (isAttribute) {
                const actualVal = el.getAttribute(attrName);
                if (actualVal !== null) {
                    if (attrValue === null || actualVal === attrValue) {
                        results.push(el);
                    }
                }
            } else if (!isClass && !isId && el.tagName.toLowerCase() === targetName.toLowerCase()) {
                results.push(el);
            }
        });

        if (results.length === 0) {
            const tagName = isClass || isId ? inferTagName(targetName) : (isAttribute ? 'div' : targetName);
            const newEl = new MockElement(tagName);
            if (isClass) {
                newEl.classList.add(targetName);
            } else if (isId) {
                newEl.id = targetName;
                const config = knownElements[targetName];
                if (config) {
                    if (config.attrs) {
                        Object.entries(config.attrs).forEach(([k, v]) => {
                            newEl.setAttribute(k, v);
                        });
                    }
                    if (config.classes) {
                        config.classes.forEach(c => newEl.classList.add(c));
                    }
                    if (config.checked !== undefined) {
                        newEl.checked = config.checked;
                    }
                }
            }
            const key = `auto_${selector}_${Date.now()}_${Math.random()}`;
            documentElements[key] = newEl;
            results.push(newEl);
        }

        return results;
    },
    addEventListener: (event, cb) => {},
    removeEventListener: (event, cb) => {}
};

const localData = {};
global.localStorage = {
    getItem: (key) => localData[key] || null,
    setItem: (key, val) => localData[key] = String(val),
    removeItem: (key) => delete localData[key],
    clear: () => {
        Object.keys(localData).forEach(k => delete localData[k]);
    }
};

global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

global.window = {
    LocatorX: {},
    open: (url, target) => {
        global.window.lastOpenedUrl = url;
    },
    Event: class {
        constructor(type) {
            this.type = type;
        }
    },
    localStorage: global.localStorage,
    requestAnimationFrame: global.requestAnimationFrame,
    getComputedStyle: (el) => {
        return {
            top: '0px',
            bottom: '0px',
            height: '0px',
            maxHeight: '0px',
            minHeight: '0px',
            overflow: '',
            overflowY: '',
            getPropertyValue: (prop) => ''
        };
    }
};
global.getComputedStyle = global.window.getComputedStyle;

let storageData = {};
let sessionData = {};

global.self = global;

global.importScripts = (...filePaths) => {
    filePaths.forEach(filePath => {
        const absolutePath = path.resolve(__dirname, '..', '..', 'src', 'background', filePath);
        const code = fs.readFileSync(absolutePath, 'utf8');
        const runner = new Function('self', 'window', 'global', code);
        runner(global, global, global);
    });
};

global.chrome = {
    storage: {
        local: {
            get: (keys, cb) => {
                const res = {};
                if (typeof keys === 'string') {
                    res[keys] = storageData[keys];
                } else if (Array.isArray(keys)) {
                    keys.forEach(k => res[k] = storageData[k]);
                } else {
                    Object.assign(res, storageData);
                }
                if (cb) {
                    cb(res);
                } else {
                    return Promise.resolve(res);
                }
            },
            set: (data, cb) => {
                Object.assign(storageData, data);
                if (cb) {
                    cb();
                } else {
                    return Promise.resolve();
                }
                if (global.chrome.storage.onChanged.listener) {
                    const changes = {};
                    Object.keys(data).forEach(k => {
                        changes[k] = { newValue: data[k] };
                    });
                    global.chrome.storage.onChanged.listener(changes, 'local');
                }
            },
            remove: (keys, cb) => {
                if (typeof keys === 'string') {
                    delete storageData[keys];
                } else if (Array.isArray(keys)) {
                    keys.forEach(k => delete storageData[k]);
                }
                if (cb) {
                    cb();
                } else {
                    return Promise.resolve();
                }
            },
            clear: (cb) => {
                storageData = {};
                if (cb) {
                    cb();
                } else {
                    return Promise.resolve();
                }
            }
        },
        session: {
            get: (keys, cb) => {
                const res = {};
                if (typeof keys === 'string') {
                    res[keys] = sessionData[keys];
                } else if (Array.isArray(keys)) {
                    keys.forEach(k => res[k] = sessionData[k]);
                } else {
                    Object.assign(res, sessionData);
                }
                if (cb) {
                    cb(res);
                } else {
                    return Promise.resolve(res);
                }
            },
            set: (data, cb) => {
                Object.assign(sessionData, data);
                if (cb) {
                    cb();
                } else {
                    return Promise.resolve();
                }
            },
            remove: (keys, cb) => {
                if (typeof keys === 'string') {
                    delete sessionData[keys];
                } else if (Array.isArray(keys)) {
                    keys.forEach(k => delete sessionData[k]);
                }
                if (cb) {
                    cb();
                } else {
                    return Promise.resolve();
                }
            },
            clear: (cb) => {
                sessionData = {};
                if (cb) {
                    cb();
                } else {
                    return Promise.resolve();
                }
            }
        },
        onChanged: {
            addListener: (cb) => {
                global.chrome.storage.onChanged.listener = cb;
            }
        }
    },
    contextMenus: {
        create: (details, cb) => { if (cb) cb(); },
        removeAll: (cb) => { if (cb) cb(); },
        update: (id, details, cb) => { if (cb) cb(); },
        onClicked: {
            addListener: (cb) => {
                global.chrome.contextMenus.onClicked.listener = cb;
            }
        }
    },
    webNavigation: {
        getAllFrames: (details, cb) => {
            if (cb) cb([{ frameId: 0 }]);
        }
    },
    action: {
        onClicked: {
            addListener: (cb) => {
                global.chrome.action.onClicked.listener = cb;
            }
        }
    },
    tabs: {
        query: (queryInfo, cb) => {
            cb([{ id: 1, url: 'https://example.com/test-page' }]);
        },
        sendMessage: (tabId, msg, cb) => {
            if (cb) {
                if (global.chrome.tabs.onMessageListener) {
                    global.chrome.tabs.onMessageListener(msg, {}, cb);
                } else {
                    cb({ success: false, error: 'No content script loaded' });
                }
            } else {
                return new Promise((resolve) => {
                    if (global.chrome.tabs.onMessageListener) {
                        global.chrome.tabs.onMessageListener(msg, {}, resolve);
                    } else {
                        resolve({ success: false, error: 'No content script loaded' });
                    }
                });
            }
        },
        onActivated: {
            addListener: (cb) => {
                global.chrome.tabs.onActivated.listener = cb;
            }
        },
        onUpdated: {
            addListener: (cb) => {
                global.chrome.tabs.onUpdated.listener = cb;
            }
        },
        onRemoved: {
            addListener: (cb) => {
                global.chrome.tabs.onRemoved.listener = cb;
            }
        }
    },
    runtime: {
        connect: (info) => {
            return {
                postMessage: () => {},
                onMessage: { addListener: () => {} },
                onDisconnect: { addListener: () => {} }
            };
        },
        sendMessage: (msg, cb) => {
            if (cb) {
                if (global.chrome.runtime.onMessageListener) {
                    global.chrome.runtime.onMessageListener(msg, {}, cb);
                } else {
                    cb({ success: false, error: 'No background worker active' });
                }
            } else {
                return new Promise((resolve) => {
                    if (global.chrome.runtime.onMessageListener) {
                        global.chrome.runtime.onMessageListener(msg, {}, resolve);
                    } else {
                        resolve({ success: false, error: 'No background worker active' });
                    }
                });
            }
        },
        onMessage: {
            addListener: (cb) => {
                global.chrome.runtime.onMessageListener = cb;
            }
        },
        onInstalled: {
            addListener: (cb) => {
                global.chrome.runtime.onInstalled.listener = cb;
            }
        },
        onStartup: {
            addListener: (cb) => {
                global.chrome.runtime.onStartup.listener = cb;
            }
        },
        onMessageExternal: {
            addListener: (cb) => {
                global.chrome.runtime.onMessageExternal.listener = cb;
            }
        },
        onConnect: {
            addListener: (cb) => {
                global.chrome.runtime.onConnect.listener = cb;
            }
        }
    }
};

global.chrome.tabs.onMessage = {
    addListener: (cb) => {
        global.chrome.tabs.onMessageListener = cb;
    }
};

global.LocatorXPlans = require('../../src/config/plans.js');
global.LocatorXConfig = require('../../src/config/constants.js');

module.exports = {
    MockElement,
    resetStorage: () => {
        storageData = {};
    },
    setStorage: (data) => {
        Object.assign(storageData, data);
    },
    getStorage: () => storageData,
    documentElements
};
