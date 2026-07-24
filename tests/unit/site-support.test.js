/**
 * Unit Test for SiteSupport
 * Mocks the Chrome API and DOM to verify URL support and auditorIgnoreUrls logic.
 */

// 1. Mock Global State / DOM
global.window = {
    LocatorX: {
        inspect: {
            isActive: false,
            deactivate: () => {
                global.window.LocatorX.inspect.isActive = false;
            },
            updateUI: () => {}
        }
    }
};
global.LocatorX = global.window.LocatorX;

global.chrome = {
    tabs: {
        query: (queryInfo, cb) => {
            cb([global.mockTab]);
        }
    },
    storage: {
        local: {
            get: (keys, cb) => {
                cb(global.mockStorage);
            }
        }
    }
};

// Mock document
const mockElements = {};
global.document = {
    getElementById: (id) => {
        if (!mockElements[id]) {
            mockElements[id] = {
                classList: {
                    add: (cls) => mockElements[id].classes.add(cls),
                    remove: (cls) => mockElements[id].classes.delete(cls)
                },
                classes: new Set(),
                title: '',
                style: { display: 'none' },
                removeAttribute: (attr) => {
                    if (attr === 'title') mockElements[id].title = '';
                }
            };
        }
        return mockElements[id];
    }
};

const SiteSupport = require('../../src/ui/shared/site-support.js');

const suites = [];
const test = (name, fn) => suites.push({ name, fn });
const assert = require('assert');

// 3. Define Tests
test('Should allow standard supported pages by default', async () => {
    global.mockTab = { url: 'https://example.com' };
    global.mockStorage = {};
    
    await new Promise(resolve => {
        SiteSupport.check();
        setTimeout(resolve, 50);
    });

    assert.strictEqual(SiteSupport.isSupported, true, 'Site should be supported');
    assert.strictEqual(SiteSupport.isAuditorSupported, true, 'Auditor should be supported');
});

test('Should disable entire extension for extensionIgnoreUrls', async () => {
    global.mockTab = { url: 'https://example.com/ignored-page' };
    global.mockStorage = {
        extensionIgnoreUrls: 'ignored-page\nanother-ignored'
    };

    await new Promise(resolve => {
        SiteSupport.check();
        setTimeout(resolve, 50);
    });

    assert.strictEqual(SiteSupport.isSupported, false, 'Site should be ignored');
    assert.strictEqual(SiteSupport.isAuditorSupported, false, 'Auditor should be ignored if site is ignored');
});

test('Should disable ONLY Link Auditor when URL matches auditorIgnoreUrls', async () => {
    global.mockTab = { url: 'https://example.com/no-auditor' };
    global.mockStorage = {
        extensionIgnoreUrls: 'ignored-page',
        auditorIgnoreUrls: 'no-auditor\nskip-this-one'
    };

    await new Promise(resolve => {
        SiteSupport.check();
        setTimeout(resolve, 50);
    });

    assert.strictEqual(SiteSupport.isSupported, true, 'Site should be supported generally');
    assert.strictEqual(SiteSupport.isAuditorSupported, false, 'Auditor should be ignored specifically');
    
    const navLinkAuditor = document.getElementById('navLinkAuditor');
    assert.strictEqual(navLinkAuditor.classes.has('disabled'), true, 'navLinkAuditor should have disabled class');
    assert.strictEqual(navLinkAuditor.title, 'Link Auditor is disabled on this page', 'navLinkAuditor title incorrect');
});

test('Should enable Link Auditor if url does not match auditorIgnoreUrls', async () => {
    global.mockTab = { url: 'https://example.com/allowed-page' };
    global.mockStorage = {
        extensionIgnoreUrls: 'ignored-page',
        auditorIgnoreUrls: 'no-auditor'
    };

    await new Promise(resolve => {
        SiteSupport.check();
        setTimeout(resolve, 50);
    });

    assert.strictEqual(SiteSupport.isSupported, true, 'Site should be supported');
    assert.strictEqual(SiteSupport.isAuditorSupported, true, 'Auditor should be supported');
    
    const navLinkAuditor = document.getElementById('navLinkAuditor');
    assert.strictEqual(navLinkAuditor.classes.has('disabled'), false, 'navLinkAuditor should not have disabled class');
});

// 4. Execute
async function runTests() {
    console.log('\n--- Running SiteSupport Unit Tests ---');
    let passed = 0;
    for (const { name, fn } of suites) {
        try {
            Object.keys(mockElements).forEach(k => {
                mockElements[k].classes.clear();
                mockElements[k].title = '';
            });
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
