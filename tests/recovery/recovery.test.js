const assert = require('assert');
const env = require('../page-objects/mock-environment.js');

const suites = [];
const test = (name, fn) => suites.push({ name, fn });

test('Recovery: should recover state from chrome.storage if panel crashes/reloads', async () => {
    // 1. Simulate state before crash/close saved in chrome.storage.local
    const expectedFilters = { css: { enabled: true, disabled: false } };
    env.setStorage({
        'locator-x-filters-1': expectedFilters
    });
    
    // 2. Initialize a new StorageManager (simulating panel reloading)
    const StorageManager = require('../../src/services/storage-manager.js');
    const sm = new StorageManager();
    
    const filters = await sm.getFilterState(1);
    assert.deepStrictEqual(filters, expectedFilters, 'Should recover saved filters state from storage');
});

test('Recovery: fallback to default if storage is corrupted or unparseable', async () => {
    env.setStorage({
        'locator-x-settings': 'invalid-json-string'
    });
    
    const StorageManager = require('../../src/services/storage-manager.js');
    const sm = new StorageManager();
    
    // Recovery should fall back to default settings without crashing
    const settings = await sm.getSettings();
    assert.ok(settings, 'Should fall back to default settings on storage corruption');
    assert.strictEqual(settings.selectedFramework, 'playwright', 'Should use playwright default framework');
});

async function runTests() {
    console.log('\n--- Running Recovery Tests ---');
    let passed = 0;
    for (const { name, fn } of suites) {
        try {
            await fn();
            console.log(`✅ PASSED: ${name}`);
            passed++;
        } catch (err) {
            console.log(`❌ FAILED: ${name}`);
            console.error(err.message);
        }
    }
    console.log(`Result: ${passed}/${suites.length} tests passed.\n`);
    if (passed !== suites.length) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

if (require.main === module) {
    runTests();
}

module.exports = { runTests };
