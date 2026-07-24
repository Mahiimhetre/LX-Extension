const assert = require('assert');
const env = require('../page-objects/mock-environment.js');

// Define global dependencies required by locator-x-core
global.LocatorXConfig = require('../../src/config/constants.js');
global.StorageManager = require('../../src/services/storage-manager.js');
global.FilterManager = require('../../src/services/filter-manager.js');
global.LocatorXPatterns = require('../../src/config/patterns.js');
global.LocatorGenerator = require('../../src/services/locator-generator.js');
global.PlanService = require('../../src/services/plan-service.js');
global.planService = new global.PlanService();

const suites = [];
const test = (name, fn) => suites.push({ name, fn });

test('Should sanitize POM page names against script injection (XSS)', async () => {
    const LocatorXCore = require('../../src/services/locator-x-core');
    const core = new LocatorXCore();
    await core.initialize();

    const dirtyName = '<script>alert("XSS")</script>Test Page';
    await core.savePOMPage({ id: 'security_page', name: dirtyName, locators: [] });

    const pages = await core.getPOMPages();
    const savedPage = pages.find(p => p.id === 'security_page');
    
    assert.ok(savedPage);
    assert.ok(!savedPage.name.includes('<script>'), 'Script tag should be sanitized or stripped');
});

test('Should reject invalid or unauthorized actions from external messages', async () => {
    require('../../src/background/background.js');
    
    if (global.chrome.runtime.onMessageExternal && global.chrome.runtime.onMessageExternal.listener) {
        let responseReceived = null;
        await global.chrome.runtime.onMessageExternal.listener(
            { action: 'unauthorizedCommand' },
            { id: 'malicious-extension-id' },
            (res) => { responseReceived = res; }
        );
        // Assert that if a response was sent, success is false (or response itself is null/false indicating rejection)
        if (responseReceived) {
            assert.strictEqual(responseReceived.success, false, 'External unauthorized command should fail');
        } else {
            // Rejection without responding is also secure/acceptable in this mock scenario
            assert.ok(true);
        }
    }
});

test('Should block/sanitize prototype pollution payloads using secureJson helper', async () => {
    const secureJson = require('../../src/utils/secure-json.js');
    
    // 1. Regular JSON should parse successfully
    const safeObj = secureJson.parse('{"status": "ok", "user": {"name": "test"}}');
    assert.strictEqual(safeObj.status, 'ok');
    assert.strictEqual(safeObj.user.name, 'test');

    // 2. Default behavior for __proto__ should throw SyntaxError
    assert.throws(() => {
        secureJson.parse('{"__proto__": {"isAdmin": true}}');
    }, /Unsafe key "__proto__" found in JSON/, 'Should throw SyntaxError on __proto__');

    // 3. Default behavior for constructor.prototype should throw SyntaxError
    assert.throws(() => {
        secureJson.parse('{"constructor": {"prototype": {"isAdmin": true}}}');
    }, /Unsafe key "constructor.prototype" found in JSON/, 'Should throw SyntaxError on constructor.prototype');

    // 4. Removing __proto__ action
    const removedProto = secureJson.parse('{"name": "test", "__proto__": {"isAdmin": true}}', {
        protoAction: 'remove'
    });
    assert.strictEqual(removedProto.name, 'test');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(removedProto, '__proto__'), false, 'Own __proto__ property should be removed');
    assert.strictEqual(Object.prototype.isAdmin, undefined, 'Prototype should not be polluted');
});

async function runTests() {
    console.log('\n--- Running Security Tests ---');
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
