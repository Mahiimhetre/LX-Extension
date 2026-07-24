const assert = require('assert');
const env = require('../page-objects/mock-environment.js');
const LocatorGenerator = require('../../src/services/locator-generator.js');

const suites = [];
const test = (name, fn) => suites.push({ name, fn });

test('Exploratory: Generator should handle mock shadow DOM target nodes', () => {
    const generator = new LocatorGenerator();
    
    // Simulate a target node that belongs to a shadow root
    const shadowHost = new env.MockElement('SECTION', 'shadow-host');
    const shadowRoot = { host: shadowHost };
    const innerNode = new env.MockElement('SPAN', 'inner-text');
    innerNode.parentNode = shadowRoot;
    
    // Test that generator safely checks for parent elements without crashing on parentNode without parentElement
    const warnings = generator.getLocatorWarnings("//span[@id='inner-text']", 'XPath', innerNode);
    assert.ok(Array.isArray(warnings), 'Warnings list must be returned');
});

test('Exploratory: Check custom prefix constraints on output templates', () => {
    const FilterManager = require('../../src/services/filter-manager.js');
    const fm = new FilterManager();
    
    // Exploratory check on rules config mapping
    assert.ok(fm.filterRules, 'Filter rules config is undefined');
    assert.ok(fm.filterRules.framework, 'Framework specifications are missing');
});

async function runTests() {
    console.log('\n--- Running Exploratory Tests ---');
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
