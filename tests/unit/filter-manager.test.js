const assert = require('assert');
const FilterManager = require('../../src/services/filter-manager.js');

const suites = [];
const test = (name, fn) => suites.push({ name, fn });

test("createDefaultFilterState creates 10 default filters", () => {
    const fm = new FilterManager();
    const defaultState = fm.createDefaultFilterState();
    assert.strictEqual(Object.keys(defaultState).length, 10);
});

test("createDefaultFilterState sets id to enabled", () => {
    const fm = new FilterManager();
    const defaultState = fm.createDefaultFilterState();
    assert.strictEqual(defaultState.id.enabled, true);
    assert.strictEqual(defaultState.id.disabled, false);
});

test("createDefaultFilterState includes absoluteXpath", () => {
    const fm = new FilterManager();
    const defaultState = fm.createDefaultFilterState();
    assert.strictEqual(defaultState.absoluteXpath.enabled, true);
});

test("applyFrameworkRules (cypress) disables linkText", () => {
    const fm = new FilterManager();
    const baseState = fm.createDefaultFilterState();
    const cypressState = fm.applyFrameworkRules('cypress', baseState);
    assert.strictEqual(cypressState.linkText.disabled, true);
    assert.strictEqual(cypressState.linkText.enabled, false);
});

test("applyFrameworkRules (cypress) leaves id enabled", () => {
    const fm = new FilterManager();
    const baseState = fm.createDefaultFilterState();
    const cypressState = fm.applyFrameworkRules('cypress', baseState);
    assert.strictEqual(cypressState.id.enabled, true);
});

test("applyFrameworkRules (playwright) sets css.disabled to false", () => {
    const fm = new FilterManager();
    const baseState = fm.createDefaultFilterState();
    const playwrightState = fm.applyFrameworkRules('playwright', baseState);
    assert.strictEqual(playwrightState.css.disabled, false);
});

test("applyFrameworkRules (unknown) returns unmodified state", () => {
    const fm = new FilterManager();
    const baseState = fm.createDefaultFilterState();
    const unknownState = fm.applyFrameworkRules('unknown', baseState);
    assert.deepStrictEqual(unknownState, baseState);
});

test("getEnabledFilters returns only enabled and non-disabled filters", () => {
    const fm = new FilterManager();
    const mockState = {
        id: { enabled: true, disabled: false },
        css: { enabled: true, disabled: false },
        linkText: { enabled: false, disabled: true },
        xpath: { enabled: false, disabled: false }
    };
    const enabledFilters = fm.getEnabledFilters(mockState);
    assert.deepStrictEqual(enabledFilters, ['id', 'css']);
});

test("validateFilterCombination (cypress valid) returns valid: true", () => {
    const fm = new FilterManager();
    const validCypress = fm.validateFilterCombination(['id', 'css'], 'cypress');
    assert.strictEqual(validCypress.valid, true);
    assert.deepStrictEqual(validCypress.issues, []);
});

test("validateFilterCombination (cypress invalid) returns correct issue", () => {
    const fm = new FilterManager();
    const invalidCypress = fm.validateFilterCombination(['id', 'linkText'], 'cypress');
    assert.strictEqual(invalidCypress.valid, false);
    assert.deepStrictEqual(invalidCypress.issues, ["linkText is not supported by cypress"]);
});

test("validateFilterCombination (empty) returns correct issue", () => {
    const fm = new FilterManager();
    const emptyFilters = fm.validateFilterCombination([], 'cypress');
    assert.strictEqual(emptyFilters.valid, false);
    assert.deepStrictEqual(emptyFilters.issues, ["At least one locator type must be enabled"]);
});

test("getRecommendedFilters (cypress) returns correct recommended filters", () => {
    const fm = new FilterManager();
    const cypressRecommended = fm.getRecommendedFilters('cypress');
    assert.deepStrictEqual(cypressRecommended, ['css', 'relativeXpath']);
});

test("getRecommendedFilters (playwright) returns correct recommended filters", () => {
    const fm = new FilterManager();
    const playwrightRecommended = fm.getRecommendedFilters('playwright');
    assert.deepStrictEqual(playwrightRecommended, ['css', 'relativeXpath', 'id', 'className']);
});

test("getRecommendedFilters (unknown) returns default recommended filters", () => {
    const fm = new FilterManager();
    const unknownRecommended = fm.getRecommendedFilters('unknown');
    assert.deepStrictEqual(unknownRecommended, ['id', 'className', 'css', 'relativeXpath']);
});

test("getRecommendedFilters (testFramework with disabled) filters out disabled default recommended filters", () => {
    const fm = new FilterManager();
    fm.filterRules.framework.testFramework = {
        disabled: ['id']
    };
    const testFrameworkRecommended = fm.getRecommendedFilters('testFramework');
    assert.deepStrictEqual(testFrameworkRecommended, ['className', 'css', 'relativeXpath']);
});

async function runTests() {
    console.log('\n--- Running FilterManager Unit Tests ---');
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
