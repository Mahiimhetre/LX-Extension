const assert = require('assert');
const LocatorGenerator = require('../services/locator-generator.js');
global.LocatorXConfig = require('../config/constants.js');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, testFn) {
    try {
        testFn();
        console.log(`✅ PASS: ${name}`);
        testsPassed++;
    } catch (error) {
        console.error(`❌ FAIL: ${name}`);
        console.error(`   ${error.message}`);
        testsFailed++;
    }
}

console.log("--- Running LocatorGenerator Unit Tests ---\n");

// 1. Test generateOrXPath
runTest("generateOrXPath should generate valid OR XPath for ID and Name", () => {
    const generator = new LocatorGenerator();
    const mockElement = {
        tagName: 'INPUT',
        id: 'username',
        name: 'user',
        className: 'input-field',
        textContent: ''
    };
    const xpath = generator.generateOrXPath(mockElement);
    assert.strictEqual(xpath, "//input[@id='username' or @name='user']");
});

runTest("generateOrXPath should generate valid OR XPath for Class and Text", () => {
    const generator = new LocatorGenerator();
    const mockElement = {
        tagName: 'BUTTON',
        id: '',
        name: '',
        className: 'btn btn-primary',
        textContent: 'Submit'
    };
    const xpath = generator.generateOrXPath(mockElement);
    assert.strictEqual(xpath, "//button[text()='Submit' or contains(@class, 'btn')]");
});

runTest("generateOrXPath should return null if there are fewer than 2 candidates", () => {
    const generator = new LocatorGenerator();
    const mockElement = {
        tagName: 'DIV',
        id: '',
        name: '',
        className: '',
        textContent: ''
    };
    const xpath = generator.generateOrXPath(mockElement);
    assert.strictEqual(xpath, null);
});

// 2. Test standard strategies mapping
runTest("strategies.orXpath should invoke generateOrXPath when feature is enabled", () => {
    const generator = new LocatorGenerator();
    // Stub _isFeatureEnabled to always return true
    generator._isFeatureEnabled = () => true;

    const mockElement = {
        tagName: 'INPUT',
        id: 'username',
        name: 'user',
        className: '',
        textContent: ''
    };

    const result = generator.strategies.orXpath(mockElement);
    assert.strictEqual(result, "//input[@id='username' or @name='user']");
});

runTest("strategies.orXpath should return null when feature is disabled", () => {
    const generator = new LocatorGenerator();
    // Stub _isFeatureEnabled to return false for orXpath
    generator._isFeatureEnabled = (feat) => feat !== 'locator.orXpath';

    const mockElement = {
        tagName: 'INPUT',
        id: 'username',
        name: 'user',
        className: '',
        textContent: ''
    };

    const result = generator.strategies.orXpath(mockElement);
    assert.strictEqual(result, null);
});

// 3. Test generateLocators execution of orXpath
runTest("generateLocators should return OR XPath standard locator when enabled", () => {
    const generator = new LocatorGenerator();
    generator._isFeatureEnabled = () => true;
    generator.countMatches = () => 1; // mock counting matches

    const mockElement = {
        tagName: 'INPUT',
        id: 'username',
        name: 'user',
        className: '',
        textContent: '',
        // add stub attributes
        attributes: []
    };

    const locators = generator.generateLocators(mockElement, ['orXpath']);
    const orLoc = locators.find(l => l.type === 'OR XPath');
    assert.ok(orLoc);
    assert.strictEqual(orLoc.locator, "//input[@id='username' or @name='user']");
    assert.strictEqual(orLoc.matches, 1);
});

// 4. Test looksDynamic with custom blacklist regex
runTest("looksDynamic should return true for values matching custom blacklist regex", () => {
    const generator = new LocatorGenerator();
    generator.setConfig({
        blacklistPatterns: ['^foobar-abc$', '.*-temp-custom$', '^xyz-[a-z]+$']
    });

    // Matching custom blacklists
    assert.strictEqual(generator.looksDynamic('foobar-abc'), true);
    assert.strictEqual(generator.looksDynamic('hello-temp-custom'), true);
    assert.strictEqual(generator.looksDynamic('xyz-abc'), true);

    // Non-matching values
    assert.strictEqual(generator.looksDynamic('foobar-abcd'), false);
    assert.strictEqual(generator.looksDynamic('temp-custom-hello'), false);
    assert.strictEqual(generator.looksDynamic('xy-ab'), false);
});

runTest("looksDynamic should ignore invalid regex patterns and not crash", () => {
    const generator = new LocatorGenerator();
    generator.setConfig({
        blacklistPatterns: ['[invalid*', 'valid-pattern']
    });

    // Should successfully match the valid pattern
    assert.strictEqual(generator.looksDynamic('valid-pattern'), true);
    // Invalid regex shouldn't crash it and should just evaluate to false
    assert.strictEqual(generator.looksDynamic('[invalid*'), false);
});

runTest("getLocatorWarnings should add warning for custom blacklisted IDs in xpath", () => {
    const generator = new LocatorGenerator();
    generator.setConfig({
        blacklistPatterns: ['^custom-dynamic-.*']
    });

    const element = { tagName: 'DIV', id: 'custom-dynamic-id' };
    const warnings = generator.getLocatorWarnings("//div[@id='custom-dynamic-id']", 'XPath', element);
    assert.ok(warnings.includes('Contains dynamic ID'));
});

console.log(`\nTest Summary:`);
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);

if (testsFailed > 0) {
    process.exit(1);
}

