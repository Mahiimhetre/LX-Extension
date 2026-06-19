# Multi-Browser Support Developer & User Guide

Locator-X supports Chrome (and all Chromium-based browsers like Edge, Brave, and Opera), Firefox, and Safari with 100% feature parity using a unified source codebase and a programmatic build pipeline.

---

## 🏗️ The Build Pipeline

To compile the target extension packages, run:
```bash
npm run build
```
This cleans and generates a `dist/` folder containing three distinct target distributions:
*   `dist/chrome` (Chromium Manifest V3)
*   `dist/firefox` (Firefox Manifest V3)
*   `dist/safari` (Safari Web Extension MV3)

---

## 📂 Targeted Manifest Implementations

The build script (`scripts/build.js`) handles browser-specific manifest adjustments automatically to comply with each browser store's validation rules:

### 1. Google Chrome & Chromium (`dist/chrome`)
*   **Surface**: Standard Chrome Sidepanel API.
*   **Manifest Key**: `"side_panel": { "default_path": "src/ui/sidepanel/panel.html" }`
*   **Background**: Uses a standard MV3 non-persistent service worker: `"background": { "service_worker": "src/background/background.js" }`.

### 2. Mozilla Firefox (`dist/firefox`)
*   **Surface**: Firefox Sidebar Action API.
*   **Manifest Key**: `"sidebar_action": { "default_panel": "src/ui/sidepanel/panel.html", ... }`
*   **Background**: Uses event-driven non-persistent background scripts: `"background": { "scripts": ["src/background/background.js"], "type": "module" }`.
*   **Gecko Config**: Includes `"browser_specific_settings": { "gecko": { "id": "locatorx@mahiimhetre.com", ... } }` which is required for Firefox MV3 store ingestion.
*   **Communication**: Since Firefox does not support the Chrome-specific `externally_connectable` key, authentication state updates sent from the `https://locator-x.com` dashboard are intercepted by the `auth-sync.js` content script bridge and forwarded to the background service worker using standard `chrome.runtime.sendMessage`, ensuring 100% seamless auth sync.

### 3. Apple Safari (`dist/safari`)
*   **Surface**: Toolbar Popup Action + DevTools Sidebar Pane.
*   **Manifest Key**: `"action": { "default_popup": "src/ui/sidepanel/panel.html", ... }`
*   **Design Rationale**: Safari does not support native sidebar or side panel APIs. The build pipeline dynamically falls back to standard toolbar extension popup mechanics. This enables Safari users to open the exact same Locator-X dashboard (with full POM registries, history, and search capabilities) in an overlay popup when clicking the extension icon. Additionally, they can use the standard DevTools sidebar elements pane for docked usage.

---

## 🛠️ Installation Instructions

### Chrome & Chromium (Edge, Brave, Opera)
1.  Open Chrome and navigate to `chrome://extensions/`.
2.  Enable **Developer mode** (top-right toggle switch).
3.  Click **Load unpacked** (top-left button).
4.  Select the `dist/chrome` folder.

### Mozilla Firefox
1.  Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2.  Click **Load Temporary Add-on...**.
3.  Navigate to the `dist/firefox` folder and select the `manifest.json` file.
4.  Open the Firefox Sidebar panel (default shortcut `Ctrl+Alt+Y` / `Cmd+Option+Y`) and select **Locator-X** from the sidebar dropdown list.

### Apple Safari
1.  Safari requires standard web extensions to be packaged inside a native macOS app wrapper.
2.  Ensure Xcode is installed, then open Terminal and compile/convert the Safari bundle:
    ```bash
    xcrun safari-web-extension-converter dist/safari
    ```
3.  Xcode will generate a new project. Open the project and run it to register the extension.
4.  Open Safari, go to **Settings > Extensions**, and check the box next to **Locator-X** to enable it.
