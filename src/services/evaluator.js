/**
 * Evaluator Service
 * Centralized logic for locator evaluation, highlighting, and code unwrapping.
 */
class Evaluator {
    constructor() {
        this.patterns = [
            // Selenium: By.id("..."), By.xpath('...')
            { regex: /By\.(?:xpath|id|name|className|cssSelector|linkText|partialLinkText)\s*\(\s*(['"])(.*?)\1\s*\)/i, typeIndex: 0, locatorIndex: 2 },
            // Selenium/Appium: findElement(By.id("..."))
            { regex: /findElement\s*\(\s*By\.[a-z]+\s*\(\s*(['"])(.*?)\1\s*\)\s*\)/i, typeIndex: 0, locatorIndex: 2 },
            // Playwright/Cypress/WDIO: page.locator("..."), cy.get('...'), $('...')
            { regex: /(?:\.locator|get|xpath|contains|\$)\s*\(\s*(['"])(.*?)\1\s*\)/i, typeIndex: 0, locatorIndex: 2 },
            // Generic method-like: find("...")
            { regex: /[a-z0-9_]+\s*\(\s*(['"])(.*?)\1\s*\)/i, typeIndex: 0, locatorIndex: 2 }
        ];

        // State for traversal
        this.totalMatches = 0;
        this.currentGlobalIndex = -1;
        this.frameDistribution = [];
        this.lastSelector = null;
        this.lastBadgeId = null;
        this.lastRequestId = 0;
    }

    async evaluate(source, options = {}) {
        const settings = {
            type: 'auto',
            badge: null,
            highlight: true,
            callback: null,
            mode: 'home',
            ...options
        };

        let locator = '';
        let type = settings.type;

        if (typeof source === 'string') {
            const el = document.getElementById(source);
            locator = el ? (el.value || el.textContent) : source;
        } else if (source instanceof HTMLElement) {
            locator = source.value || source.textContent;
        }

        locator = locator ? locator.trim() : '';

        // Smart Unwrapping: If it looks like code, extract the selector
        if (this._isPotentialCode(locator)) {
            const unwrapped = this._unwrapCode(locator);
            if (unwrapped) {
                locator = unwrapped.locator;
                if (type === 'auto') type = unwrapped.type;
            }
        }

        // Identify Request
        const requestId = ++this.lastRequestId;

        // Reset Traversal State (Global) to block navigation during refresh
        this.totalMatches = 0;
        this.frameDistribution = [];
        this.currentGlobalIndex = -1;
        this.lastSelector = locator;
        this.lastBadgeId = settings.badge;

        if (!locator) {
            this.frameDistribution = [];
            this._updateBadge(settings.badge, 0);
            if (settings.callback) settings.callback(0);
            return 0;
        }

        if (type === 'auto') {
            type = null; // Let content script handle smart discovery
        }

        this._updateBadge(settings.badge, '...');

        // Check Smart Correction and Match Limit preferences
        const config = await new Promise(r => chrome.storage.local.get(['smartCorrectEnabled', 'maxMatchLimit'], r));
        const enableSmartCorrect = config.smartCorrectEnabled !== undefined ? config.smartCorrectEnabled : true;
        const maxCap = (typeof LocatorXConfig !== 'undefined') ? LocatorXConfig.LIMITS.MAX_MATCH_DEFAULT : 500;
        const maxMatchLimit = Math.min(config.maxMatchLimit !== undefined ? config.maxMatchLimit : 150, maxCap);

        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const tab = tabs[0];
                if (!tab || !tab.id) return resolve(0);

                chrome.webNavigation.getAllFrames({ tabId: tab.id }, (frames) => {
                    let pending = frames.length;
                    let primaryResponse = null;
                    let accumulator = 0;

                    // Temporary array to hold results in order
                    const frameResults = new Array(frames.length).fill(null);

                    frames.forEach((frame, index) => {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'evaluateSelector',
                            selector: locator,
                            type: type,
                            requestId: requestId,
                            maxMatchLimit: maxMatchLimit,
                            enableSmartCorrect: enableSmartCorrect
                        }, { frameId: frame.frameId }, (response) => {
                            // Safeguard: Ignore stale responses
                            if (requestId !== this.lastRequestId) return;

                            if (!chrome.runtime.lastError && response) {
                                frameResults[index] = {
                                    frameId: frame.frameId,
                                    count: response.count || 0
                                };

                                accumulator += (response.count || 0);

                                if (response.count === 1 && !primaryResponse) {
                                    primaryResponse = response;
                                }
                                // Capture suggestion even if match count is 0
                                if (response.suggestedLocator && !primaryResponse) {
                                    primaryResponse = response;
                                }
                            } else {
                                frameResults[index] = { frameId: frame.frameId, count: 0 };
                            }

                            pending--;
                            if (pending <= 0) {
                                // Finalize State atomically
                                this.totalMatches = accumulator;
                                this.frameDistribution = frameResults.filter(f => f && f.count > 0);

                                if (this.totalMatches > 0) {
                                    this.currentGlobalIndex = 0;
                                    this._updateBadge(settings.badge, `1/${this.totalMatches}`);

                                    if (settings.highlight && this.frameDistribution.length > 0) {
                                        const firstFrame = this.frameDistribution[0];
                                        this.highlightSingle(firstFrame.frameId, 0);
                                    }
                                } else {
                                    this.currentGlobalIndex = -1;
                                    this._updateBadge(settings.badge, 0);
                                }

                                if (settings.callback) settings.callback(this.totalMatches, primaryResponse || { count: this.totalMatches });
                                resolve(this.totalMatches);
                            }
                        });
                    });
                });
            });
        });
    }

    async highlight(selector, action = 'highlightMatches', mode = 'home', index = null) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab && tab.id) {
                chrome.webNavigation.getAllFrames({ tabId: tab.id }, (frames) => {
                    frames.forEach(frame => {
                        chrome.tabs.sendMessage(tab.id, {
                            action: action,
                            selector: selector,
                            mode: mode,
                            index: index
                        }, { frameId: frame.frameId }).catch(() => { });
                    });
                });
            }
        });
    }

    navigate(direction) {
        if (this.totalMatches === 0) return 0;

        this.currentGlobalIndex += direction;
        // Cyclic Logic
        if (this.currentGlobalIndex >= this.totalMatches) this.currentGlobalIndex = 0;
        if (this.currentGlobalIndex < 0) this.currentGlobalIndex = this.totalMatches - 1;

        // Determine which frame controls this index
        let remaining = this.currentGlobalIndex;
        let targetFrame = null;
        let localIndex = 0;

        // Note: frameDistribution order depends on async response time in evaluate.
        // ideally we should have sorted it by frameId or creation order, but for now we follow capture order.
        for (const fd of this.frameDistribution) {
            if (remaining < fd.count) {
                targetFrame = fd.frameId;
                localIndex = remaining;
                break;
            }
            remaining -= fd.count;
        }

        // Update Badge Text (e.g., 1/6)
        if (this.lastBadgeId) {
            // +1 for 1-based display
            this._updateBadge(this.lastBadgeId, `${this.currentGlobalIndex + 1}/${this.totalMatches}`);
        }

        // Trigger Highlight
        this.highlightSingle(targetFrame, localIndex);

        return this.currentGlobalIndex;
    }

    highlightSingle(frameId, localIndex) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab || !tab.id) return;

            // 1. Clear highlights in all other frames that have matches
            this.frameDistribution.forEach(fd => {
                if (fd.frameId !== frameId) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'clearMatchHighlights'
                    }, { frameId: fd.frameId }).catch(() => { });
                }
            });

            // 2. Highlight specific match in target frame
            if (frameId !== null) {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'highlightMatches',
                    selector: this.lastSelector,
                    mode: 'home',
                    index: localIndex
                }, { frameId: frameId }).catch(() => { });
            }
        });
    }

    async _shouldEnableSmartCorrect() {
        return new Promise((resolve) => {
            // Check if feature is available for user's plan
            const isPlanAllowed = (typeof planService !== 'undefined') ?
                planService.isEnabled('module.smartCorrect') : false;

            if (!isPlanAllowed) {
                resolve(false);
                return;
            }

            // Check user preference from storage
            chrome.storage.local.get(['smartCorrectEnabled'], (result) => {
                // Default to true if not set
                const enabled = result.smartCorrectEnabled !== undefined ? result.smartCorrectEnabled : true;
                resolve(enabled);
            });
        });
    }

    _isPotentialCode(text) {
        if (!text || text.length < 5) return false;
        const markers = ['(', ')', '.', 'By.', 'cy.', 'page.', 'driver.', 'findElement', 'await', '$'];
        return markers.some(m => text.includes(m));
    }

    _unwrapCode(code) {
        for (const p of this.patterns) {
            const match = code.match(p.regex);
            if (match) {
                let locator = match[p.locatorIndex];
                let type = 'auto';

                const matchText = match[0].toLowerCase();
                if (matchText.includes('xpath')) type = 'xpath';
                else if (matchText.includes('css') || matchText.includes('get(')) type = 'css';
                else if (matchText.includes('id(')) type = 'id';
                else if (matchText.includes('name(')) type = 'name';
                else if (matchText.includes('linktext(')) type = 'linkText';

                return { locator, type };
            }
        }
        return null;
    }

    _updateBadge(badge, count) {
        let el = typeof badge === 'string' ? document.getElementById(badge) : badge;

        // Safety Check: If this is the search badge, ensure input isn't empty
        // This prevents race conditions where specific evaluations return after clear
        if (el && el.id === 'searchMatchBadge') {
            const input = document.getElementById('searchInput');
            if (input && input.value.trim().length === 0) {
                el.classList.add('hidden');
                return;
            }
        }

        if (el && el.dataset) {
            el.dataset.count = count;
            el.textContent = count;
            el.classList.remove('hidden');
        }
    }
}

// Global Export
if (typeof window !== 'undefined') {
    window.Evaluator = Evaluator;
    console.log('[Locator-X] Evaluator service loaded');
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Evaluator;
}
