const assert = require('assert');
const MultiScanManager = require('../services/multi-scan-manager.js');
global.LocatorXPatterns = require('../config/patterns.js');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, testFn) {
    try {
        const msm = new MultiScanManager();
        testFn(msm);
        console.log(`✅ PASS: ${name}`);
        testsPassed++;
    } catch (error) {
        console.error(`❌ FAIL: ${name}`);
        console.error(`   ${error.message}`);
        testsFailed++;
    }
}

console.log("Starting MultiScanManager & LocatorXPatterns Tests...\n");

// 1. Test getCommonPatterns
runTest("getCommonPatterns returns patterns for selenium-java", (msm) => {
    const patterns = msm.getCommonPatterns('selenium-java');
    assert.ok(patterns.find);
    assert.strictEqual(patterns.find.length, 3);
    assert.strictEqual(patterns.find[0].id, 'annotation');
});

runTest("getCommonPatterns (all) returns all patterns", (msm) => {
    const patterns = msm.getCommonPatterns('all');
    assert.ok(Array.isArray(patterns));
    assert.ok(patterns.length > 5);
});

// 2. Test filterPatterns
runTest("filterPatterns matches query against label/template/regex", (msm) => {
    const matches = msm.filterPatterns('getByRole', 'playwright-js');
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].id, 'roleLabel');
});

// 3. Test convertSmartPatternToRegex
runTest("convertSmartPatternToRegex compiles custom pattern correctly", (msm) => {
    const patternInput = 'cy.get("{locator}")';
    const regex = msm.convertSmartPatternToRegex(patternInput);
    assert.strictEqual(regex, 'cy\\.get\\("([^"]+)"\\)');
});

// 4. Test findMatches with Custom patterns
runTest("findMatches parses custom pattern matches and runs heuristic type inference", (msm) => {
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

// 5. Test autoScan
runTest("autoScan extracts standard framework locators correctly", (msm) => {
    const sourceCode = `
        @FindBy(id = "username")
        private WebElement usernameField;

        driver.findElement(By.cssSelector(".password-input"));
        page.locator("xpath=//button[@type='submit']");
        cy.get("[data-cy='dashboard']");
    `;

    const allMatches = msm.autoScan(sourceCode, 'all');
    
    // Map to simple locator list for easy assertion
    const locators = allMatches.map(m => m.locator);
    assert.ok(locators.includes('username'));
    assert.ok(locators.includes('.password-input'));
    assert.ok(locators.includes("//button[@type='submit']"));
    assert.ok(locators.includes("[data-cy='dashboard']"));
});

// 6. Test code generation with LocatorXPatterns.generate
runTest("LocatorXPatterns.generate formats locators correctly", (msm) => {
    // Selenium java
    const selJava = LocatorXPatterns.generate('selenium-java', 'driverFind', 'css', '.btn-login');
    assert.strictEqual(selJava, 'driver.findElement(By.cssSelector(".btn-login"))');

    // Playwright
    const pwJs = LocatorXPatterns.generate('playwright-js', 'locator', 'xpath', '//div');
    assert.strictEqual(pwJs, 'page.locator("xpath=//div")');

    // Cypress
    const cyGet = LocatorXPatterns.generate('cypress', 'get', 'css', '#main');
    assert.strictEqual(cyGet, 'cy.get("#main")');
});

// 7. Test file reader size and type validations
runTest("MultiScanManager.readFile rejects unsupported file type", async (msm) => {
    const mockFile = { name: 'malicious.exe', size: 1024 };
    try {
        await msm.readFile(mockFile);
        assert.fail('Should have rejected the unsupported file type');
    } catch (e) {
        assert.ok(e.message.includes('Unsupported file type'));
    }
});

runTest("MultiScanManager.readFile rejects oversized files", async (msm) => {
    const mockFile = { name: 'large_test.js', size: 3 * 1024 * 1024 }; // 3 MB
    try {
        await msm.readFile(mockFile);
        assert.fail('Should have rejected the oversized file');
    } catch (e) {
        assert.ok(e.message.includes('File exceeds size limit'));
    }
});

console.log(`\nTest Summary:`);
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);

if (testsFailed > 0) {
    process.exit(1);
}
