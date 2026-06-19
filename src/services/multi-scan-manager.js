class MultiScanManager {
    constructor() {
        // No state needed really, mostly pure functions, but good for grouping
    }

    readFile(file) {
        const allowedExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.txt'];
        const maxSizeBytes = 2 * 1024 * 1024; // 2 MB

        if (!file) {
            return Promise.reject(new Error('No file provided'));
        }

        const extension = '.' + file.name.split('.').pop().toLowerCase();
        if (!allowedExtensions.includes(extension)) {
            return Promise.reject(new Error('Unsupported file type. Allowed: JS, TS, JSX, TSX, Python, Java, TXT'));
        }

        if (file.size > maxSizeBytes) {
            return Promise.reject(new Error('File exceeds size limit of 2 MB'));
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                resolve(event.target.result);
            };
            reader.onerror = (error) => {
                reject(error);
            };
            reader.readAsText(file);
        });
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

// Expose to window for Panel Context or module for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultiScanManager;
} else if (typeof window !== 'undefined') {
    window.MultiScanManager = MultiScanManager;
}
