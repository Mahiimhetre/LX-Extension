const assert = require('assert');
const env = require('../page-objects/mock-environment.js');
const { PanelPage, StrategiesDropdown, SettingsDropdown } = require('../page-objects/pom-models.js');

// Load globally needed objects
global.SiteSupport = require('../../src/ui/shared/site-support.js');
global.LocatorXConfig = require('../../src/config/constants.js');
global.StorageManager = require('../../src/services/storage-manager.js');
global.FilterManager = require('../../src/services/filter-manager.js');
global.LocatorXPatterns = require('../../src/config/patterns.js');
global.LocatorGenerator = require('../../src/services/locator-generator.js');
global.LocatorXCore = require('../../src/services/locator-x-core.js');
global.PlanService = require('../../src/services/plan-service.js');
global.planService = new global.PlanService();

// Mock dependencies
global.LocatorXModal = class {
    confirm() { return Promise.resolve(true); }
    prompt() { return Promise.resolve('Regression Page'); }
};
global.Evaluator = class {
    init() {}
};
global.SuggestionManager = class {
    updatePageContext() {}
    getSuggestions() { return []; }
};

require('../../src/ui/shared/panel-controller.js');

const suites = [];
const test = (name, fn) => suites.push({ name, fn });

test('Regression: System should initialize Home view by default', async () => {
    // Wait for panel controller init
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.strictEqual(global.LocatorX.tabs.current, 'home');
});

test('Regression: StrategiesDropdown Select All should only toggle non-disabled strategies', async () => {
    global.planService.updatePlan('free');
    global.planService.applyUIGates();

    const strategies = new StrategiesDropdown();
    
    assert.strictEqual(strategies.isStrategyDisabled('startsWithXpathLocator'), true);
    assert.strictEqual(strategies.isStrategyDisabled('orXpathLocator'), true);
    assert.strictEqual(strategies.isStrategyDisabled('containsXpathLocator'), false);

    strategies.toggleStrategy('containsXpathLocator', true);
    strategies.clickSelectAll();

    assert.strictEqual(strategies.isStrategyChecked('containsXpathLocator'), false);
    assert.strictEqual(strategies.isStrategyChecked('startsWithXpathLocator'), false);
    assert.strictEqual(strategies.isStrategyChecked('orXpathLocator'), false);
});

test('Regression: Settings Reset should re-gate PRO features immediately', async () => {
    global.planService.updatePlan('free');
    global.planService.applyUIGates();

    const settings = new SettingsDropdown();
    const strategies = new StrategiesDropdown();

    settings.clickReset();

    await new Promise(resolve => setTimeout(resolve, 50));

    assert.strictEqual(strategies.isStrategyDisabled('startsWithXpathLocator'), true);
    assert.strictEqual(strategies.isStrategyChecked('startsWithXpathLocator'), false);
    assert.strictEqual(strategies.isStrategyDisabled('orXpathLocator'), true);
    assert.strictEqual(strategies.isStrategyChecked('orXpathLocator'), false);
});

async function runTests() {
    console.log('\n--- Running Regression Tests ---');
    let passed = 0;
    
    // Wait for main LocatorX.init()
    await new Promise(resolve => setTimeout(resolve, 100));

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
