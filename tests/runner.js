const { spawn } = require('child_process');
const path = require('path');

const testSuites = [
    'unit/plan-service.test.js',
    'unit/filter-manager.test.js',
    'unit/locator-generator.test.js',
    'unit/site-support.test.js',
    'integration/multi-scan-manager.test.js',
    'integration/verify-migration.test.js',
    'api/api.test.js',
    'security/security.test.js',
    'performance/performance.test.js',
    'monkey/monkey.test.js',
    'compatibility/compatibility.test.js',
    'regression/regression.test.js',
    'exploratory/exploratory.test.js',
    'installation/installation.test.js',
    'recovery/recovery.test.js'
];

async function runSuite(suitePath) {
    return new Promise((resolve) => {
        const fullPath = path.join(__dirname, suitePath);
        console.log(`\n========================================`);
        console.log(`Running: ${suitePath}`);
        console.log(`========================================`);
        
        const child = spawn('node', [fullPath], { stdio: 'inherit' });
        
        child.on('close', (code) => {
            if (code === 0) {
                resolve({ suite: suitePath, success: true });
            } else {
                resolve({ suite: suitePath, success: false, code });
            }
        });
    });
}

async function main() {
    const results = [];
    for (const suite of testSuites) {
        const result = await runSuite(suite);
        results.push(result);
    }
    
    console.log(`\n========================================`);
    console.log(`             TEST REPORT                `);
    console.log(`========================================`);
    let failed = 0;
    results.forEach(r => {
        if (r.success) {
            console.log(`✅  ${r.suite} - PASSED`);
        } else {
            console.log(`❌  ${r.suite} - FAILED (Exit code: ${r.code})`);
            failed++;
        }
    });
    console.log(`========================================`);
    console.log(`Summary: ${results.length - failed}/${results.length} suites passed.`);
    console.log(`========================================\n`);
    
    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

main().catch(err => {
    console.error('Test runner failed:', err);
    process.exit(1);
});
