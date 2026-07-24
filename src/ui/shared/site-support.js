// Site Support Detection Module
const SiteSupport = {
    isSupported: false,
    isAuditorSupported: false,
    initialized: false,

    init() {
        if (this.initialized) return;
        this.initialized = true;

        this.check();

        // Continuous checks
        if (chrome.tabs) {
            chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
                if (changeInfo.status === 'complete' || changeInfo.url) {
                    this.check();
                }
            });

            chrome.tabs.onActivated.addListener(() => {
                this.check();
            });
        }
    },

    check() {
        if (!chrome.tabs) return;

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab) return;

            const url = tab.url || '';
            // Supported: http, https, file. Unsupported: chrome://, edge://, about:, etc.
            let isSupported = url.startsWith('http') || url.startsWith('file');

            if (isSupported) {
                chrome.storage.local.get(['extensionIgnoreUrls', 'auditorIgnoreUrls'], (res) => {
                    const ignoreText = res.extensionIgnoreUrls || '';
                    const patterns = ignoreText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                    for (const pattern of patterns) {
                        try {
                            const regex = new RegExp(pattern, 'i');
                            if (regex.test(url)) {
                                isSupported = false;
                                break;
                            }
                        } catch (e) {
                            // ignore invalid regex
                        }
                    }

                    let isAuditorSupported = isSupported;
                    if (isAuditorSupported) {
                        const auditorIgnoreText = res.auditorIgnoreUrls || '';
                        const auditorPatterns = auditorIgnoreText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                        for (const pattern of auditorPatterns) {
                            try {
                                const regex = new RegExp(pattern, 'i');
                                if (regex.test(url)) {
                                    isAuditorSupported = false;
                                    break;
                                }
                            } catch (e) {
                                // ignore invalid regex
                            }
                        }
                    }

                    this.isSupported = isSupported;
                    this.isAuditorSupported = isAuditorSupported;
                    this.updateUI();
                });
            } else {
                this.isSupported = isSupported;
                this.isAuditorSupported = isSupported;
                this.updateUI();
            }
        });
    },

    updateUI() {
        // UI updates are specific to the sidepanel usually, but we check if elements exist
        const inspectBtn = document.getElementById('inspectBtn');
        const statusIndicator = document.getElementById('siteSupportStatus');

        if (statusIndicator) {
            statusIndicator.className = this.isSupported ? 'status-dot supported' : 'status-dot unsupported';
            statusIndicator.title = this.isSupported ? 'Site Supported' : 'Site Not Supported';
        }

        if (inspectBtn) {
            if (this.isSupported) {
                inspectBtn.classList.remove('disabled');
                inspectBtn.title = 'Inspect Elements';
            } else {
                inspectBtn.classList.add('disabled');
                inspectBtn.title = 'Site not supported';

                // Ensure inspect is deactivated if site becomes unsupported
                if (window.LocatorX && window.LocatorX.inspect && window.LocatorX.inspect.isActive) {
                    window.LocatorX.inspect.deactivate();
                }
            }
        }

        // Handle Link Auditor button state
        const navLinkAuditor = document.getElementById('navLinkAuditor');
        if (navLinkAuditor) {
            if (this.isAuditorSupported) {
                navLinkAuditor.classList.remove('disabled');
                navLinkAuditor.removeAttribute('title');
            } else {
                navLinkAuditor.classList.add('disabled');
                navLinkAuditor.title = 'Link Auditor is disabled on this page';

                // Automatically close the dropdown if active tab transitions to a disabled URL
                const dropdownEl = document.getElementById('linkAuditorDropdown');
                if (dropdownEl && dropdownEl.style.display === 'block') {
                    dropdownEl.style.display = 'none';
                    navLinkAuditor.classList.remove('active');
                }
            }
        }

        // Also update inspect button visual state if it was active/inactive
        if (window.LocatorX && window.LocatorX.inspect) {
            window.LocatorX.inspect.updateUI();
        }
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SiteSupport;
} else {
    window.SiteSupport = SiteSupport;
}
