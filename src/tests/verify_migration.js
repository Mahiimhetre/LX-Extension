/**
 * Automated Verification for LocatorX Storage Migration (Manifest V3)
 * This script validates that:
 * 1. chrome.storage.local is the single source of truth.
 * 2. Data migration from Legacy to V3 works correctly.
 */

const assert = (condition, message) => {
    if (!condition) throw new Error(`FAILED: ${message}`);
    console.log(`PASSED: ${message}`);
};

async function runMigrationTests() {
    console.log('--- Starting LocatorX Migration Verification ---');

    // 1. Mock chrome.storage.local if running in a non-extension environment
    if (typeof chrome === 'undefined' || !chrome.storage) {
        console.log('Mocking chrome.storage.local for test environment...');
        const mockStore = {};
        global.chrome = {
            storage: {
                local: {
                    get: (keys, cb) => {
                        const res = {};
                        if (Array.isArray(keys)) {
                            keys.forEach(k => res[k] = mockStore[k]);
                        } else if (typeof keys === 'string') {
                            res[keys] = mockStore[keys];
                        } else {
                            Object.assign(res, mockStore);
                        }
                        if (cb) cb(res);
                        return Promise.resolve(res);
                    },
                    set: (obj, cb) => {
                        Object.assign(mockStore, obj);
                        if (cb) cb();
                        return Promise.resolve();
                    },
                    remove: (keys, cb) => {
                        if (Array.isArray(keys)) keys.forEach(k => delete mockStore[k]);
                        else delete mockStore[keys];
                        if (cb) cb();
                        return Promise.resolve();
                    },
                    clear: (cb) => {
                        for (let k in mockStore) delete mockStore[k];
                        if (cb) cb();
                        return Promise.resolve();
                    }
                }
            },
            runtime: { lastError: null }
        };
    }

    // 2. Prepare Legacy Data in localStorage
    const legacyPOM = [{ id: 'legacy_1', name: 'Legacy Page', locators: [] }];
    localStorage.setItem('locator-x-pom', JSON.stringify(legacyPOM));
    localStorage.setItem('locator-x-theme', 'dark');

    // 3. Import and Run StorageManager migration
    // (Assuming we are in a test runner that handles imports, or using required modules)
    const StorageManager = require('../services/storage-manager');
    const manager = new StorageManager();

    console.log('Running ensureMigrated()...');
    await manager.ensureMigrated();

    // 4. Verify Migration
    const pomKey = LocatorXConfig.STORAGE_KEYS.POM_PAGES;
    const themeKey = LocatorXConfig.STORAGE_KEYS.THEME;
    const migratedData = await chrome.storage.local.get([pomKey, themeKey]);

    assert(migratedData[pomKey].length === 1, 'POM pages migrated to chrome.storage');
    assert(migratedData[pomKey][0].id === 'legacy_1', 'POM data integrity maintained');
    assert(migratedData[themeKey] === 'dark', 'Theme preference migrated');

    // 5. Verify localStorage Cleanup (Decoupling)
    // The StorageManager should NOT necessarily delete legacy data yet (for safety), 
    // but the code should no longer READ from it.
    // However, our verification should ensure that LocatorXCore uses the NEW store.

    const LocatorXCore = require('../services/locator-x-core');
    const core = new LocatorXCore();
    await core.initialize();

    const pages = await core.getPOMPages();
    assert(pages.length === 1, 'LocatorXCore reads from migrated chrome.storage');

    // 6. Test write through Core
    await core.savePOMPage({ id: 'new_page', name: 'New Page', locators: [] });
    const updatedLocal = await chrome.storage.local.get(pomKey);
    assert(updatedLocal[pomKey].length === 2, 'LocatorXCore writes to chrome.storage');

    // Ensure localStorage was NOT touched during the write
    const legacyAfterWrite = JSON.parse(localStorage.getItem('locator-x-pom') || '[]');
    assert(legacyAfterWrite.length === 1, 'localStorage remained untouched during new writes (isolation)');

    console.log('--- ALL STORAGE MIGRATION TESTS PASSED ---');
}

// Minimal browser-like environment for Node testing
if (typeof window === 'undefined') {
    global.window = global;
    global.localStorage = {
        _store: {},
        setItem(k, v) { this._store[k] = v; },
        getItem(k) { return this._store[k] || null; },
        removeItem(k) { delete this._store[k]; }
    };
    global.document = { evaluate: () => ({ snapshotLength: 0 }) };
    global.Node = { ELEMENT_NODE: 1 };

    // Define extension globals for node test execution
    global.LocatorXConfig = {
        STORAGE_KEYS: {
            PREFIX: 'lx_',
            SAVED: 'locator-x-saved',
            POM_PAGES: 'locator-x-pom',
            SETTINGS: 'locator-x-settings',
            HISTORY: 'locator-x-history',
            THEME: 'locator-x-theme',
            FILTERS: (tab) => `locator-x-filters-${tab}`
        }
    };
    global.LocatorGenerator = class {
        generateLocators() { return []; }
    };
    global.FilterManager = class {
        createDefaultFilterState() { return {}; }
        applyFrameworkRules() { return {}; }
    };
    global.StorageManager = require('../services/storage-manager');
    global.planService = { getLimit() { return 50; } };
}

runMigrationTests().catch(err => {
    console.error('Migration Test Failed:', err);
    process.exit(1);
});
