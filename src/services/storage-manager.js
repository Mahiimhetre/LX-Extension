// Core Storage Manager - Backend Logic (Asynchronous for Manifest V3)
const sJson = typeof secureJson !== 'undefined' ? secureJson : (typeof require !== 'undefined' ? require('../utils/secure-json.js') : null);

class StorageManager {
    constructor(storagePrefix = LocatorXConfig.STORAGE_KEYS.PREFIX) {
        this.prefix = storagePrefix;
        this.migrationTag = 'lx_migrated_v3';
    }

    /**
     * Migration utility: Moves data from localStorage to chrome.storage.local
     * Runs on first call to any storage method if not already migrated.
     */
    async ensureMigrated() {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

        const migrationCheck = await this._getRaw(this.migrationTag);
        if (migrationCheck) return; // Already migrated

        console.log('[Locator-X] Starting data migration from localStorage to chrome.storage.local...');

        const keysToMigrate = [
            LocatorXConfig.STORAGE_KEYS.SAVED,
            LocatorXConfig.STORAGE_KEYS.POM_PAGES,
            LocatorXConfig.STORAGE_KEYS.SETTINGS,
            LocatorXConfig.STORAGE_KEYS.HISTORY,
            LocatorXConfig.STORAGE_KEYS.THEME,
            LocatorXConfig.STORAGE_KEYS.FILTERS('home'),
            LocatorXConfig.STORAGE_KEYS.FILTERS('pom')
        ];

        const migrationData = {};
        for (const key of keysToMigrate) {
            const val = localStorage.getItem(key);
            if (val) {
                try {
                    // Try to parse as JSON, if it fails, store as raw string (for theme)
                    migrationData[key] = sJson ? sJson.parse(val) : JSON.parse(val);
                } catch (e) {
                    migrationData[key] = val;
                }
            }
        }

        if (Object.keys(migrationData).length > 0) {
            await chrome.storage.local.set(migrationData);
            console.log(`[Locator-X] Migrated ${Object.keys(migrationData).length} keys.`);
        }

        await chrome.storage.local.set({ [this.migrationTag]: true });
    }

