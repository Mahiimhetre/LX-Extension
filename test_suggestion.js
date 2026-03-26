const SuggestionManager = require('./src/services/suggestion.js');

function assertEquals(actual, expected, message) {
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
        console.log(`PASS: ${message}`);
    } else {
        console.log(`FAIL: ${message}`);
        console.log(`  Expected: ${JSON.stringify(expected)}`);
        console.log(`  Actual:   ${JSON.stringify(actual)}`);
        process.exit(1);
    }
}

function assert(condition, message) {
    if (condition) {
        console.log(`PASS: ${message}`);
    } else {
        console.log(`FAIL: ${message}`);
        process.exit(1);
    }
}

const manager = new SuggestionManager();

// 1. Test Initial State & Empty Query
console.log('--- Test 1: Empty Query ---');
manager.updatePageContext({
    tags: { 'div': 10, 'span': 5 },
    ids: { 'login': 1, 'submit': 1 },
    classes: { 'btn': 5 },
    attributes: {},
    textFragments: []
});

let suggestions = manager.getSuggestions('');
assertEquals(suggestions.length, 4, 'Should return all tags and IDs when query is empty');
assert(suggestions.some(s => s.type === 'div' && s.category === 'Tag'), 'Should contain div tag');
assert(suggestions.some(s => s.type === '#login' && s.category === 'ID'), 'Should contain #login ID');

// 2. Test Matching Tags, IDs, Classes
console.log('\n--- Test 2: Matching Categories ---');
suggestions = manager.getSuggestions('div');
assert(suggestions.some(s => s.type === 'div' && s.category === 'Tag'), 'Should match div tag');

suggestions = manager.getSuggestions('log');
assert(suggestions.some(s => s.type === '#login' && s.category === 'ID'), 'Should match login ID');

suggestions = manager.getSuggestions('btn');
assert(suggestions.some(s => s.type === '.btn' && s.category === 'Class'), 'Should match btn class');

// 3. Test Attributes
console.log('\n--- Test 3: Attributes ---');
manager.updatePageContext({
    attributes: {
        'name': { 'username': 1 },
        'data-test': { 'submit-btn': 1 }
    }
});
suggestions = manager.getSuggestions('user');
assert(suggestions.some(s => s.type === "[@name='username']" && s.category === 'Name'), 'Should match name attribute');

suggestions = manager.getSuggestions('submit');
assert(suggestions.some(s => s.type === "[@data-test='submit-btn']" && s.category === 'Attribute'), 'Should match custom attribute');

// 4. Test Text Fragments
console.log('\n--- Test 4: Text Fragments ---');
manager.updatePageContext({
    textFragments: ['Click Me', 'Submit Form']
});
suggestions = manager.getSuggestions('Click');
assert(suggestions.some(s => s.type === "//*[text()='Click Me']" && s.category === 'Text'), 'Should match text fragment');

// 5. Test XPath Axes & Functions
console.log('\n--- Test 5: XPath Axes & Functions ---');
suggestions = manager.getSuggestions('following-s');
assert(suggestions.some(s => s.type === 'following-sibling::' && s.category === 'XPath'), 'Should match XPath axis');

suggestions = manager.getSuggestions('normalize');
assert(suggestions.some(s => s.type === 'normalize-space()' && s.category === 'XPath'), 'Should match XPath function');

// 6. Test Sorting Logic (Exact > Starts-with > Includes)
console.log('\n--- Test 6: Sorting Logic ---');
manager.updatePageContext({
    tags: { 'table': 1, 'tab': 1, 'notab': 1 }
});
suggestions = manager.getSuggestions('tab');
assertEquals(suggestions[0].type, 'tab', 'Exact match should come first');
assertEquals(suggestions[1].type, 'table', 'Starts-with should come second');
assertEquals(suggestions[2].type, 'notab', 'Includes should come last');

// 7. Test Suggestion Limits
console.log('\n--- Test 7: Suggestion Limits ---');
const manyTags = {};
for (let i = 0; i < 100; i++) {
    manyTags[`tag${i}`] = 1;
}
manager.updatePageContext({ tags: manyTags });

suggestions = manager.getSuggestions('');
assertEquals(suggestions.length, 15, 'Empty query should be limited to 15');

suggestions = manager.getSuggestions('tag');
assertEquals(suggestions.length, 30, 'Non-empty query should be limited to 30');

console.log('\nAll tests passed successfully!');
