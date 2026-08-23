// Auth Sync Content Script
// Runs on the website to sync auth state with the extension
const sJson = typeof secureJson !== 'undefined' ? secureJson : (typeof require !== 'undefined' ? require('../utils/secure-json.js') : null);

const EXTENSION_ID = chrome.runtime.id;
const USERS_KEY = 'locatorx_current_user'; // Matches website implementation


// Listen for storage changes from the website
window.addEventListener('storage', (event) => {
    if (event.key === USERS_KEY) {
        syncAuthState();
    }
});

// Listen for custom events from the website (using document for better reliability)
document.addEventListener('SYNC_LOCATOR_X', (event) => {
    console.log('Locator-X Content Script: Caught sync event', event.detail);
    if (event.detail) {
        syncAuthState(event.detail);
    }
});

// Also check on load and periodically
syncAuthState();

// Safely listen for localStorage modifications via proxy wrapper
try {
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function (key, value) {
        Reflect.apply(originalSetItem, this, arguments);
        if (key === USERS_KEY) {
            syncAuthState();
        }
    };

    const originalRemoveItem = localStorage.removeItem;
    localStorage.removeItem = function (key) {
        Reflect.apply(originalRemoveItem, this, arguments);
        if (key === USERS_KEY) {
            syncAuthState();
        }
    };
} catch (e) {
    // Fallback if localStorage is frozen by host page
}


function syncAuthState(providedUser = null) {
    // Check if extension context is valid
    if (!chrome.runtime || !chrome.runtime.id) {
        console.warn('Locator-X Sync: Extension context invalidated, stopping sync.');
        return;
    }

    try {
        const user = providedUser || (sJson ? sJson.parse(localStorage.getItem(USERS_KEY) || 'null') : JSON.parse(localStorage.getItem(USERS_KEY) || 'null'));

        if (user) {
            console.log('Locator-X Sync: Syncing user', user);

            // Send to background using SYNC_PROFILE for safe merging
            // Use try-catch around sendMessage to capture immediate context errors
            try {
                chrome.runtime.sendMessage({
                    action: 'SYNC_PROFILE',
                    payload: {
                        user: user
                    }
                }).catch(err => {
                    // Suppress harmless context invalidated errors
                    if (err.message && err.message.includes('Extension context invalidated')) return;
                    console.error('Locator-X Sync: Send error', err);
                });
            } catch (err) {
                if (err.message && err.message.includes('Extension context invalidated')) return;
                console.error('Locator-X Sync: Runtime error', err);
            }
        } else {
            console.log('Locator-X Sync: User logged out');
            // Send logout
            try {
                chrome.runtime.sendMessage({
                    action: 'LOGOUT'
                }).catch(err => {
                    if (err.message && err.message.includes('Extension context invalidated')) return;
                    console.error('Locator-X Sync: Send error', err);
                });
            } catch (err) {
                if (err.message && err.message.includes('Extension context invalidated')) return;
                console.error('Locator-X Sync: Runtime error', err);
            }
        }
    } catch (e) {
        // Only log if it's NOT a context error
        if (e.message && e.message.includes('Extension context invalidated')) {
            console.warn('Locator-X Sync: Extension context invalidated during sync.');
            return;
        }
        console.error('Locator-X Sync: Error syncing auth state', e);
    }
}
