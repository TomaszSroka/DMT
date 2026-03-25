/**
 * app.js
 *
 * Main entry point for the frontend application.
 * - Imports UI texts, components, and dialogs.
 * - Sets up DOMContentLoaded event to initialize UI elements and dialogs.
 * - Assigns static texts to UI elements.
 * - Handles page title and dialog setup.
 * Usage: Included in index.html as the main script.
 */

// Import UI texts
import { uiTexts } from './config/ui-texts.js';
import { setupAccountPanel } from './components/AccountPanel.js';
import { loadUserInfo } from './components/UserInfo.js';
import { renderDictionaryList } from './components/DictionaryList.js';
import { renderDictionaryVersionList } from './components/DictionaryVersionList.js';
import { setupVersionHistoryButton } from './components/VersionHistoryButton.js';
import { setupVersionHistoryDialog } from './components/VersionHistoryDialog.js';
import { setupRecordDetailsDialog, showRecordDetailsDialog } from './components/RecordDetailsDialog.js';
import { setupErrorDetailsDialog } from './components/ErrorDetailsDialog.js';
import { createMainTableController } from './components/MainTable.js';
import { createFiltersDialogController } from './components/FiltersDialog.js';

function applyTypographyConfig() {
  const runtimeConfig = window.FRONTEND_RUNTIME_CONFIG || {};
  const typography = runtimeConfig.typography || {};

  if (Array.isArray(typography.preconnectUrls)) {
    typography.preconnectUrls.forEach((url) => {
      if (!url || document.head.querySelector(`link[rel="preconnect"][href="${url}"]`)) {
        return;
      }

      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = url;
      if (url.includes('gstatic')) {
        link.crossOrigin = '';
      }
      document.head.appendChild(link);
    });
  }

  if (typography.stylesheetUrl && !document.head.querySelector(`link[rel="stylesheet"][href="${typography.stylesheetUrl}"]`)) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = typography.stylesheetUrl;
    document.head.appendChild(stylesheet);
  }

  if (typography.primaryFont) {
    document.documentElement.style.setProperty('--font-primary', typography.primaryFont);
  }
  if (typography.monoFont) {
    document.documentElement.style.setProperty('--font-mono', typography.monoFont);
  }
  if (typography.columnHeaderFont) {
    document.documentElement.style.setProperty('--font-column-header', typography.columnHeaderFont);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  applyTypographyConfig();

  // Set page title
  document.title = uiTexts.appTitle;
  const appTitle = document.getElementById("appTitle");
  if (appTitle) appTitle.textContent = uiTexts.appTitle;

  // Initialize dialogs
  setupVersionHistoryDialog();
  setupRecordDetailsDialog();
  setupErrorDetailsDialog();
  // Assign texts to UI elements
  const assignText = [
    ["accountToggle", "accountButton"],
    ["userNameLabel", "userLabel"],
    ["rolesLabel", "rolesLabel"],
    ["dictionaryLabel", "dictionaryLabel"],
    ["versionLabel", "dictionaryVersionLabel"],
    ["showVersionDetailsButton", "showVersionDetails"],
    ["editButton", "editDictionary"],
    ["saveButton", "save"],
    ["publishButton", "publish"],
    ["discardButton", "discard"],
    ["openFiltersButton", "filtersOpen"],
    ["prevPageButton", "previous"],
    ["nextPageButton", "next"],
    ["discardDialogTitle", "discardDialogTitle"],
    ["discardDialogIntro", "discardDialogIntro"],
    ["discardStayButton", "discardDialogKeepEditing"],
    ["discardConfirmButton", "discardDialogConfirm"],
    ["saveDialogTitle", "saveDialogTitle"],
    ["saveDialogIntro", "saveDialogIntro"],
    ["saveStayButton", "saveDialogBack"],
    ["saveConfirmButton", "saveDialogConfirm"],
    ["discardAllDialogTitle", "discardAllDialogTitle"],
    ["discardAllDialogIntro", "discardAllDialogIntro"],
    ["discardAllStayButton", "discardAllDialogBack"],
    ["discardAllConfirmButton", "discardAllDialogConfirm"],
    ["versionDetailsTitle", "versionDetailsTitle"],
    ["versionDetailsCloseButton", "versionDetailsClose"],
    ["errorDetailsTitle", "errorDetailsTitle"],
    ["errorDetailsCopyButton", "errorDetailsCopy"],
    ["errorDetailsCloseButton", "errorDetailsClose"],
    ["filtersDialogTitle", "filtersDialogTitle"],
    ["filtersDialogIntro", "filtersDialogIntro"],
    ["filtersAddRuleButton", "filtersAddRule"],
    ["filtersApplyButton", "filtersApply"],
    ["filtersApplyCloseButton", "filtersApplyClose"],
    ["filtersClearButton", "filtersClear"],
    ["filtersCloseButton", "filtersClose"]
  ];

  assignText.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (id === "rolesLabel" && el) {
      el.textContent = "Dictionary Name - Role Name:";
    } else if (el && (key === "dictionaryLabel" || key === "dictionaryVersionLabel")) {
      el.textContent = uiTexts[key].replace(/:.*/, "") + ":";
    } else if (el && uiTexts[key]) {
      el.textContent = uiTexts[key];
    }
  });

  // Setup Account panel logic
  setupAccountPanel();

  // Load user info from API
  loadUserInfo();

  const currentDictionaryInfo = document.getElementById('currentDictionaryInfo');
  const dictionarySelect = document.getElementById('dictionarySelect');
  const dictionaryVersionSelect = document.getElementById('dictionaryVersionSelect');
  let filtersController = null;

  const tableController = createMainTableController({
    onDetailsRequested: (row, columns) => {
      const selectedDictionaryLabel =
        dictionarySelect && dictionarySelect.selectedOptions && dictionarySelect.selectedOptions[0]
          ? dictionarySelect.selectedOptions[0].textContent
          : '';
      const selectedVersionLabel =
        dictionaryVersionSelect && dictionaryVersionSelect.selectedOptions && dictionaryVersionSelect.selectedOptions[0]
          ? dictionaryVersionSelect.selectedOptions[0].textContent
          : '';

      showRecordDetailsDialog({
        dictionaryLabel: selectedDictionaryLabel,
        versionLabel: selectedVersionLabel,
        row,
        columns
      });
    },
    onStateChange: (state) => {
      if (filtersController && typeof filtersController.updateFromTableState === 'function') {
        filtersController.updateFromTableState(state);
      }

      if (!currentDictionaryInfo) {
        return;
      }

      if (!state.hasLoadedTableData) {
        if (state.activeDictionary && state.selectedDictionaryVersionKey) {
          currentDictionaryInfo.textContent = uiTexts.loadingData;
        } else {
          currentDictionaryInfo.textContent = uiTexts.currentDictionaryNone;
        }
        return;
      }

      const selectedDictionaryLabel =
        dictionarySelect && dictionarySelect.selectedOptions && dictionarySelect.selectedOptions[0]
          ? dictionarySelect.selectedOptions[0].textContent
          : state.activeDictionary;
      const selectedVersionLabel =
        dictionaryVersionSelect && dictionaryVersionSelect.selectedOptions && dictionaryVersionSelect.selectedOptions[0]
          ? dictionaryVersionSelect.selectedOptions[0].textContent
          : state.selectedDictionaryVersionKey;

      currentDictionaryInfo.textContent = `${selectedDictionaryLabel} ${uiTexts.currentDictionaryVersionShort} ${selectedVersionLabel}`;
    }
  });

  filtersController = createFiltersDialogController({ tableController });
  filtersController.initialize();
  filtersController.updateFromTableState(tableController.getState());

  tableController.initialize();

  // Render dictionary list
  renderDictionaryList();

  // Render dictionary version list and rows on selection changes
  if (dictionarySelect) {
    dictionarySelect.addEventListener('change', async () => {
      const selectedDictionary = String(dictionarySelect.value || '').trim();
      tableController.setDictionary(selectedDictionary);
      await renderDictionaryVersionList(selectedDictionary);
    });
  }

  if (dictionaryVersionSelect) {
    dictionaryVersionSelect.addEventListener('change', () => {
      tableController.setDictionaryVersion(dictionaryVersionSelect.value);
    });
  }

  // Setup Version History button
  setupVersionHistoryButton();
});
