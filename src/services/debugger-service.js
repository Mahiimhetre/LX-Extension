class DebuggerService {
    constructor() {
        this.timer = null;
        this.btn = null;
    }

    async init() {
        this.btn = document.getElementById('freezeBtn');
        this._updateUI(false);
        console.log('[Locator-X] Debugger Service initialized (Silent Mode)');
    }

    _updateUI(frozen) {
        if (!this.btn) return;

        if (frozen) {
            this.btn.classList.add('active');
            this.btn.classList.remove('bi-bug');
            this.btn.classList.add('bi-play-fill');
            this.btn.title = "Page Frozen (Resume via F8)";
        } else {
            this.btn.classList.remove('active');
            this.btn.classList.remove('bi-play-fill');
            this.btn.classList.add('bi-bug');
            this.btn.title = "Freeze Page (5s delay)";
        }
    }

    startCountdown(onCancel) {
        return new Promise((resolve, reject) => {
            if (this.timer) clearTimeout(this.timer);

            if (this.btn) this.btn.classList.add('active');
            LocatorX.notifications.info('Debugger starting in 5 seconds...');

            this.timer = setTimeout(async () => {
                this.timer = null;
                try {
                    await this._cleanArtifacts();
                    await this._trigger();
                    resolve(true);
                } catch (err) {
                    this._updateUI(false);
                    reject(err);
                }
            }, 5000);

            this.cancel = () => {
                if (this.timer) {
                    clearTimeout(this.timer);
                    this.timer = null;
                    if (onCancel) onCancel();
                    LocatorX.notifications.info('Debugger start cancelled.');
                    this._updateUI(false);
                    resolve(false);
                }
            };
        });
    }

    async _trigger() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tabId = tabs[0]?.id;
            if (!tabId) throw new Error('No active tab found');

            await chrome.tabs.sendMessage(tabId, { action: 'executeDebugger' });
            LocatorX.notifications.success('Debugger paused! Open DevTools (F12) to inspect.');
            this._updateUI(true);

            // Auto-reset UI after a delay since we can't detect resume?
            // Or just leave it "frozen" until they click again to reset.
            // Let's leave it frozen-looking so they know state, but clicking again resets it.
        } catch (err) {
            console.error('Failed to trigger silent debugger:', err);
            LocatorX.notifications.error('Failed to trigger debugger. Refresh page?');
            throw err;
        }
    }

    async _cleanArtifacts() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tabId = tabs[0]?.id;
            if (tabId) {
                await chrome.tabs.sendMessage(tabId, { action: 'clearMatchHighlights' });
            }
        } catch (err) {
            console.log('[DebuggerService] Clean artifacts failed (harmless):', err);
        }
    }

    // Resume is purely UI reset now
    reset() {
        this._updateUI(false);
        LocatorX.notifications.info('UI reset. Remember to resume browser (F8).');
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DebuggerService;
} else {
    window.DebuggerService = DebuggerService;
}
