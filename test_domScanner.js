console.log('--- Testing DOMScanner evaluateSelector Error Path ---');

// Silence console logs for clean test output unless it's an error we want to see
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
console.log = () => {};
console.error = () => {};
console.warn = () => {};

// Mock browser APIs and required globals BEFORE requiring DOMScanner
global.window = {
    self: {},
    top: {}
};
global.document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    documentElement: { appendChild: () => {} },
    body: { style: {} },
    getElementsByTagName: () => []
};

let messageListener = null;
global.chrome = {
    runtime: {
        onMessage: {
            addListener: function(fn) {
                messageListener = fn;
            }
        },
        sendMessage: () => {}
    },
    storage: {
        local: {
            get: (keys, cb) => cb({})
        }
    }
};

global.PlanService = class PlanService { init() {} };
global.LocatorGenerator = class LocatorGenerator {
    setConfig() {}
};

global.LocatorXConfig = {
    LIMITS: { MAX_MATCH_DEFAULT: 500 },
    FILTER_GROUPS: { CORE: [] },
    IDENTIFIERS: { DATA_ATTRIBUTES: [], ID_PREFIX: 'lx-' }
};

// Now we require and instantiate
const DOMScanner = require('./src/content/domScanner.js');
const domScanner = new DOMScanner();

// Ensure listener was registered
if (!messageListener) {
    originalConsoleError('FAIL: chrome.runtime.onMessage.addListener was not called.');
    process.exit(1);
}

// Override evaluateSelector to throw an intentional error
domScanner.evaluateSelector = () => {
    throw new Error('Simulated evaluation error');
};

let responseReceived = null;
const sendResponse = (response) => {
    responseReceived = response;
};

// Simulate evaluateSelector message
messageListener({
    action: 'evaluateSelector',
    selector: '.invalid-selector',
    type: 'css',
    enableSmartCorrect: false,
    maxMatchLimit: 100
}, {}, sendResponse);

// Restore console
console.log = originalConsoleLog;
console.error = originalConsoleError;
console.warn = originalConsoleWarn;

// Verify response
if (responseReceived && responseReceived.error && responseReceived.error.includes('Simulated evaluation error')) {
    console.log('PASS: evaluateSelector error path correctly caught and returned error.');
} else {
    console.error('FAIL: evaluateSelector error path did not return expected error.', responseReceived);
    process.exit(1);
}
