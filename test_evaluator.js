const fs = require('fs');

// Mock DOM
global.window = {};
global.document = {
    getElementById: (id) => {
        if (id === 'searchInput') return { value: 'test' };
        if (id === 'searchMatchBadge') return {
            id: 'searchMatchBadge',
            classList: { add: () => {}, remove: () => {} },
            dataset: {}
        };
        return null;
    }
};

// Mock Chrome API
global.chrome = {
    storage: {
        local: {
            get: (keys, callback) => {
                if (typeof callback === 'function') {
                    callback({ smartCorrectEnabled: true, maxMatchLimit: 150 });
                } else if (typeof keys === 'function') {
                    keys({ smartCorrectEnabled: true, maxMatchLimit: 150 });
                }
            }
        }
    },
    tabs: {
        query: (queryInfo, callback) => {
            callback([{ id: 100 }]); // Mock tab id 100
        },
        sendMessage: (tabId, message, options, callback) => {
            // Mock responses from frames
            if (message.action === 'evaluateSelector') {
                if (options.frameId === 0) {
                    if (callback) callback({ count: 2 });
                } else if (options.frameId === 1) {
                    if (callback) callback({ count: 1 });
                } else {
                    if (callback) callback({ count: 0 });
                }
            } else if (message.action === 'highlightMatches' || message.action === 'clearMatchHighlights') {
                if (callback) callback();
            }
            return Promise.resolve();
        }
    },
    webNavigation: {
        getAllFrames: (details, callback) => {
            // Mock 2 frames
            callback([{ frameId: 0 }, { frameId: 1 }]);
        }
    },
    runtime: {
        lastError: null
    }
};

global.LocatorXConfig = {
    LIMITS: {
        MAX_MATCH_DEFAULT: 500
    }
};

// Load Evaluator
const Evaluator = require('./src/services/evaluator.js');
const evaluator = new Evaluator();

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, testName) {
    if (actual === expected) {
        console.log(`✅ PASS: ${testName}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${testName}`);
        console.error(`   Expected: ${expected}`);
        console.error(`   Actual:   ${actual}`);
        failed++;
    }
}

function assertDeepEqual(actual, expected, testName) {
    const actStr = JSON.stringify(actual);
    const expStr = JSON.stringify(expected);
    if (actStr === expStr) {
        console.log(`✅ PASS: ${testName}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${testName}`);
        console.error(`   Expected: ${expStr}`);
        console.error(`   Actual:   ${actStr}`);
        failed++;
    }
}

async function runTests() {
    console.log("Starting Evaluator tests...");

    // Test 1: Code Unwrapping
    assertEqual(evaluator._isPotentialCode('By.id("login")'), true, 'Code Unwrapping - _isPotentialCode true for By.id');
    assertEqual(evaluator._isPotentialCode('cy.get(".class")'), true, 'Code Unwrapping - _isPotentialCode true for cy.get');
    assertEqual(evaluator._isPotentialCode('#login'), false, 'Code Unwrapping - _isPotentialCode false for #login');

    assertDeepEqual(evaluator._unwrapCode('By.id("login")'), { locator: 'login', type: 'id' }, 'Code Unwrapping - _unwrapCode By.id');
    assertDeepEqual(evaluator._unwrapCode('By.xpath("//div")'), { locator: '//div', type: 'xpath' }, 'Code Unwrapping - _unwrapCode By.xpath');
    assertDeepEqual(evaluator._unwrapCode('cy.get(".class")'), { locator: '.class', type: 'css' }, 'Code Unwrapping - _unwrapCode cy.get');
    assertDeepEqual(evaluator._unwrapCode('page.locator("test-id")'), { locator: 'test-id', type: 'auto' }, 'Code Unwrapping - _unwrapCode page.locator');

    // Test 2: Evaluation (Mocked)
    const matches = await evaluator.evaluate('By.id("test")', { highlight: false });
    assertEqual(matches, 3, 'Evaluate - Should sum matches across frames (2 + 1 = 3)');
    assertEqual(evaluator.totalMatches, 3, 'Evaluate - totalMatches state updated');
    assertEqual(evaluator.frameDistribution.length, 2, 'Evaluate - frameDistribution has 2 entries');

    // Test 3: Navigation
    // Initially currentGlobalIndex is 0
    let index = evaluator.navigate(1);
    assertEqual(index, 1, 'Navigate - Forward 1');
    index = evaluator.navigate(1);
    assertEqual(index, 2, 'Navigate - Forward 2');
    index = evaluator.navigate(1);
    assertEqual(index, 0, 'Navigate - Cyclic Forward (wrap to 0)');
    index = evaluator.navigate(-1);
    assertEqual(index, 2, 'Navigate - Cyclic Backward (wrap to max-1)');

    console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
}

runTests();
