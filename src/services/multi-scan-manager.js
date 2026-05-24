class MultiScanManager {
    constructor() {
        // No state needed really, mostly pure functions, but good for grouping
    }

    getCommonPatterns(framework) {
        if (typeof LocatorXPatterns === 'undefined') return {};
        // MultiScan context expects nested structure or flat array depending on caller
        if (framework === 'all') {
             return LocatorXPatterns.getPatterns('all');
        }
        return { find: LocatorXPatterns.getPatterns(framework) };
    }

    filterPatterns(query, framework) {
        if (typeof LocatorXPatterns === 'undefined') return [];
        query = query.trim().toLowerCase();
        const patterns = LocatorXPatterns.getPatterns(framework);

        return patterns.filter(p =>
            p.label.toLowerCase().includes(query) ||
            (p.template && p.template.toLowerCase().includes(query)) ||
            (p.regex && p.regex.toLowerCase().includes(query))
        );
    }

    convertSmartPatternToRegex(patternInput) {
        if (typeof LocatorXPatterns !== 'undefined') {
            return LocatorXPatterns.convertToRegex(patternInput);
        }
        return patternInput; // Fallback
    }

    findMatches(text, pattern, isCustom, smartInputVal) {
        if (typeof LocatorXPatterns !== 'undefined') {
            return LocatorXPatterns.extractMatches(text, pattern, isCustom, smartInputVal);
        }
        return []; // Fallback
    }

    autoScan(text, framework) {
        if (typeof LocatorXPatterns === 'undefined') return [];
        
        const allPatterns = LocatorXPatterns.getPatterns(framework);
        let allMatches = [];
        const uniqueLocators = new Set();

        allPatterns.forEach(p => {
            try {
                let compiledRegex = p.regex || LocatorXPatterns.convertToRegex(p.template);
                let matches = LocatorXPatterns.extractMatches(text, compiledRegex, false, '');

                matches.forEach(m => {
                    const key = `${m.type}:${m.locator}`;
                    if (!uniqueLocators.has(key)) {
                        uniqueLocators.add(key);
                        allMatches.push(m);
                    }
                });
            } catch (e) {
                console.warn('Regex error for pattern:', p.label, e);
            }
        });

        return allMatches.map((m, i) => ({ ...m, index: i }));
    }
}

// Expose to window for Panel Context
if (typeof window !== 'undefined') {
    window.MultiScanManager = MultiScanManager;
}
