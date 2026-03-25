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
import { setupErrorDetailsDialog, showErrorDetailsDialog } from './components/ErrorDetailsDialog.js';
import { createMainTableController } from './components/MainTable.js';
import { createFiltersDialogController } from './components/FiltersDialog.js';
import { setupLoginScreen } from './components/LoginScreen.js';
import { setCurrentUserKey } from './services/ApiClient.js';

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

  setupLoginScreen((userKey) => {
    setCurrentUserKey(userKey);
    const loginScreen = document.getElementById('loginScreen');
    const appShell = document.querySelector('.app-shell');
    if (loginScreen) loginScreen.classList.add('hidden');
    if (appShell) appShell.classList.remove('hidden');
    initMainApp();
  });
});

function initMainApp() {
  const appTitle = document.getElementById("appTitle");
  if (appTitle) appTitle.textContent = uiTexts.appTitle;
  const editButton = document.getElementById('editButton');
  const notImplementedDialog = document.getElementById('notImplementedDialog');
  const notImplementedCloseButton = document.getElementById('notImplementedCloseButton');

  if (notImplementedDialog && notImplementedCloseButton) {
    notImplementedCloseButton.addEventListener('click', () => notImplementedDialog.close());
  }

  // Initialize dialogs
  setupVersionHistoryDialog();
  setupRecordDetailsDialog();
  setupErrorDetailsDialog();
  // Assign texts to UI elements
  const assignText = [
    ["accountToggle", "accountButton"],
    ["signOutButton", "signOutButton"],
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
  const dictionaryAccessById = new Map();
  let isUpdaterEditMode = false;
  let filtersController = null;

  const tableController = createMainTableController({
    onDetailsRequested: (row, columns) => {
      const selectedDictionary = dictionarySelect ? String(dictionarySelect.value || '').trim() : '';
      const dictionaryAccess = dictionaryAccessById.get(selectedDictionary);
      const canUpdate = dictionaryAccess ? Boolean(dictionaryAccess.canUpdate) : false;

      if (isUpdaterEditMode && canUpdate) {
        if (notImplementedDialog) {
          notImplementedDialog.showModal();
        }
        return;
      }

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

      if (editButton) {
        editButton.disabled = !state.hasLoadedTableData || !state.activeDictionary || !state.selectedDictionaryVersionKey;
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
    },
    onError: (err) => showErrorDetailsDialog(err && err.message ? err.message : String(err), err && err.details ? err.details : '')
  });

  filtersController = createFiltersDialogController({ tableController });
  filtersController.initialize();
  filtersController.updateFromTableState(tableController.getState());

  tableController.initialize();

  // Render dictionary list
  renderDictionaryList().then((dictionaries) => {
    dictionaryAccessById.clear();
    (Array.isArray(dictionaries) ? dictionaries : []).forEach((dict) => {
      if (!dict || typeof dict.id !== 'string') {
        return;
      }

      dictionaryAccessById.set(dict.id, {
        canUpdate: Boolean(dict.canUpdate)
      });
    });
  });

  // Render dictionary version list and rows on selection changes
  if (dictionarySelect) {
    dictionarySelect.addEventListener('change', async () => {
      const selectedDictionary = String(dictionarySelect.value || '').trim();
      tableController.setDictionary(selectedDictionary);
      isUpdaterEditMode = false;
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

  if (editButton) {
    editButton.addEventListener('click', () => {
      const selectedDictionary = dictionarySelect ? String(dictionarySelect.value || '').trim() : '';
      const selectedVersion = dictionaryVersionSelect ? String(dictionaryVersionSelect.value || '').trim() : '';
      if (!selectedDictionary || !selectedVersion) {
        return;
      }

      const dictionaryAccess = dictionaryAccessById.get(selectedDictionary);
      const canUpdate = dictionaryAccess ? Boolean(dictionaryAccess.canUpdate) : false;

      if (!canUpdate) {
        isUpdaterEditMode = false;
        if (notImplementedDialog) {
          notImplementedDialog.showModal();
        }
        return;
      }

      if (!isUpdaterEditMode) {
        isUpdaterEditMode = true;
        tableController.setRowActionLabel(uiTexts.editDictionary || 'Edit');
        return;
      }

      if (notImplementedDialog) {
        notImplementedDialog.showModal();
      }
    });
  }
}
