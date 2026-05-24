# Storage Schema Document - Locator-X Chrome Extension

This document details the structures, data types, and default values for all keys stored in local client-side storage (`chrome.storage.local` and `chrome.storage.session`).

---

## 1. Storage Registry Keys

The extension uses the namespace prefix `locator-x` to identify its data records.

| Constant Name | Storage Key | Context | Scope |
| :--- | :--- | :--- | :--- |
| `SAVED` | `'locator-x-saved'` | Saved locators database | `local` |
| `POM_PAGES` | `'locator-x-pom-pages'` | Page Object Model arrays | `local` |
| `SETTINGS` | `'locator-x-settings'` | User configuration settings | `local` |
| `HISTORY` | `'locator-x-history'` | Activity generation history logs | `local` |
| `THEME` | `'locator-x-theme'` | Visual theme selection (`'light'`/`'dark'`) | `local` |
| `PLAN` | `'locator-x-plan'` | Account subscription cache | `local` |
| `AUTH_TOKEN` | `'authToken'` | User session JWT token | `local` |
| `USER` | `'user'` | Cache of current logged-in user profile | `local` |
| `FILTERS(tab)`| `'locator-x-filters-[tab]'`| Checkbox states for `home` and `pom` views | `local` |
| `TAB_STATES` | `'lx_tab_states'` | Tab-specific active inspection states | `session` |

---

## 2. Detailed Data Schemas

### 2.1. Saved Locators Schema (`'locator-x-saved'`)
An array of objects representing individually bookmarked locators.
*   **Type:** `Array<SavedLocator>`
*   **Item Structure:**
    ```json
    {
      "id": 1716492341000, 
      "name": "login_submit_btn",
      "type": "relativeXpath",
      "locator": "//button[@type='submit' and contains(@class, 'btn-primary')]",
      "date": "2026-05-23T17:05:41.000Z"
    }
    ```

### 2.2. Page Object Model Pages Schema (`'locator-x-pom-pages'`)
An array of virtual page models containing field structures.
*   **Type:** `Array<POMPage>`
*   **Item Structure:**
    ```json
    {
      "id": "pom_1716492352000",
      "name": "Login Page",
      "createdAt": "2026-05-23T17:05:52.000Z",
      "updatedAt": "2026-05-23T17:05:52.000Z",
      "locators": [
        {
          "name": "usernameInput",
          "type": "id",
          "locator": "#username",
          "timestamp": "2026-05-23T17:06:12.000Z"
        },
        {
          "name": "passwordInput",
          "type": "css",
          "locator": "input[type='password']",
          "timestamp": "2026-05-23T17:06:15.000Z"
        }
      ]
    }
    ```

### 2.3. Settings Schema (`'locator-x-settings'`)
Key-value pair mappings for application runtime configuration.
*   **Type:** `Object`
*   **Structure & Defaults:**
    ```json
    {
      "framework": "selenium-java", 
      "smartCorrectEnabled": true,
      "excludeNumbers": true,
      "showTimestamp": false,
      "maxMatchLimit": 150
    }
    ```

### 2.4. History Schema (`'locator-x-history'`)
Circular log recording generated locators during browser session. Capped at a maximum number of records based on limits (default 50).
*   **Type:** `Array<HistoryItem>`
*   **Item Structure:**
    ```json
    {
      "id": 1716492361000,
      "type": "generation",
      "timestamp": "2026-05-23T17:06:01.000Z",
      "element": "<button type=\"submit\" class=\"btn btn-primary\">Login</button>",
      "locators": [
        { "type": "id", "locator": "submit-btn" },
        { "type": "css", "locator": ".btn-primary" }
      ]
    }
    ```

### 2.5. Active Filter States (`'locator-x-filters-home'` & `'locator-x-filters-pom'`)
Direct representation of checkbox UI settings indicating which strategies are active.
*   **Type:** `Object`
*   **Structure:**
    ```json
    {
      "id": true,
      "name": true,
      "tagname": false,
      "className": false,
      "css": true,
      "linkText": true,
      "pLinkText": false,
      "relative": true,
      "absolute": false,
      "xpath": true,
      "contains": true,
      "indexed": false,
      "linktext": false,
      "plinktext": false,
      "attribute": true,
      "startsWithXpath": false,
      "cssXpath": false,
      "jsPath": false,
      "jquery": false
    }
    ```
