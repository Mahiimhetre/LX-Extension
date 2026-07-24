const assert = require('assert');
const fs = require('fs');
const path = require('path');

const suites = [];
const test = (name, fn) => suites.push({ name, fn });

test('Manifest should be valid Manifest V3 compliant', () => {
    const manifestPath = path.resolve(__dirname, '..', '..', 'manifest.json');
    const content = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(content);

    assert.strictEqual(manifest.manifest_version, 3, 'Manifest version must be 3 for modern compatibility');
    assert.ok(manifest.name, 'Manifest name is missing');
    assert.ok(manifest.version, 'Manifest version is missing');
});

test('Should use cross-browser background service worker configuration', () => {
    const manifestPath = path.resolve(__dirname, '..', '..', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    assert.ok(manifest.background, 'Background property is missing');
    assert.ok(manifest.background.service_worker, 'Service worker is missing');
    assert.ok(!manifest.background.scripts, 'Legacy background.scripts is incompatible with MV3');
});

test('Content scripts match standard match patterns', () => {
    const manifestPath = path.resolve(__dirname, '..', '..', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    if (manifest.content_scripts) {
        manifest.content_scripts.forEach(script => {
            assert.ok(Array.isArray(script.matches), 'matches must be an array of urls/patterns');
            script.matches.forEach(pattern => {
                assert.ok(
                    pattern === '<all_urls>' || pattern.includes('://') || pattern.startsWith('http'),
                    `Invalid match pattern: ${pattern}`
                );
            });
        });
    }
});

async function runTests() {
    console.log('\n--- Running Compatibility Tests ---');
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
