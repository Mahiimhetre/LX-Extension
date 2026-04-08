## 2025-05-22 - Fix DOM XSS in POM Cell Value Rendering

**Vulnerability:** DOM-based Cross-Site Scripting (XSS) via innerHTML interpolation.

**Learning:** Dynamic data, such as locator values, indices, and timestamps, were being directly interpolated into innerHTML strings in panel-controller.js and modal.js. This allowed potentially malicious content to be executed as script if injected into those values.

**Prevention:** Always use secure DOM manipulation methods like document.createElement() and textContent to handle dynamic data. If HTML structure must be partially dynamic, use insertAdjacentHTML for static parts and sanitize any dynamic content using the LocatorX.utils.escapeHtml utility. For standalone components like LocatorXModal, include a dedicated escaping helper.
