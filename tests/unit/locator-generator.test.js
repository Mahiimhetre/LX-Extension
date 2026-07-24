const assert = require('assert');
const LocatorGenerator = require('../../src/services/locator-generator.js');
global.LocatorXConfig = require('../../src/config/constants.js');

const suites = [];
const test = (name, fn) => suites.push({ name, fn });

test("generateOrXPath should generate valid OR XPath for ID and Name", () => {
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

test("generateOrXPath should generate valid OR XPath for Class and Text", () => {
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

test("generateOrXPath should return null if there are fewer than 2 candidates", () => {
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

test("strategies.orXpath should invoke generateOrXPath when feature is enabled", () => {
    const generator = new LocatorGenerator();
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

test("strategies.orXpath should return null when feature is disabled", () => {
    const generator = new LocatorGenerator();
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

test("generateLocators should return OR XPath standard locator when enabled", () => {
    const generator = new LocatorGenerator();
    generator._isFeatureEnabled = () => true;
    generator.countMatches = () => 1;

    const mockElement = {
        tagName: 'INPUT',
        id: 'username',
        name: 'user',
        className: '',
        textContent: '',
        attributes: []
    };

    const locators = generator.generateLocators(mockElement, ['orXpath']);
    const orLoc = locators.find(l => l.type === 'OR XPath');
    assert.ok(orLoc);
    assert.strictEqual(orLoc.locator, "//input[@id='username' or @name='user']");
    assert.strictEqual(orLoc.matches, 1);
});

test("looksDynamic should return true for values matching custom blacklist regex", () => {
    const generator = new LocatorGenerator();
    generator.setConfig({
        blacklistPatterns: ['^foobar-abc$', '.*-temp-custom$', '^xyz-[a-z]+$']
    });

    assert.strictEqual(generator.looksDynamic('foobar-abc'), true);
    assert.strictEqual(generator.looksDynamic('hello-temp-custom'), true);
    assert.strictEqual(generator.looksDynamic('xyz-abc'), true);

    assert.strictEqual(generator.looksDynamic('foobar-abcd'), false);
    assert.strictEqual(generator.looksDynamic('temp-custom-hello'), false);
    assert.strictEqual(generator.looksDynamic('xy-ab'), false);
});

test("looksDynamic should ignore invalid regex patterns and not crash", () => {
    const generator = new LocatorGenerator();
    generator.setConfig({
        blacklistPatterns: ['[invalid*', 'valid-pattern']
    });

    assert.strictEqual(generator.looksDynamic('valid-pattern'), true);
    assert.strictEqual(generator.looksDynamic('[invalid*'), false);
});

test("getLocatorWarnings should add warning for custom blacklisted IDs in xpath", () => {
    const generator = new LocatorGenerator();
    generator.setConfig({
        blacklistPatterns: ['^custom-dynamic-.*']
    });

    const element = { tagName: 'DIV', id: 'custom-dynamic-id' };
    const warnings = generator.getLocatorWarnings("//div[@id='custom-dynamic-id']", 'XPath', element);
    assert.ok(warnings.includes('Contains dynamic ID'));
});

async function runTests() {
    console.log('\n--- Running LocatorGenerator Unit Tests ---');
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
    }
}

if (require.main === module) {
    runTests();
}

module.exports = { runTests };
