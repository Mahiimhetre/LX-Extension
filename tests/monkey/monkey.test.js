const assert = require('assert');
const env = require('../page-objects/mock-environment.js');
const { PanelPage, StrategiesDropdown, SettingsDropdown, LinkAuditorDropdown } = require('../page-objects/pom-models.js');

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

global.LocatorXModal = class {
    confirm() { return Promise.resolve(true); }
    prompt() { return Promise.resolve('Monkey Auto Page'); }
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

test('Should run 50 random user actions without throwing any uncaught errors', async () => {
    // Wait for panel controller init
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const panel = new PanelPage();
    const strategies = new StrategiesDropdown();
    const settings = new SettingsDropdown();
    const auditor = new LinkAuditorDropdown();
    
    const actions = [
        () => panel.clickInspect(),
        () => panel.typeSearch('random_query_' + Math.random()),
        () => panel.typeSaveName('save_name_' + Math.random()),
        () => panel.clickSave(),
        () => panel.clickSelectAll(),
        () => strategies.toggleDropdown(),
        () => strategies.clickSelectAll(),
        () => strategies.toggleStrategy('containsXpathLocator', Math.random() > 0.5),
        () => settings.toggleDropdown(),
        () => settings.changeFramework(Math.random() > 0.5 ? 'playwright' : 'cypress'),
        () => settings.toggleSmartCorrection(Math.random() > 0.5),
        () => settings.toggleExcludeNumbers(Math.random() > 0.5),
        () => settings.clickReset(),
        () => auditor.toggleDropdown(),
        () => auditor.toggleSettings(),
        () => auditor.startAudit(),
        () => auditor.stopAudit(),
        () => auditor.exportResults()
    ];
    
    let errorCount = 0;
    for (let i = 0; i < 50; i++) {
        const randomAction = actions[Math.floor(Math.random() * actions.length)];
        try {
            randomAction();
        } catch (err) {
            console.error(`Monkey Action Error at step ${i}:`, err.message);
            errorCount++;
        }
    }
    
    assert.strictEqual(errorCount, 0, 'Monkey testing encountered interface crashes');
});

async function runTests() {
    console.log('\n--- Running Monkey Tests ---');
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
