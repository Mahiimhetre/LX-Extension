const assert = require('assert');
const FilterManager = require('../services/filter-manager.js');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, testFn) {
    try {
        const fm = new FilterManager(); // Fresh instance for each test
        testFn(fm);
        console.log(`✅ PASS: ${name}`);
        testsPassed++;
    } catch (error) {
        console.error(`❌ FAIL: ${name}`);
        console.error(`   ${error.message}`);
        testsFailed++;
    }
}

console.log("Starting FilterManager Tests...\n");

// 1. Test createDefaultFilterState
runTest("createDefaultFilterState creates 10 default filters", (fm) => {
    const defaultState = fm.createDefaultFilterState();
    assert.strictEqual(Object.keys(defaultState).length, 10);
});

runTest("createDefaultFilterState sets id to enabled", (fm) => {
    const defaultState = fm.createDefaultFilterState();
    assert.strictEqual(defaultState.id.enabled, true);
    assert.strictEqual(defaultState.id.disabled, false);
});

runTest("createDefaultFilterState includes absoluteXpath", (fm) => {
    const defaultState = fm.createDefaultFilterState();
    assert.strictEqual(defaultState.absoluteXpath.enabled, true);
});

// 2. Test applyFrameworkRules

runTest("applyFrameworkRules (cypress) disables linkText", (fm) => {
    const baseState = fm.createDefaultFilterState();
    const cypressState = fm.applyFrameworkRules('cypress', baseState);
    assert.strictEqual(cypressState.linkText.disabled, true);
    assert.strictEqual(cypressState.linkText.enabled, false);
});

runTest("applyFrameworkRules (cypress) leaves id enabled", (fm) => {
    const baseState = fm.createDefaultFilterState();
    const cypressState = fm.applyFrameworkRules('cypress', baseState);
    assert.strictEqual(cypressState.id.enabled, true);
});

runTest("applyFrameworkRules (playwright) sets css.disabled to false", (fm) => {
    const baseState = fm.createDefaultFilterState();
    const playwrightState = fm.applyFrameworkRules('playwright', baseState);
    assert.strictEqual(playwrightState.css.disabled, false);
});

runTest("applyFrameworkRules (unknown) returns unmodified state", (fm) => {
    const baseState = fm.createDefaultFilterState();
    const unknownState = fm.applyFrameworkRules('unknown', baseState);
    assert.deepStrictEqual(unknownState, baseState);
});

// 3. Test getEnabledFilters
runTest("getEnabledFilters returns only enabled and non-disabled filters", (fm) => {
    const mockState = {
        id: { enabled: true, disabled: false },
        css: { enabled: true, disabled: false },
        linkText: { enabled: false, disabled: true }, // Disabled by framework
        xpath: { enabled: false, disabled: false }    // Manually disabled by user
    };
    const enabledFilters = fm.getEnabledFilters(mockState);
    assert.deepStrictEqual(enabledFilters, ['id', 'css']);
});

// 4. Test validateFilterCombination
runTest("validateFilterCombination (cypress valid) returns valid: true", (fm) => {
    const validCypress = fm.validateFilterCombination(['id', 'css'], 'cypress');
    assert.strictEqual(validCypress.valid, true);
    assert.deepStrictEqual(validCypress.issues, []);
});

runTest("validateFilterCombination (cypress invalid) returns correct issue", (fm) => {
    const invalidCypress = fm.validateFilterCombination(['id', 'linkText'], 'cypress');
    assert.strictEqual(invalidCypress.valid, false);
    assert.deepStrictEqual(invalidCypress.issues, ["linkText is not supported by cypress"]);
});

runTest("validateFilterCombination (empty) returns correct issue", (fm) => {
    const emptyFilters = fm.validateFilterCombination([], 'cypress');
    assert.strictEqual(emptyFilters.valid, false);
    assert.deepStrictEqual(emptyFilters.issues, ["At least one locator type must be enabled"]);
});

// 5. Test getRecommendedFilters
runTest("getRecommendedFilters (cypress) returns correct recommended filters", (fm) => {
    const cypressRecommended = fm.getRecommendedFilters('cypress');
    assert.deepStrictEqual(cypressRecommended, ['css', 'relativeXpath']);
});

runTest("getRecommendedFilters (playwright) returns correct recommended filters", (fm) => {
    const playwrightRecommended = fm.getRecommendedFilters('playwright');
    assert.deepStrictEqual(playwrightRecommended, ['css', 'relativeXpath', 'id', 'className']);
});

runTest("getRecommendedFilters (unknown) returns default recommended filters", (fm) => {
    const unknownRecommended = fm.getRecommendedFilters('unknown');
    assert.deepStrictEqual(unknownRecommended, ['id', 'className', 'css', 'relativeXpath']);
});

runTest("getRecommendedFilters (testFramework with disabled) filters out disabled default recommended filters", (fm) => {
    fm.filterRules.framework.testFramework = {
        disabled: ['id']
    };
    const testFrameworkRecommended = fm.getRecommendedFilters('testFramework');
    assert.deepStrictEqual(testFrameworkRecommended, ['className', 'css', 'relativeXpath']);
});

console.log(`\nTest Summary:`);
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);

if (testsFailed > 0) {
    process.exit(1);
}
