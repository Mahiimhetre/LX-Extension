const assert = require('assert');
const MultiScanManager = require('../../src/services/multi-scan-manager.js');
global.LocatorXPatterns = require('../../src/config/patterns.js');

const suites = [];
const test = (name, fn) => suites.push({ name, fn });

test("getCommonPatterns returns patterns for selenium-java", () => {
    const msm = new MultiScanManager();
    const patterns = msm.getCommonPatterns('selenium-java');
    assert.ok(patterns.find);
    assert.strictEqual(patterns.find.length, 3);
    assert.strictEqual(patterns.find[0].id, 'annotation');
});

test("getCommonPatterns (all) returns all patterns", () => {
    const msm = new MultiScanManager();
    const patterns = msm.getCommonPatterns('all');
    assert.ok(Array.isArray(patterns));
    assert.ok(patterns.length > 5);
});

test("filterPatterns matches query against label/template/regex", () => {
    const msm = new MultiScanManager();
    const matches = msm.filterPatterns('getByRole', 'playwright-js');
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].id, 'roleLabel');
});

test("convertSmartPatternToRegex compiles custom pattern correctly", () => {
    const msm = new MultiScanManager();
    const patternInput = 'cy.get("{locator}")';
    const regex = msm.convertSmartPatternToRegex(patternInput);
    assert.strictEqual(regex, 'cy\\.get\\("([^"]+)"\\)');
});

test("findMatches parses custom pattern matches and runs heuristic type inference", () => {
    const msm = new MultiScanManager();
    const text = 'cy.get("#submit-btn"); cy.get("//button[text()=\'Save\']"); cy.get(".btn-primary");';
    const pattern = 'cy\\.get\\("([^"]+)"\\)';
    const matches = msm.findMatches(text, pattern, true, 'cy.get("{locator}")');

    assert.strictEqual(matches.length, 3);
    assert.strictEqual(matches[0].type, 'id');
    assert.strictEqual(matches[0].locator, '#submit-btn');

    assert.strictEqual(matches[1].type, 'xpath');
    assert.strictEqual(matches[1].locator, "//button[text()='Save']");

    assert.strictEqual(matches[2].type, 'className');
    assert.strictEqual(matches[2].locator, '.btn-primary');
});

test("autoScan extracts standard framework locators correctly", () => {
    const msm = new MultiScanManager();
    const sourceCode = `
        @FindBy(id = "username")
        private WebElement usernameField;

        driver.findElement(By.cssSelector(".password-input"));
        page.locator("xpath=//button[@type='submit']");
        cy.get("[data-cy='dashboard']");
    `;

    const allMatches = msm.autoScan(sourceCode, 'all');
    const locators = allMatches.map(m => m.locator);
    assert.ok(locators.includes('username'));
    assert.ok(locators.includes('.password-input'));
    assert.ok(locators.includes("//button[@type='submit']"));
    assert.ok(locators.includes("[data-cy='dashboard']"));
});

test("LocatorXPatterns.generate formats locators correctly", () => {
    const selJava = LocatorXPatterns.generate('selenium-java', 'driverFind', 'css', '.btn-login');
    assert.strictEqual(selJava, 'driver.findElement(By.cssSelector(".btn-login"))');

    const pwJs = LocatorXPatterns.generate('playwright-js', 'locator', 'xpath', '//div');
    assert.strictEqual(pwJs, 'page.locator("xpath=//div")');

    const cyGet = LocatorXPatterns.generate('cypress', 'get', 'css', '#main');
    assert.strictEqual(cyGet, 'cy.get("#main")');
});

test("MultiScanManager.readFile rejects unsupported file type", async () => {
    const msm = new MultiScanManager();
    const mockFile = { name: 'malicious.exe', size: 1024 };
    try {
        await msm.readFile(mockFile);
        assert.fail('Should have rejected the unsupported file type');
    } catch (e) {
        assert.ok(e.message.includes('Unsupported file type'));
    }
});

test("MultiScanManager.readFile rejects oversized files", async () => {
    const msm = new MultiScanManager();
    const mockFile = { name: 'large_test.js', size: 3 * 1024 * 1024 };
    try {
        await msm.readFile(mockFile);
        assert.fail('Should have rejected the oversized file');
    } catch (e) {
        assert.ok(e.message.includes('File exceeds size limit'));
    }
});

async function runTests() {
    console.log('\n--- Running MultiScanManager Integration Tests ---');
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
