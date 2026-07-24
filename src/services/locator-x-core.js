// Core API - Main Backend Interface
class LocatorXCore {
    constructor() {
        this.generator = new LocatorGenerator();
        this.storage = new StorageManager();
        this.filterManager = new FilterManager();
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        // Load saved settings
        this.settings = await this.storage.getSettings();
        this.theme = await this.storage.getTheme();

        this.initialized = true;
    }

    // Locator Generation
    async generateLocators(element, options = {}) {
        const enabledFilters = await options.filters || await this.getEnabledFilters();
        const locators = this.generator.generateLocators(element, {
            strategies: enabledFilters
        });

        // Add to history
        await this.storage.addToHistory({
            type: 'generation',
            element: this.getElementInfo(element),
            locators: locators,
            filters: enabledFilters
        });

        return locators;
    }

    // Filter Management
    async getEnabledFilters(tab = 'home') {
        const filterState = await this.storage.getFilterState(tab);
        return this.filterManager.getEnabledFilters(filterState);
    }

    async updateFilters(tab, filters) {
        await this.storage.saveFilterState(tab, filters);

        // Validate with current framework
        const framework = await this.getSetting('framework', 'unknown');

        return this.filterManager.validateFilterCombination(
            await this.getEnabledFilters(tab),
            framework
        );
    }

    async applyDependencyRules(framework) {
        const defaultFilters = this.filterManager.createDefaultFilterState();

        let homeFilters = this.filterManager.applyFrameworkRules(framework, defaultFilters);

        let pomFilters = { ...homeFilters };

        await this.storage.saveFilterState('home', homeFilters);
        await this.storage.saveFilterState('pom', pomFilters);

        return { homeFilters, pomFilters };
    }

    // Settings Management
    async getSetting(key, defaultValue = null) {
        return await this.storage.getSetting(key, defaultValue);
    }

    async saveSetting(key, value) {
        await this.storage.saveSetting(key, value);

        // Apply dependency rules if framework changed
        if (key === 'framework') {
            const framework = await this.getSetting('framework', 'unknown');
            return await this.applyDependencyRules(framework);
        }
    }

    // Saved Locators Management
    async getSavedLocators() {
        return await this.storage.getSavedLocators();
    }

    async saveLocator(data) {
        // Support both old (name, type, locator) and new (obj) signatures
        if (typeof data === 'string') {
            return await this.storage.saveLocator({
                name: data || this.generateAutoName(),
                type: arguments[1],
                locator: arguments[2]
            });
        }
        return await this.storage.saveLocator(data);
    }

    async deleteLocator(id) {
        return await this.storage.deleteLocator(id);
    }

    // POM Management
    async getPOMPages() {
        return await this.storage.getPOMPages();
    }

    async savePOMPage(page) {
        if (page && typeof page.name === 'string') {
            page.name = page.name.replace(/<\/?[^>]+(>|$)/g, "");
        }
        return await this.storage.savePOMPage(page);
    }

    async deletePOMPage(pageId) {
        return await this.storage.deletePOMPage(pageId);
    }

    // Theme Management
    async getTheme() {
        return await this.storage.getTheme();
    }

    async setTheme(theme) {
        await this.storage.saveTheme(theme);
        this.theme = theme;
    }

    async toggleTheme() {
        const newTheme = this.theme === 'light' ? 'dark' : 'light';
        await this.setTheme(newTheme);
        return newTheme;
    }

    // History Management
    async getHistory() {
        return await this.storage.getHistory();
    }

    async clearHistory() {
        await this.storage.clearHistory();
    }

    // Utility Methods
    generateAutoName() {
        return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    }

    getElementInfo(element) {
        return {
            tagName: element.tagName,
            id: element.id,
            className: element.className,
            textContent: element.textContent?.slice(0, 50)
        };
    }

    // Validation
    validateLocator(locator, type) {
        try {
            if (type === 'css') {
                document.querySelector(locator);
            } else if (type === 'xpath') {
                document.evaluate(locator, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            }
            return { valid: true };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    async checkDuplicateSaved(locator, type) {
        const saved = await this.storage.getSavedLocators();
        return saved.some(item => item.locator === locator && item.type === type);
    }

    checkDuplicatePOM(existingRows, newLocators, checkedTypes) {
        return existingRows.some(row => {
            return checkedTypes.every(type => {
                const rowValue = row[type];
                const matchingLocator = newLocators.find(loc => loc.type === type);
                const newValue = matchingLocator ? matchingLocator.locator : '-';
                return rowValue === newValue;
            });
        });
    }

    // Export/Import
    async exportData() {
        return {
            saved: await this.getSavedLocators(),
            settings: await this.storage.getSettings(),
            history: await this.getHistory(),
            version: (typeof LocatorXConfig !== 'undefined') ? LocatorXConfig.VERSION : '1.0'
        };
    }

    async importData(data) {
        if (data.saved) {
            await this.storage._setRaw(LocatorXConfig.STORAGE_KEYS.SAVED, data.saved);
        }
        if (data.settings) {
            await this.storage._setRaw(LocatorXConfig.STORAGE_KEYS.SETTINGS, data.settings);
        }
        if (data.history) {
            await this.storage._setRaw(LocatorXConfig.STORAGE_KEYS.HISTORY, data.history);
        }
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocatorXCore;
} else {
    window.LocatorXCore = LocatorXCore;
}