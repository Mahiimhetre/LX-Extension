/**
 * Unified Pattern Registry for Locator-X
 * Used for both generating POM code and scanning existing code files.
 */
const LocatorXPatterns = {
    /**
     * FRAMEWORKS defines the registry of supported automation frameworks.
     * Each framework contains an array of patterns used for GEN (Generation) and SCAN (Recognition).
     * 
     * Schema:
     * - id: Unique identifier for the pattern.
     * - label: Human-readable name shown in the UI.
     * - template: The code snippet used for generation. Uses placeholders:
     *      - {type}: The locator strategy (id, name, css, etc.)
     *      - {locator}: The actual selector string.
     * - regex: (Optional) Pre-compiled regex for scanning. If missing, convertToRegex(template) is used.
     * - types: (Optional) Mapping for the {type} placeholder (e.g., 'css' -> 'how = How.CSS, using').
     */
    FRAMEWORKS: {
        'selenium-java': {
            name: 'Selenium (Java)',
            patterns: [
                {
                    id: 'annotation',
                    label: 'Standard @FindBy',
                    template: '@FindBy({type} = "{locator}")',
                    regex: '@FindBy\\s*\\(\\s*([a-zA-Z0-9_.]+)\\s*=\\s*"([^"]+)"',
                    types: { id: 'id', name: 'name', css: 'how = How.CSS, using', xpath: 'xpath' }
                },
                {
                    id: 'driverFind',
                    label: 'driver.findElement',
                    template: 'driver.findElement(By.{type}("{locator}"))',
                    regex: 'driver\\.findElements?\\s*\\(\\s*By\\.([a-zA-Z]+)\\s*\\(\\s*"([^"]+)"\\s*\\)\\s*\\)',
                    types: { id: 'id', name: 'name', css: 'cssSelector', xpath: 'xpath' }
                },
                {
                    id: 'genericBy',
                    label: 'Generic By',
                    template: 'By.{type}("{locator}")',
                    regex: 'By\\.([a-zA-Z]+)\\s*\\(\\s*"([^"]+)"\\s*\\)',
                    types: { id: 'id', name: 'name', css: 'cssSelector', xpath: 'xpath' }
                }
            ]
        },
        'selenium-python': {
            name: 'Selenium (Python)',
            patterns: [
                {
                    id: 'standard',
                    label: 'Standard find_element',
                    template: 'driver.find_element(By.{TYPE}, "{locator}")',
                    regex: 'driver\\.find_elements?\\s*\\(\\s*By\\.([a-zA-Z_]+)\\s*,\\s*"([^"]+)"\\s*\\)',
                    types: { id: 'ID', name: 'NAME', css: 'CSS_SELECTOR', xpath: 'XPATH' }
                },
                {
                    id: 'genericBy',
                    label: 'Generic By',
                    template: 'By.{TYPE}, "{locator}"',
                    regex: 'By\\.([a-zA-Z_]+)\\s*,\\s*"([^"]+)"',
                    types: { id: 'ID', name: 'NAME', css: 'CSS_SELECTOR', xpath: 'XPATH' }
                }
            ]
        },
        'selenium-js': {
            name: 'Selenium (JavaScript)',
            patterns: [
                {
                    id: 'standard',
                    label: 'Standard findElement',
                    template: 'await driver.findElement(By.{type}("{locator}"))',
                    regex: 'await\\s+driver\\.findElement\\s*\\(\\s*By\\.([a-zA-Z]+)\\s*\\(\\s*"([^"]+)"\\s*\\)\\s*\\)',
                    types: { id: 'id', name: 'name', css: 'css', xpath: 'xpath' }
                }
            ]
        },
        'playwright-js': {
            name: 'Playwright (JS/TS)',
            patterns: [
                {
                    id: 'locator',
                    label: 'page.locator',
                    template: 'page.locator("{type}={locator}")',
                    regex: 'page\\.locator\\s*\\(\\s*"([a-zA-Z-]+)=([^"]+)"\\s*\\)',
                    types: { id: 'id', css: 'css', xpath: 'xpath' }
                },
                {
                    id: 'generic',
                    label: 'page.locator (unlabeled)',
                    template: 'page.locator("{locator}")',
                    regex: '(?:page|\\.)locator\\s*\\(\\s*"((?![a-zA-Z-]+=[^"]+")[^"]+)"\\s*\\)'
                },
                {
                    id: 'roleLabel',
                    label: 'page.getByRole/getByText',
                    template: 'page.getBy{type}("{locator}")',
                    regex: 'page\\.getBy([a-zA-Z]+)\\s*\\(\\s*"([^"]+)"',
                    types: { Role: 'Role', Text: 'Text', Label: 'Label', TestId: 'TestId', Placeholder: 'Placeholder', AltText: 'AltText', Title: 'Title' }
                },
                {
                    id: 'asyncType',
                    label: 'page.click/page.fill',
                    template: 'await page.{type}("{locator}")',
                    regex: 'await\\s+page\\.(?!locator|frameLocator|getBy)([a-zA-Z]+)\\s*\\(\\s*"([^"]+)"',
                    types: { click: 'click', fill: 'fill', check: 'check', uncheck: 'uncheck', selectOption: 'selectOption' }
                }
            ]
        },
        'playwright-python': {
            name: 'Playwright (Python)',
            patterns: [
                {
                    id: 'locator',
                    label: 'page.locator',
                    template: 'page.locator("{type}={locator}")',
                    regex: 'page\\.locator\\s*\\(\\s*"([a-zA-Z-]+)=([^"]+)"\\s*\\)',
                    types: { id: 'id', css: 'css', xpath: 'xpath' }
                },
                {
                    id: 'generic',
                    label: 'page.locator (unlabeled)',
                    template: 'page.locator("{locator}")',
                    regex: 'page\\.(locator)\\s*\\(\\s*"((?![a-zA-Z-]+=[^"]+")[^"]+)"\\s*\\)'
                },
                {
                    id: 'action',
                    label: 'page.click/fill',
                    template: 'page.{type}("{locator}")',
                    regex: 'page\\.(?!locator)([a-zA-Z_]+)\\s*\\(\\s*"([^"]+)"\\s*\\)'
                }
            ]
        },
        'playwright-java': {
            name: 'Playwright (Java)',
            patterns: [
                {
                    id: 'locator',
                    label: 'page.locator',
                    template: 'page.locator("{type}={locator}")',
                    regex: 'page\\.locator\\s*\\(\\s*"([a-zA-Z-]+)=([^"]+)"\\s*\\)',
                    types: { id: 'id', css: 'css', xpath: 'xpath' }
                },
                {
                    id: 'generic',
                    label: 'page.locator (unlabeled)',
                    template: 'page.locator("{locator}")',
                    regex: 'page\\.(locator)\\s*\\(\\s*"((?![a-zA-Z-]+=[^"]+")[^"]+)"\\s*\\)'
                },
                {
                    id: 'action',
                    label: 'page.click/fill',
                    template: 'page.{type}("{locator}")',
                    regex: 'page\\.(?!locator)([a-zA-Z_]+)\\s*\\(\\s*"([^"]+)"\\s*\\)'
                }
            ]
        },
        'cypress': {
            name: 'Cypress',
            patterns: [
                {
                    id: 'get',
                    label: 'cy.get',
                    template: 'cy.get("{locator}")',
                    regex: 'cy\\.(get|find|contains)\\s*\\(\\s*"([^"]+)"',
                }
            ]
        }
    },

    /**
     * Returns the patterns for a specific framework or all patterns if 'all' is passed.
     * @param {string} framework - The framework ID (e.g., 'selenium-java')
     */
    getPatterns(framework) {
        if (framework === 'all') {
            return Object.values(this.FRAMEWORKS).flatMap(f => f.patterns);
        }
        return this.FRAMEWORKS[framework]?.patterns || [];
    },

    /**
     * Generates a code string from a raw locator using the framework's template.
     * @param {string} framework - Framework ID.
     * @param {string} patternId - ID of the specific template to use.
     * @param {string} type - Locator strategy (id, name, xpath, etc.)
     * @param {string} locator - The raw selector.
     */
    generate(framework, patternId, type, locator) {
        const frameworkObj = this.FRAMEWORKS[framework];
        if (!frameworkObj) return locator;

        const pattern = frameworkObj.patterns.find(p => p.id === patternId) || frameworkObj.patterns[0];
        if (!pattern) return locator;

        const mappedType = (pattern.types && pattern.types[type]) || type;

        return pattern.template
            .replace('{type}', mappedType)
            .replace('{TYPE}', mappedType.toUpperCase())
            .replace('{locator}', locator);
    },

    /**
     * Converts a "Smart Pattern" (like cy.get("{locator}")) into a valid Regex Group.
     * Used for custom manual scanning.
     * @param {string} patternInput - The user's input pattern with placeholders.
     */
    convertToRegex(patternInput) {
        if (!patternInput) return '(id|name|class|data-test-id)="([^"]+)"';

        // 1. Escape regex special chars (like . or *) so they match literally
        let safePattern = patternInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // 2. Map {type} placeholder to an alphanumeric capture group
        // This captures things like "id", "name", or "how=how.css"
        if (safePattern.includes('\\{type\\}')) {
            safePattern = safePattern.replace('\\{type\\}', '([a-zA-Z0-9_.]+)');
        }

        // 3. Map {locator} placeholder to a capture group for the actual selector
        // We assume selectors don't contain quotes (since they are usually in quotes)
        if (safePattern.includes('\\{locator\\}')) {
            safePattern = safePattern.replace('\\{locator\\}', '([^"]+)');
        }
        return safePattern;
    },

    /**
     * Performs a global scan on a text string to find matches for a given pattern.
     * @param {string} text - The source code text to scan.
     * @param {string} pattern - The regex string to use.
     * @param {boolean} isCustom - If true, treats the scan as a Smart Pattern vs Built-in.
     * @param {string} smartInputVal - The original un-regexed pattern for type inference.
     */
    extractMatches(text, pattern, isCustom, smartInputVal = '') {
        const regex = new RegExp(pattern, 'g');
        const matches = [...text.matchAll(regex)];

        return matches.map((match, index) => {
            let type = 'Custom';
            let locator = match[0]; // Full string match

            if (!isCustom) {
                // Built-in patterns follow (FullMatch, TypeGroup, LocatorGroup)
                if (match.length >= 3) {
                    type = match[1];
                    locator = match[2];
                }
            } else {
                // Manual/Smart patterns can have flexible group orders
                const hasType = smartInputVal.includes('{type}');
                const hasLocator = smartInputVal.includes('{locator}');

                // Extract captured groups based on which placeholders were provided
                if (hasType && hasLocator && match.length >= 3) {
                    type = match[1];
                    locator = match[2];
                } else if (hasLocator && !hasType && match.length >= 2) {
                    type = 'Smart Match';
                    locator = match[1];
                }

                // --- HEURISTIC TYPE INFERENCE ---
                // If the user's pattern didn't capture a "type", we guess it by looking at the locator string:
                if (type === 'Smart Match' || type === 'Custom') {
                    if (locator.startsWith('/') || locator.startsWith('(')) type = 'xpath';
                    else if (locator.startsWith('#')) type = 'id';
                    else if (locator.startsWith('.')) type = 'className';
                    else if (locator.includes('[')) type = 'css';
                    else type = 'xpath'; // Fallback to xpath for complex strings
                }
            }
            return { index, type, locator };
        });
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocatorXPatterns;
} else {
    window.LocatorXPatterns = LocatorXPatterns;
}
