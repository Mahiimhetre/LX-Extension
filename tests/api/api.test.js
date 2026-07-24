/**
 * API Integration Test Suite
 * Verifies message passing interfaces, background fetching, and content script APIs.
 */

// 1. Initialize Mock Environment
const { resetStorage, setStorage } = require('../page-objects/mock-environment.js');
const assert = require('assert');

// Global mock for fetch
global.fetch = async (url, options = {}) => {
    const method = options.method || 'GET';
    if (url.includes('success-head')) {
        if (method === 'HEAD') return { status: 200, statusText: 'OK', ok: true };
    }
    if (url.includes('405-fallback')) {
        if (method === 'HEAD') return { status: 405, statusText: 'Method Not Allowed', ok: false };
        if (method === 'GET') return { status: 200, statusText: 'Fallback OK', ok: true };
    }
    if (url.includes('error-status')) {
        return { status: 500, statusText: 'Internal Error', ok: false };
    }
    throw new Error('Failed to fetch');
};

require('../../src/background/background.js');

const suites = [];
const test = (name, fn) => suites.push({ name, fn });

test('checkUrlStatus should return 200 for successful HEAD request', async () => {
    await new Promise((resolve) => {
        chrome.runtime.sendMessage({
            action: 'checkUrlStatus',
            url: 'https://example.com/success-head',
            timeout: 1000
        }, (res) => {
            assert.strictEqual(res.success, true);
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.ok, true);
            resolve();
        });
    });
});

test('checkUrlStatus should fall back to GET if HEAD returns 405', async () => {
    await new Promise((resolve) => {
        chrome.runtime.sendMessage({
            action: 'checkUrlStatus',
            url: 'https://example.com/405-fallback',
            timeout: 1000
        }, (res) => {
            assert.strictEqual(res.success, true);
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.statusText, 'Fallback OK');
            resolve();
        });
    });
});

test('checkUrlStatus should handle network errors and return success: false', async () => {
    await new Promise((resolve) => {
        chrome.runtime.sendMessage({
            action: 'checkUrlStatus',
            url: 'https://example.com/throw-error',
            timeout: 1000
        }, (res) => {
            assert.strictEqual(res.success, false);
            assert.ok(res.error.includes('Failed to fetch'));
            resolve();
        });
    });
});

async function runTests() {
    console.log('\n--- Running API Integration Tests ---');
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
