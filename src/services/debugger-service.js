/**
 * DebuggerService
 * Handles DevTools detection and the 5-second countdown that injects a
 * `debugger;` breakpoint into the active tab, allowing the user to freeze
 * the page DOM for inspection.
 */
class DebuggerService {
    constructor() {
        this.timer = null;
        this.btn = null;
    }

    async init() {
        this.btn = document.getElementById('freezeBtn');
        this._updateUI(false);
        console.log('[Locator-X] Debugger Service initialized');
    }

    /** Toggles the freeze button icon and tooltip to reflect active/idle state. */
    _updateUI(active) {
        if (!this.btn) return;

        if (active) {
            this.btn.classList.add('active');
            this.btn.classList.remove('bi-bug');
            this.btn.classList.add('bi-bug-fill');
            this.btn.title = 'Debugger countdown active… (click to cancel)';
        } else {
            this.btn.classList.remove('active');
            this.btn.classList.remove('bi-bug-fill');
            this.btn.classList.add('bi-bug');
            this.btn.title = 'Freeze Page (Requires DevTools F12)';
        }
    }

    // ── DevTools Detection ───────────────────────────────────────────────────

    /**
     * Returns true if the extension's own DevTools sidebar pane is open.
     * Tracked via chrome.storage.local by devtools.js.
     */
    async _isExtensionDevToolsOpen() {
        try {
            const data = await chrome.storage.local.get('devtoolsActive');
            return !!data.devtoolsActive;
        } catch {
            return false;
        }
    }

    /**
     * Returns true if browser DevTools appears open in the active tab,
     * using a window-dimension heuristic (no `debugger;` statement used).
     *
     * - Docked bottom: outerHeight − innerHeight exceeds normal browser chrome (~85 px).
     * - Docked right/left: outerWidth − innerWidth spikes similarly.
     * - Threshold of 160 px avoids false-positives from the browser's native chrome.
     *
     * Note: Undocked (floating) DevTools windows are not detectable this way;
     * in that case the method returns false.
     */
    async _isAnyDevToolsOpen() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tabId = tabs[0]?.id;
            if (!tabId) return false;

            const results = await chrome.scripting.executeScript({
                target: { tabId },
                world: 'MAIN',
                func: () => {
                    const HEIGHT_THRESHOLD = 160;
                    const WIDTH_THRESHOLD = 160;
                    const heightDiff = window.outerHeight - window.innerHeight;
                    const widthDiff = window.outerWidth - window.innerWidth;
                    return (heightDiff > HEIGHT_THRESHOLD) || (widthDiff > WIDTH_THRESHOLD);
                }
            });

            return results?.[0]?.result ?? false;
        } catch (err) {
            console.warn('[DebuggerService] DevTools dimension check failed:', err);
            return true; // Fail-open so a scripting error doesn't block the user.
        }
    }

    /**
     * Classifies the current DevTools state:
     *   'none'      – No DevTools detected → show error, abort.
     *   'extension' – Extension's sidebar panel is open inside DevTools → warn, abort.
     *   'browser'   – Standard DevTools (F12 / docked) is open → proceed with countdown.
     *
     * Both checks run in parallel to minimise latency.
     */
    async _detectDevToolsState() {
        const [isExtOpen, isAnyOpen] = await Promise.all([
            this._isExtensionDevToolsOpen(),
            this._isAnyDevToolsOpen()
        ]);

        if (isExtOpen) return 'extension';
        if (isAnyOpen && !isExtOpen) return 'browser';
        return 'none';
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Called when the user clicks the freeze button.
     *
     * - 'none'      → error notification, no action.
     * - 'extension' → warning notification, no action.
     * - 'browser'   → starts a 5-second countdown, then injects the debugger.
     *
     * If a countdown is already running, calling this method again cancels it
     * (click-to-cancel behaviour). Returns false on blocked cases, or a
     * Promise<bool> (true = fired, false = cancelled by user).
     */
    async startCountdown(onCancel) {
        const state = await this._detectDevToolsState();

        if (state === 'none') {
            LocatorX.notifications.error(
                'DevTools is not open. Press <strong>F12</strong> to open DevTools first, then try again.'
            );
            return false;
        }

        if (state === 'extension') {
            LocatorX.notifications.warn(
                'Extension DevTools panel is active. ' +
                'Open LocatorX via the <strong>sidebar</strong> and keep <strong>F12 DevTools</strong> open separately to use the debugger.'
            );
            return false;
        }

        // DevTools is open — start the countdown.
        return new Promise((resolve, reject) => {
            if (this.timer) clearTimeout(this.timer);

            this._updateUI(true);
            LocatorX.notifications.info(
                'Debugger starting in <strong>5 seconds</strong>… click the <i class="bi-bug-fill"></i> icon to cancel.'
            );

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
                    LocatorX.notifications.info('Debugger countdown cancelled.');
                    this._updateUI(false);
                    resolve(false);
                }
            };
        });
    }

    // ── Internal Helpers ─────────────────────────────────────────────────────

    /**
     * Injects a `debugger;` breakpoint into the active tab.
     * A 50 ms delay gives the extension UI time to reset before the page pauses.
     */
    async _trigger() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tabId = tabs[0]?.id;
            if (!tabId) throw new Error('No active tab found');

            await chrome.scripting.executeScript({
                target: { tabId },
                world: 'MAIN',
                func: () => {
                    setTimeout(() => {
                        // eslint-disable-next-line no-debugger
                        debugger;
                    }, 50);
                }
            });

            LocatorX.notifications.success('Page frozen! Inspect the DOM in the Sources panel.');
            this._updateUI(false);
        } catch (err) {
            console.error('[DebuggerService] Failed to trigger debugger:', err);
            LocatorX.notifications.error(
                'Failed to freeze page. Try refreshing and opening DevTools (F12) first.'
            );
            throw err;
        }
    }

    /** Clears active element highlights before freezing. Non-fatal if content script is absent. */
    async _cleanArtifacts() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tabId = tabs[0]?.id;
            if (tabId) {
                await chrome.tabs.sendMessage(tabId, { action: 'clearMatchHighlights' });
            }
        } catch (err) {
            console.log('[DebuggerService] Clean artifacts skipped (harmless):', err);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DebuggerService;
} else {
    window.DebuggerService = DebuggerService;
}
