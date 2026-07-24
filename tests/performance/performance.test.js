const assert = require('assert');
const env = require('../page-objects/mock-environment.js');
const LocatorGenerator = require('../../src/services/locator-generator.js');

const suites = [];
const test = (name, fn) => suites.push({ name, fn });

test('Locator generation should complete within 50ms benchmark', () => {
    const generator = new LocatorGenerator();
    generator._isFeatureEnabled = () => true;

    // Use MockElement rather than plain object so that element.getAttribute exists
    const mockElement = new env.MockElement('INPUT', 'user_login_main');
    mockElement.setAttribute('name', 'username');
    mockElement.className = 'input text-input field';
    mockElement.textContent = 'Enter Username';

    const start = Date.now();
    for (let i = 0; i < 500; i++) {
        generator.generateLocators(mockElement, ['orXpath', 'relativeXpath', 'absoluteXpath']);
    }
    const end = Date.now();
    const duration = end - start;
    console.log(`     Benchmark: Generated 500 locators in ${duration}ms (${(duration/500).toFixed(2)}ms/gen)`);
    assert.ok(duration < 2500, 'Locator generation is too slow');
});

test('FilterManager recommendation logic should execute within 5ms', () => {
    const FilterManager = require('../../src/services/filter-manager.js');
    const fm = new FilterManager();
    
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
        fm.getRecommendedFilters('cypress');
    }
    const end = Date.now();
    const duration = end - start;
    console.log(`     Benchmark: 1000 recommendation lookups in ${duration}ms`);
    assert.ok(duration < 50, 'Recommendation lookup is too slow');
});

async function runTests() {
    console.log('\n--- Running Performance Tests ---');
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
