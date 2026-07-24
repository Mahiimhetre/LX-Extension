/**
 * Page Object Models for Locator-X
 * Provides strict POM wrapping around mocked DOM structures.
 */

const { MockElement } = require('./mock-environment.js');

class BasePOM {
    getElement(id) {
        return global.document.getElementById(id);
    }
    
    getElements(selector) {
        return global.document.querySelectorAll(selector);
    }
}

class PanelPage extends BasePOM {
    get inspectBtn() { return this.getElement('inspectBtn'); }
    get searchInput() { return this.getElement('searchInput'); }
    get saveLocatorInput() { return this.getElement('saveLocatorInput'); }
    get saveLocatorBtn() { return this.getElement('saveLocatorBtn'); }
    get homeElementDetail() { return this.getElement('homeElementDetail'); }
    get locTypeAll() { return this.getElement('locTypeAll'); }

    clickInspect() {
        if (this.inspectBtn) this.inspectBtn.click();
    }

    typeSearch(val) {
        const el = this.searchInput;
        if (el) {
            el.value = val;
            el.dispatchEvent('input');
            el.dispatchEvent('change');
        }
    }

    typeSaveName(val) {
        const el = this.saveLocatorInput;
        if (el) {
            el.value = val;
            el.dispatchEvent('input');
            el.dispatchEvent('change');
        }
    }

    clickSave() {
        if (this.saveLocatorBtn) this.saveLocatorBtn.click();
    }

    clickSelectAll() {
        const el = this.locTypeAll;
        if (el) {
            el.checked = !el.checked;
            el.dispatchEvent('change');
        }
    }

    getLocatorRows() {
        const tbody = this.getElements('.locator-table tbody')[0];
        return tbody ? tbody.children : [];
    }

    getElementDetail() {
        return this.homeElementDetail ? this.homeElementDetail.textContent : '';
    }
}

class StrategiesDropdown extends BasePOM {
    get parentCheckbox() { return this.getElement('relativeXPath'); }
    get dropdownArrow() { return this.getElement('relativeDropdownArrow'); }
    get nestedContainer() { return this.getElement('relativeXPathNested'); }
    get selectAllIcon() { return this.getElement('nestedSelectAll'); }

    toggleDropdown() {
        if (this.dropdownArrow) this.dropdownArrow.click();
    }

    clickSelectAll() {
        if (this.selectAllIcon) this.selectAllIcon.click();
    }

    toggleStrategy(id, checked) {
        const el = this.getElement(id);
        if (el && !el.disabled) {
            el.checked = checked;
            el.dispatchEvent('change');
        }
    }

    isStrategyChecked(id) {
        const el = this.getElement(id);
        return el ? el.checked : false;
    }

    isStrategyDisabled(id) {
        const el = this.getElement(id);
        return el ? el.disabled : false;
    }
}

class LinkAuditorDropdown extends BasePOM {
    get triggerBtn() { return this.getElement('navLinkAuditor'); }
    get dropdownPanel() { return this.getElement('linkAuditorDropdown'); }
    get startBtn() { return this.getElement('auditorStartBtn'); }
    get stopBtn() { return this.getElement('auditorStopBtn'); }
    get linksList() { return this.getElement('auditorLinksList'); }
    get exportBtn() { return this.getElement('auditorExportBtn'); }
    get settingsToggle() { return this.getElement('auditorSettingsToggleBtn'); }
    get settingsPanel() { return this.getElement('auditorSettingsPanel'); }
    
    get statAllCount() { return this.getElement('statAllCount'); }
    get statValidCount() { return this.getElement('statValidCount'); }
    get statRedirectCount() { return this.getElement('statRedirectCount'); }
    get statBrokenCount() { return this.getElement('statBrokenCount'); }
    get progressBar() { return this.getElement('auditorProgressBar'); }

    toggleDropdown() {
        if (this.triggerBtn) this.triggerBtn.click();
    }

    toggleSettings() {
        if (this.settingsToggle) this.settingsToggle.click();
    }

    startAudit() {
        if (this.startBtn) this.startBtn.click();
    }

    stopAudit() {
        if (this.stopBtn) this.stopBtn.click();
    }

    exportResults() {
        if (this.exportBtn) this.exportBtn.click();
    }

    setFilter(filterType) {
        const filterEl = this.getElement(`stat${filterType.charAt(0).toUpperCase() + filterType.slice(1)}`);
        if (filterEl) filterEl.click();
    }

    getLinks() {
        if (!this.linksList) return [];
        return this.linksList.children;
    }
}

class SettingsDropdown extends BasePOM {
    get triggerBtn() { return this.getElement('navSettings'); }
    get dropdownPanel() { return this.getElement('settingsDropdown'); }
    get frameworkSelect() { return this.getElement('frameworkSelect'); }
    get smartCorrectCfg() { return this.getElement('smartCorrectCfg'); }
    get excludeNumbersCfg() { return this.getElement('excludeNumbersCfg'); }
    get resetSettingsBtn() { return this.getElement('resetSettingsBtn'); }

    toggleDropdown() {
        if (this.triggerBtn) this.triggerBtn.click();
    }

    changeFramework(val) {
        const el = this.frameworkSelect;
        if (el) {
            el.value = val;
            el.dispatchEvent('change');
        }
    }

    toggleSmartCorrection(checked) {
        const el = this.smartCorrectCfg;
        if (el) {
            el.checked = checked;
            el.dispatchEvent('change');
        }
    }

    toggleExcludeNumbers(checked) {
        const el = this.excludeNumbersCfg;
        if (el) {
            el.checked = checked;
            el.dispatchEvent('change');
        }
    }

    clickReset() {
        if (this.resetSettingsBtn) this.resetSettingsBtn.click();
    }
}

module.exports = {
    PanelPage,
    StrategiesDropdown,
    LinkAuditorDropdown,
    SettingsDropdown
};
