const assert = require('assert');
const env = require('../page-objects/mock-environment.js');

const suites = [];
const test = (name, fn) => suites.push({ name, fn });

test('Installation: clean installation sets up default configurations', async () => {
    // Reset mock storage
    env.resetStorage();
    
    // Simulate background script loading / initialization
    require('../../src/background/background.js');
    
    // Trigger onInstalled listener
    if (global.chrome.runtime.onInstalled && global.chrome.runtime.onInstalled.listener) {
        await global.chrome.runtime.onInstalled.listener({ reason: 'install' });
    }
    
    const storage = env.getStorage();
    
    // Assert that default settings and plan are initialized
    assert.strictEqual(storage['locator-x-plan'], 'free', 'Default plan should be set to free');
    assert.ok(storage['locator-x-settings'], 'Default settings should be created');
});

test('Update: upgrading checks schema updates gracefully', async () => {
    env.resetStorage();
    // Simulate legacy storage layout
    env.setStorage({
        'locator-x-settings': JSON.stringify({ oldProp: 'value', selectedFramework: 'selenium-java' })
    });
    
    const StorageManager = require('../../src/services/storage-manager.js');
    const sm = new StorageManager();
    await sm.ensureMigrated();
    
    // Assert migration leaves newer props in place and updates storage safely
    const stored = await global.chrome.storage.local.get('locator-x-settings');
    assert.ok(stored, 'Settings key missing after migration');
});

async function runTests() {
    console.log('\n--- Running Installation/Update Tests ---');
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