    // Helper for async storage access
    async _getRaw(key) {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get([key], (result) => {
                    resolve(result[key]);
                });
            } else {
                // Fallback to localStorage for non-extension environments (testing)
                const val = localStorage.getItem(key);
                try { resolve(sJson ? sJson.parse(val) : JSON.parse(val)); } catch (e) { resolve(val); }
            }
        });
    }

    async _setRaw(key, value) {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ [key]: value }, resolve);
            } else {
                const val = typeof value === 'string' ? value : JSON.stringify(value);
                localStorage.setItem(key, val);
                resolve();
            }
        });
    }

    async _removeRaw(key) {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.remove([key], resolve);
            } else {
                localStorage.removeItem(key);
                resolve();
            }
        });
    }

    // Saved Locators Management
    async getSavedLocators() {
        await this.ensureMigrated();
        const data = await this._getRaw(LocatorXConfig.STORAGE_KEYS.SAVED);
        return Array.isArray(data) ? data : [];
    }

    async saveLocator(locator) {
        await this.ensureMigrated();
        const saved = await this.getSavedLocators();
        const existing = saved.find(item => item.locator === locator.locator);

        if (existing) {
            Object.assign(existing, locator);
        } else {
            saved.push({
                ...locator,
                id: Date.now(),
                date: new Date().toISOString()
            });
        }

        await this._setRaw(LocatorXConfig.STORAGE_KEYS.SAVED, saved);
        return existing ? 'updated' : 'created';
    }

    async deleteLocator(id) {
        await this.ensureMigrated();
        const saved = await this.getSavedLocators();
        const filtered = saved.filter(item => item.id !== id);
        await this._setRaw(LocatorXConfig.STORAGE_KEYS.SAVED, filtered);
        return saved.length !== filtered.length;
    }

    // POM Pages Management
    async getPOMPages() {
        await this.ensureMigrated();
        const data = await this._getRaw(LocatorXConfig.STORAGE_KEYS.POM_PAGES);
        return Array.isArray(data) ? data : [];
    }

    async savePOMPage(page) {
        await this.ensureMigrated();
        const pages = await this.getPOMPages();
        const existingIndex = pages.findIndex(p => p.id === page.id);

        if (existingIndex !== -1) {
            pages[existingIndex] = { ...pages[existingIndex], ...page, updatedAt: new Date().toISOString() };
        } else {
            pages.push({
                ...page,
                id: page.id || `pom_${Date.now()}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }

        await this._setRaw(LocatorXConfig.STORAGE_KEYS.POM_PAGES, pages);
        return existingIndex !== -1 ? 'updated' : 'created';
    }

    async deletePOMPage(pageId) {
        await this.ensureMigrated();
        const pages = await this.getPOMPages();
        const filtered = pages.filter(p => p.id !== pageId);
        await this._setRaw(LocatorXConfig.STORAGE_KEYS.POM_PAGES, filtered);
        return pages.length !== filtered.length;
    }

    // Settings Management
    async getSettings() {
        await this.ensureMigrated();
        const data = await this._getRaw(LocatorXConfig.STORAGE_KEYS.SETTINGS);
        const settings = (data && typeof data === 'object') ? data : {};
        if (!settings.selectedFramework) {
            settings.selectedFramework = 'playwright';
        }
        return settings;
    }

    async saveSetting(key, value) {
        await this.ensureMigrated();
        const settings = await this.getSettings();
        settings[key] = value;
        await this._setRaw(LocatorXConfig.STORAGE_KEYS.SETTINGS, settings);
    }

    async getSetting(key, defaultValue = null) {
        const settings = await this.getSettings();
        return settings[key] !== undefined ? settings[key] : defaultValue;
    }

    // Filter State Management
    async getFilterState(tab) {
        await this.ensureMigrated();
        const data = await this._getRaw(LocatorXConfig.STORAGE_KEYS.FILTERS(tab));
        return (data && typeof data === 'object') ? data : {};
    }

    async saveFilterState(tab, filters) {
        await this.ensureMigrated();
        await this._setRaw(LocatorXConfig.STORAGE_KEYS.FILTERS(tab), filters);
    }

    // History Management
    async getHistory() {
        await this.ensureMigrated();
        const data = await this._getRaw(LocatorXConfig.STORAGE_KEYS.HISTORY);
        return Array.isArray(data) ? data : [];
    }

    async addToHistory(item) {
        await this.ensureMigrated();
        const history = await this.getHistory();
        history.unshift({
            ...item,
            id: Date.now(),
            timestamp: new Date().toISOString()
        });

        // Limit history based on plan
        let max = 50;
        if (typeof planService !== 'undefined') {
            max = planService.getLimit('MAX_HISTORY_ITEMS') || 50;
        } else if (typeof LocatorXConfig !== 'undefined' && LocatorXConfig.LIMITS) {
            max = LocatorXConfig.LIMITS.HISTORY_MAX || 50;
        }

        if (history.length > max) {
            history.splice(max);
        }

        await this._setRaw(LocatorXConfig.STORAGE_KEYS.HISTORY, history);
    }

    async clearHistory() {
        await this.ensureMigrated();
        await this._removeRaw(LocatorXConfig.STORAGE_KEYS.HISTORY);
    }

    // Theme Management
    async getTheme() {
        await this.ensureMigrated();
        const theme = await this._getRaw(LocatorXConfig.STORAGE_KEYS.THEME);
        return theme || 'light';
    }

    async saveTheme(theme) {
        await this.ensureMigrated();
        await this._setRaw(LocatorXConfig.STORAGE_KEYS.THEME, theme);
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
} else {
    window.StorageManager = StorageManager;
}