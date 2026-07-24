/**
 * PlanService
 * 
 * Manages user plan state and provides feature gating logic.
 * Uses chrome.storage.local for secure, cross-context state management.
 */

class PlanService {
    constructor() {
        this.currentPlan = 'free';
        this.callbacks = [];
        this.initialized = false;

        // Listen for storage changes to handle plan updates reactively
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'local' && changes['locator-x-plan']) {
                    this.updatePlan(changes['locator-x-plan'].newValue || 'free');
                }
            });
        }
    }

    /**
     * Initialize the service by fetching the current plan from storage.
     */
    async init() {
        if (this.initialized) return;

        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.get(['locator-x-plan'], (result) => {
                    this.currentPlan = result['locator-x-plan'] || 'free';
                    this.initialized = true;
                    resolve(this.currentPlan);
                });
            } else {
                this.initialized = true;
                resolve(this.currentPlan);
            }
        });
    }

    /**
     * Returns the name of the current active plan.
     */
    getPlanName() {
        return LocatorXPlans.METADATA[this.currentPlan]?.name || 'Free';
    }

    /**
     * Checks if a specific feature is enabled for the current user.
     */
    isEnabled(featureId) {
        const tierFeatures = LocatorXPlans.FEATURES[this.currentPlan];

        if (tierFeatures === 'ALL') return true;
        if (Array.isArray(tierFeatures)) {
            return tierFeatures.includes(featureId);
        }

        return false;
    }

    /**
     * Retrieves a numeric limit for the current user.
     */
    getLimit(limitId) {
        const tierLimits = LocatorXPlans.LIMITS[this.currentPlan] || LocatorXPlans.LIMITS.free;
        return tierLimits[limitId] !== undefined ? tierLimits[limitId] : 0;
    }

    /**
     * Registers a callback for plan changes.
     */
    onPlanChange(callback) {
        if (typeof callback === 'function') {
            this.callbacks.push(callback);
        }
    }

    /**
     * Internal: Updates the plan and notifies listeners.
     */
    updatePlan(newPlan) {
        if (this.currentPlan === newPlan) return;

        this.currentPlan = newPlan;
        this.callbacks.forEach(cb => cb(newPlan));

        // Also trigger UI re-gating if in browser context
        if (typeof document !== 'undefined') {
            this.applyUIGates();
        }
    }

    /**
     * Scans the DOM for [data-feature] elements and apples gating logic.
     */
    applyUIGates() {
        if (typeof document === 'undefined') return;

        document.querySelectorAll('[data-feature]').forEach(el => {
            const featureId = el.getAttribute('data-feature');
            const isEnabled = this.isEnabled(featureId);

            if (!isEnabled) {
                this._lockElement(el, featureId);
            } else {
                this._unlockElement(el);
            }
        });
    }

    /**
     * Internal: Applies locked styles and tooltips.
     */
    _lockElement(el, featureId) {
        el.classList.add('feature-locked');
        el.setAttribute('data-locked', 'true');

        // Visual feedback
        el.style.opacity = '0.5';
        el.style.cursor = 'not-allowed';

        // Disable interactive elements
        if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
            el.disabled = true;
            if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'number' || el.type === 'password')) {
                el.readOnly = true;
            } else if (el.tagName === 'TEXTAREA') {
                el.readOnly = true;
            }
            if ((el.type === 'checkbox' || el.type === 'radio') && el.checked) {
                el.checked = false;
                // Trigger change event so listeners (like filter manager) know it's off
                el.dispatchEvent(new Event('change'));
            }
        }

        // Add upgrade badge if not present
        if (!el.querySelector('.upgrade-badge')) {
            const badge = document.createElement('span');
            badge.className = 'upgrade-badge';
            badge.innerText = 'PRO';
            badge.style.cssText = `
                font-size: 8px;
                background: #facc15;
                color: #000;
                padding: 1px 4px;
                border-radius: 4px;
                margin-left: 5px;
                vertical-align: middle;
            `;
            // Append to label or text content if possible
            if (el.tagName === 'LABEL') {
                if (!el.querySelector('.upgrade-badge')) el.appendChild(badge);
            } else if (el.parentElement && el.parentElement.tagName === 'LABEL') {
                // Check if parent already has it
                if (!el.parentElement.querySelector('.upgrade-badge')) {
                    el.parentElement.appendChild(badge);
                }
            }
        }

        // Handle clicks and key activations - Redirect to upgrade
        const attachUpgradePrompt = (targetEl) => {
            if (!targetEl.hasUpgradeListener) {
                targetEl.addEventListener('click', (e) => {
                    if (el.getAttribute('data-locked') === 'true') {
                        e.preventDefault();
                        e.stopPropagation();
                        this._showUpgradePrompt(featureId);
                    }
                }, true);

                targetEl.addEventListener('keydown', (e) => {
                    if (el.getAttribute('data-locked') === 'true') {
                        if ([' ', 'Enter'].includes(e.key)) {
                            e.preventDefault();
                            e.stopPropagation();
                            this._showUpgradePrompt(featureId);
                        }
                    }
                }, true);

                targetEl.hasUpgradeListener = true;
            }
        };

        attachUpgradePrompt(el);

        // Bubble up listeners to parent containers (like labels and toggle switch wrappers)
        // since disabled inputs do not receive or fire mouse events natively.
        let parent = el.parentElement;
        while (parent && parent !== document.body) {
            if (parent.tagName === 'LABEL' || parent.classList.contains('toggle-switch') || parent.classList.contains('setting-option') || parent.classList.contains('setting-group')) {
                attachUpgradePrompt(parent);
            }
            parent = parent.parentElement;
        }
    }

    /**
     * Internal: Clears locked state.
     */
    _unlockElement(el) {
        el.classList.remove('feature-locked');
        el.removeAttribute('data-locked');
        el.style.opacity = '1';
        el.style.cursor = '';

        if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
            el.disabled = false;
            el.readOnly = false;
        }

        const badge = el.querySelector('.upgrade-badge');
        if (badge) badge.remove();
    }

    /**
     * Internal: Triggers a notification or modal to upgrade.
     */
    _showUpgradePrompt(featureId) {
        const upgradeUrl = LocatorXPlans.METADATA.pro.upgradeUrl;

        if (typeof window !== 'undefined' && window.LocatorX && window.LocatorX.notifications) {
            window.LocatorX.notifications.info(
                `Unlock PRO features to access this setting. <a href="${upgradeUrl}" target="_blank" style="color: #60a5fa; text-decoration: underline;">Upgrade Now</a>`,
                'Feature Locked'
            );
        } else {
            console.log(`Unlock PRO features to access this setting. Visit ${upgradeUrl} to upgrade.`);
        }
    }
}

// Universal Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlanService;
} else if (typeof window !== 'undefined') {
    window.planService = new PlanService();
} else if (typeof self !== 'undefined') {
    self.planService = new PlanService();
}
