/**
 * Secure JSON Parser Utility for Locator-X Chrome Extension
 * Prevents Prototype Pollution vulnerabilities by scanning parsed JSON for dangerous keys
 * like '__proto__' and 'constructor.prototype'.
 */
const secureJson = {
    /**
     * Parses a JSON string and validates it against prototype pollution.
     * @param {string} text The JSON string to parse.
     * @param {Function} [reviver] Optional reviver function.
     * @param {Object} [options] Parsing options.
     * @param {string} [options.protoAction='error'] Action for '__proto__' key: 'error', 'remove', or 'ignore'.
     * @param {string} [options.constructorAction='error'] Action for 'constructor.prototype' key: 'error', 'remove', or 'ignore'.
     * @returns {*} The parsed JSON value.
     */
    parse(text, reviver, options = {}) {
        // Handle case where options is passed as the second argument
        if (typeof reviver === 'object' && reviver !== null) {
            options = reviver;
            reviver = undefined;
        }

        const protoAction = options.protoAction || 'error';
        const constructorAction = options.constructorAction || 'error';

        // Parse with native JSON.parse first
        const parsed = JSON.parse(text, reviver);

        // Scan the parsed object recursively
        this.scan(parsed, { protoAction, constructorAction });

        return parsed;
    },

    /**
     * Recursively scans an object for prototype pollution keys.
     * @param {*} obj The object to scan.
     * @param {Object} options Scan options.
     * @private
     */
    scan(obj, options) {
        if (!obj || typeof obj !== 'object') {
            return;
        }

        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                if (obj[i] && typeof obj[i] === 'object') {
                    this.scan(obj[i], options);
                }
            }
            return;
        }

        const { protoAction, constructorAction } = options;

        // Check for '__proto__' property directly on the object
        if (Object.prototype.hasOwnProperty.call(obj, '__proto__')) {
            if (protoAction === 'error') {
                throw new SyntaxError('Unsafe key "__proto__" found in JSON');
            } else if (protoAction === 'remove') {
                delete obj.__proto__;
            }
        }

        // Check for 'constructor' property containing 'prototype'
        if (Object.prototype.hasOwnProperty.call(obj, 'constructor')) {
            const constructorVal = obj.constructor;
            if (constructorVal && typeof constructorVal === 'object') {
                if (Object.prototype.hasOwnProperty.call(constructorVal, 'prototype')) {
                    if (constructorAction === 'error') {
                        throw new SyntaxError('Unsafe key "constructor.prototype" found in JSON');
                    } else if (constructorAction === 'remove') {
                        delete constructorVal.prototype;
                    }
                }
            }
        }

        // Recursively scan all other properties
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const val = obj[key];
                if (val && typeof val === 'object') {
                    this.scan(val, options);
                }
            }
        }
    }
};

// Export to make it available in both Node (testing) and Browser/Extension environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = secureJson;
} else if (typeof globalThis !== 'undefined') {
    globalThis.secureJson = secureJson;
} else if (typeof window !== 'undefined') {
    window.secureJson = secureJson;
}
