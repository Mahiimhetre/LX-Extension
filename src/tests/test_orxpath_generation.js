const LocatorGenerator = require('../services/locator-generator.js');
global.LocatorXConfig = require('../config/constants.js');

// Mock HTML element generator
function createMockElement({ tagName, id = '', name = '', className = '', text = '', attributes = {} }) {
    const attrMap = { id, name, class: className, ...attributes };
    const attributesArray = Object.entries(attrMap)
        .filter(([_, val]) => val !== '')
        .map(([key, val]) => ({ name: key, value: val }));

    return {
        tagName: tagName.toUpperCase(),
        id,
        name,
        className,
        textContent: text,
        classList: {
            contains: (cls) => className.split(' ').includes(cls)
        },
        getAttribute: (attr) => attrMap[attr] || null,
        attributes: attributesArray
    };
}

const generator = new LocatorGenerator();
generator._isFeatureEnabled = () => true; // mock Pro plan
generator.countMatches = () => 1; // mock match counting

console.log("=== Testing OR XPath Generation Logic ===\n");

const testCases = [
    {
        name: "Login Username Input",
        element: createMockElement({
            tagName: 'input',
            id: 'txtUsername',
            name: 'username',
            className: 'form-control login-input',
            attributes: { placeholder: 'Enter username' }
        })
    },
    {
        name: "Submit Button with Class and Text",
        element: createMockElement({
            tagName: 'button',
            className: 'btn btn-primary submit-btn',
            text: 'Save Changes'
        })
    },
    {
        name: "Sign Up Email Field",
        element: createMockElement({
            tagName: 'input',
            name: 'signup-email',
            className: 'input-text email-input',
            attributes: { type: 'email', placeholder: 'Email Address' }
        })
    },
    {
        name: "Profile Card Container (ID + Class)",
        element: createMockElement({
            tagName: 'div',
            id: 'profile-card',
            className: 'card-container main-card'
        })
    },
    {
        name: "Custom Search Field (Name + Text/Placeholder)",
        element: createMockElement({
            tagName: 'input',
            name: 'custom-query',
            text: 'Search site...'
        })
    }
];

testCases.forEach((tc, idx) => {
    console.log(`Case ${idx + 1}: ${tc.name}`);
    console.log(`- Input attributes: tag=${tc.element.tagName}, id='${tc.element.id}', name='${tc.element.name}', class='${tc.element.className}', text='${tc.element.textContent}'`);
    
    // 1. Test generateOrXPath directly
    const orXPath = generator.generateOrXPath(tc.element);
    console.log(`- generateOrXPath() output: ${orXPath}`);

    // 2. Test generateLocators list
    const locators = generator.generateLocators(tc.element, ['orXpath']);
    const entry = locators.find(l => l.type === 'OR XPath');
    console.log(`- generateLocators() 'OR XPath' entry:`, entry ? JSON.stringify(entry) : "None (not generated)");
    console.log("------------------------------------------");
});
