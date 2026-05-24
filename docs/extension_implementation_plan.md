# Future Implementation Plan - Locator-X Chrome Extension Rebuild

This document outlines a phase-by-phase roadmap to rebuild, refactor, or expand the Locator-X browser extension from scratch using modern Manifest V3 architecture.

---

## Phase 1: Environment Setup & Build Pipeline
Initialize the codebase and compile workspace environments.
1.  **Configure Manifest V3 (`manifest.json`):**
    *   Define service worker (`src/background/background.js`).
    *   Register content script rules for matching URL patterns (`src/content/domScanner.js`).
    *   Declare permission sets: `activeTab`, `storage`, `contextMenus`, `webNavigation`.
    *   Register `side_panel` properties.
2.  **Define Project Structure:**
    *   `src/background`: Service worker background logic
    *   `src/content`: DOM scanner, highlight overlays, scraper engines
    *   `src/services`: Storage, evaluator, patterns registry, plans
    *   `src/ui`: SidePanel and DevTools HTML, CSS, controllers
    *   `tests`: Test suites for evaluators and scanners
3.  **Setup NPM Scripts:** Config project dependencies (e.g. JSZip for exports) and standard testing frameworks.

---

## Phase 2: Core Generation & Traversal Engine
Build the mathematical locator generator independently of extension boundaries.
1.  **Implement DOM Scraper (`locator-generator.js`):**
    *   Write utility functions for ID, Name, CSS path, and tag selector resolution.
    *   Add Shadow DOM boundary hopping logic (`shadowRoot` traversal).
2.  **Integrate Smart Filtering:**
    *   Create regular expressions (`looksDynamic`) to detect dynamic IDs (pure numeric strings, ember elements, long UUID hex combinations).
    *   Filter classes to remove framework noise.
3.  **Build Axes Generator:**
    *   Implement Closest Common Ancestor (CCA) tree traversal logic.
    *   Use bitwise compare flags (`compareDocumentPosition`) to match axis directions (`preceding`, `following`, etc.).
    *   Add automatic uniqueness validation index fallbacks: `(xpath)[index]`.

---

## Phase 3: Background broker & Storage Services
Create the extension core database and tab state tracking.
1.  **Write Storage Manager (`storage-manager.js`):**
    *   Develop a promise-based client storage service using `chrome.storage.local`.
    *   Include a migration function to import data from legacy `localStorage` keys.
2.  **Implement Tab State Registry (`background.js`):**
    *   Track active tab switches and store current modes/inspect locks in `chrome.storage.session`.
    *   Build cleanup hooks on tab closing events.
3.  **Coordinate Context Menu Event Listeners:**
    *   Add right-click contexts on inspectable elements to copy specific locators directly to the clipboard.

---

## Phase 4: DevTools & SidePanel UI Layer
Develop the user-facing interface, highlighting tools, and settings.
1.  **Style Visual Theme Components:**
    *   Define HSL variable sheets supporting Dark/Light switching.
    *   Design a fluid navigation header, side options drawers, and monospace grid scrollbars.
2.  **Bind Event Controller (`panel-controller.js`):**
    *   Coordinate visual updates when items are selected or generated.
    *   Wire validation indicators: count badge calculations (`1` vs `>1` or `0`), warnings icons, and next/prev search result navigations.
3.  **Create Custom Modal Systems:**
    *   Write custom CSS prompt templates for rename alerts, delete verifications, and warning dialog overrides.

---

## Phase 5: Advanced Utilities & Feature Sets
Deploy the high-value features.
1.  **POM Page Editor:**
    *   Manage virtual folders.
    *   Implement field-to-field mapping grid tables. Add type selector drop-downs directly into table rows.
2.  **MultiScan Registry Parser:**
    *   Build file upload/drag-and-drop file readers.
    *   Map scanning tokens using the pre-compiled regex schemas inside `patterns.js`.
3.  **DOM Debugger Service:**
    *   Register action triggers that fire a `debugger;` statement on countdown expirations.

---

## Phase 6: Quality Assurance & Compilation
Verify all interfaces and package the extension.
1.  **Write Mock Unit Tests:**
    *   Configure Node.js wrappers that mock global properties (`global.window`, `global.chrome`, `global.document`).
    *   Assert evaluator code un-wrapping functions, suggestions sort algorithms, and scanner regex matches.
2.  **Package Build Compilation:**
    *   Write compile commands that bundle extension source directories into clean zip formats suitable for uploading to the Chrome Web Store.
