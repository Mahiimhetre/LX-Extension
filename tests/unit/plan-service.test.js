/**
 * Unit Test for PlanService
 * Mocks the Chrome API and verifies plan-based gating logic.
 */

// 1. Mock Global State
global.chrome = {
    storage: {
        local: {
            get: (keys, cb) => cb({ 'locator-x-plan': 'free' }),
            onChanged: { addListener: () => { } }
        },
        onChanged: { addListener: () => { } }
    }
};

global.LocatorXPlans = require('../../src/config/plans.js');
const PlanService = require('../../src/services/plan-service.js');

const suites = [];
const test = (name, fn) => suites.push({ name, fn });
const assert = require('assert');

// 3. Define Tests
test('Should default to free plan', async () => {
    const service = new PlanService();
    await service.init();
    assert.strictEqual(service.currentPlan, 'free', 'Default plan is not free');
    assert.strictEqual(service.getPlanName(), 'Free', 'Friendly name incorrect');
});

test('Should enable free features for free plan', async () => {
    const service = new PlanService();
    await service.init();
    assert.strictEqual(service.isEnabled('locator.id'), true, 'locator.id should be enabled');
    assert.strictEqual(service.isEnabled('locator.orXpath'), false, 'locator.orXpath should be disabled');
    assert.strictEqual(service.isEnabled('ui.checkLinks.skipHeaderFooter'), false, 'ui.checkLinks.skipHeaderFooter should be disabled for free');
});

test('Should respect numeric limits', async () => {
    const service = new PlanService();
    await service.init();
    assert.strictEqual(service.getLimit('MAX_SAVED_LOCATORS'), 25, 'Free limit should be 25');
});

test('Should enable pro features for pro plan', async () => {
    const service = new PlanService();
    service.updatePlan('pro');
    assert.strictEqual(service.currentPlan, 'pro', 'Plan update failed');
    assert.strictEqual(service.isEnabled('locator.orXpath'), true, 'locator.orXpath should be enabled in Pro');
    assert.strictEqual(service.isEnabled('ui.checkLinks.skipHeaderFooter'), true, 'ui.checkLinks.skipHeaderFooter should be enabled in Pro');
    assert.strictEqual(service.getLimit('MAX_SAVED_LOCATORS'), Infinity, 'Pro limit should be Infinity');
});

test('Should grant ALL access to team plan', async () => {
    const service = new PlanService();
    service.updatePlan('team');
    assert.strictEqual(service.isEnabled('anything.at.all'), true, 'Team should have ALL access');
});

// 4. Execute
async function runTests() {
    console.log('\n--- Running PlanService Unit Tests ---');
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
