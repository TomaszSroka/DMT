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
import { setupRecordDetailsShowDialog, showRecordDetailsShowDialog } from './components/RecordDetailsShowDialog.js';
import { setupRecordDetailsEditDialog, showRecordDetailsEditDialog } from './components/RecordDetailsEditDialog.js';
import { setupErrorDetailsDialog, showErrorDetailsDialog } from './components/ErrorDetailsDialog.js';
import { createMainTableController } from './components/MainTable.js';
import { createFiltersDialogController } from './components/FiltersDialog.js';
import { setupLoginScreen } from './components/LoginScreen.js';
import { setCurrentUserKey } from './services/ApiClient.js';
import { createEditController } from './controllers/EditController.js';
import { getRuntimeConfig } from './config/runtime-config.js';

function applyTypographyConfig() {
  const runtimeConfig = getRuntimeConfig();
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

  // Initialize dialogs
  setupVersionHistoryDialog();
  setupRecordDetailsShowDialog();
  setupRecordDetailsEditDialog({ showErrorDetailsDialog });
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
    ["checkOutConfirmTitle", "checkOutConfirmTitle"],
    ["checkOutConfirmConfirmButton", "checkOutConfirmButton"],
    ["checkOutConfirmCancelButton", "checkOutCancelButton"],
    ["filtersDialogTitle", "filtersDialogTitle"],
    ["filtersDialogIntro", "filtersDialogIntro"],
    ["filtersAddRuleButton", "filtersAddRule"],
    ["filtersApplyButton", "filtersApply"],
    ["filtersApplyCloseButton", "filtersApplyClose"],
    ["filtersClearButton", "filtersClear"],
    ["filtersCloseButton", "filtersClose"],
    ["recordDetailsCloseButton", "closeButton"],
    ["showRecordCloseButton", "closeButton"],
    ["editRecordCloseButton", "closeButton"],
    ["notImplementedCloseButton", "closeButton"],
    ["notImplementedTitle", "notImplementedTitle"]
  ];

  assignText.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (id === "rolesLabel" && el) {
      el.textContent = uiTexts[key] || "Dictionary Name - Role Name:";
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
  const globalLoadingInfo = document.getElementById('globalLoadingInfo');
  const dictionarySelect = document.getElementById('dictionarySelect');
  const dictionaryVersionSelect = document.getElementById('dictionaryVersionSelect');
  const editButton = document.getElementById('editButton');
  let filtersController = null;
  let editController = null;

  function buildEmptyRowFromColumns(columns) {
    const row = {};
    (Array.isArray(columns) ? columns : []).forEach((columnDef) => {
      const technicalName = columnDef && typeof columnDef.DICTIONARY_COLUMN_TECHNICAL === 'string'
        ? String(columnDef.DICTIONARY_COLUMN_TECHNICAL).trim()
        : '';
      if (!technicalName) {
        return;
      }
      row[technicalName] = '';
    });
    return row;
  }

  const tableController = createMainTableController({
    onDetailsRequested: (row, columns) => {
      const selectedDictionary = dictionarySelect ? String(dictionarySelect.value || '').trim() : '';

      const selectedDictionaryLabel =
        dictionarySelect && dictionarySelect.selectedOptions && dictionarySelect.selectedOptions[0]
          ? dictionarySelect.selectedOptions[0].textContent
          : '';
      const overrideVersionLabel = editController && typeof editController.getCurrentVersionLabelOverride === 'function'
        ? String(editController.getCurrentVersionLabelOverride() || '').trim()
        : '';
      const selectedVersionLabel =
        overrideVersionLabel
        || (dictionaryVersionSelect && dictionaryVersionSelect.selectedOptions && dictionaryVersionSelect.selectedOptions[0]
          ? dictionaryVersionSelect.selectedOptions[0].textContent
          : '');

      const userContext = window.__DMT_USER_CONTEXT || {};
      const dictionaryRoles = Array.isArray(userContext.dictionaryRoles) ? userContext.dictionaryRoles : [];
      const canUpdateSelectedDictionary = dictionaryRoles.some((item) => {
        const dictionaryId = item && item.dictionary ? String(item.dictionary).trim().toUpperCase() : '';
        const role = item && item.role ? String(item.role).trim().toUpperCase() : '';
        return dictionaryId === String(selectedDictionary || '').trim().toUpperCase() && role === 'DICTIONARY_UPDATER';
      });
      const isUpdaterEditMode = editController && typeof editController.getIsUpdaterEditMode === 'function'
        ? editController.getIsUpdaterEditMode()
        : false;

      if (canUpdateSelectedDictionary && isUpdaterEditMode) {
        const state = tableController.getState();
        showRecordDetailsEditDialog({
          dictionaryName: selectedDictionary,
          dictionaryLabel: selectedDictionaryLabel,
          versionLabel: selectedVersionLabel,
          dictionaryVersionKey: state.selectedDictionaryVersionKey,
          checkoutDictionaryLocation: state.checkoutDictionaryLocation,
          row,
          columns,
          onAfterSave: () => tableController.setDictionaryVersion(state.selectedDictionaryVersionKey)
        });
        return;
      }

      showRecordDetailsShowDialog({
        dictionaryLabel: selectedDictionaryLabel,
        versionLabel: selectedVersionLabel,
        row,
        columns
      });
    },
    onAddRequested: (columns) => {
      const selectedDictionary = dictionarySelect ? String(dictionarySelect.value || '').trim() : '';
      const selectedDictionaryLabel =
        dictionarySelect && dictionarySelect.selectedOptions && dictionarySelect.selectedOptions[0]
          ? dictionarySelect.selectedOptions[0].textContent
          : '';
      const overrideVersionLabel = editController && typeof editController.getCurrentVersionLabelOverride === 'function'
        ? String(editController.getCurrentVersionLabelOverride() || '').trim()
        : '';
      const selectedVersionLabel =
        overrideVersionLabel
        || (dictionaryVersionSelect && dictionaryVersionSelect.selectedOptions && dictionaryVersionSelect.selectedOptions[0]
          ? dictionaryVersionSelect.selectedOptions[0].textContent
          : '');
      const state = tableController.getState();

      showRecordDetailsEditDialog({
        dictionaryName: selectedDictionary,
        dictionaryLabel: selectedDictionaryLabel,
        versionLabel: selectedVersionLabel,
        dictionaryVersionKey: state.selectedDictionaryVersionKey,
        checkoutDictionaryLocation: state.checkoutDictionaryLocation,
        row: buildEmptyRowFromColumns(columns),
        columns,
        isNewRecord: true,
        onAfterSave: () => tableController.setDictionaryVersion(state.selectedDictionaryVersionKey)
      });
    },
    onStateChange: (state) => {
      if (filtersController && typeof filtersController.updateFromTableState === 'function') {
        filtersController.updateFromTableState(state);
      }

      if (editButton) {
        const isUpdaterEditMode = editController && typeof editController.getIsUpdaterEditMode === 'function' ? editController.getIsUpdaterEditMode() : false;
        editButton.disabled = isUpdaterEditMode || !state.hasLoadedTableData || !state.activeDictionary || !state.selectedDictionaryVersionKey;
      }

      if (!state.hasLoadedTableData) {
        if (state.activeDictionary && state.selectedDictionaryVersionKey) {
          if (globalLoadingInfo) {
            globalLoadingInfo.textContent = uiTexts.loadingData;
            globalLoadingInfo.classList.add('is-loading-from-db');
            globalLoadingInfo.setAttribute('aria-busy', 'true');
          }
        } else {
          if (currentDictionaryInfo) {
            currentDictionaryInfo.textContent = uiTexts.currentDictionaryNone;
          }
          if (globalLoadingInfo) {
            globalLoadingInfo.textContent = '';
            globalLoadingInfo.classList.remove('is-loading-from-db');
            globalLoadingInfo.removeAttribute('aria-busy');
          }
        }
        return;
      }

      if (globalLoadingInfo) {
        globalLoadingInfo.textContent = '';
        globalLoadingInfo.classList.remove('is-loading-from-db');
        globalLoadingInfo.removeAttribute('aria-busy');
      }

      if (!currentDictionaryInfo) {
        return;
      }

      const selectedDictionaryLabel =
        dictionarySelect && dictionarySelect.selectedOptions && dictionarySelect.selectedOptions[0]
          ? dictionarySelect.selectedOptions[0].textContent
          : state.activeDictionary;
      const overrideVersionLabel = editController && typeof editController.getCurrentVersionLabelOverride === 'function'
        ? String(editController.getCurrentVersionLabelOverride() || '').trim()
        : '';
      const selectedVersionLabel =
        overrideVersionLabel
        || (dictionaryVersionSelect && dictionaryVersionSelect.selectedOptions && dictionaryVersionSelect.selectedOptions[0]
          ? dictionaryVersionSelect.selectedOptions[0].textContent
          : state.selectedDictionaryVersionKey);

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
    if (editController && typeof editController.setDictionaryAccess === 'function') {
      editController.setDictionaryAccess(dictionaries);
    }
  });

  // Setup Edit controller for managing edit/checkout workflow
  editController = createEditController({
    editButton,
    saveButton: document.getElementById('saveButton'),
    publishButton: document.getElementById('publishButton'),
    discardButton: document.getElementById('discardButton'),
    notImplementedDialog: document.getElementById('notImplementedDialog'),
    notImplementedCloseButton: document.getElementById('notImplementedCloseButton'),
    notImplementedMessage: document.getElementById('notImplementedMessage'),
    notImplementedManagersList: document.getElementById('notImplementedManagersList'),
    checkOutConfirmDialog: document.getElementById('checkOutConfirmDialog'),
    checkOutConfirmMessage: document.getElementById('checkOutConfirmMessage'),
    checkOutConfirmButton: document.getElementById('checkOutConfirmConfirmButton'),
    checkOutCancelButton: document.getElementById('checkOutConfirmCancelButton'),
    tableController,
    dictionarySelect,
    dictionaryVersionSelect,
    renderDictionaryVersionList,
    showErrorDetailsDialog
  });

  window._editController = editController;
  editController.initialize();

  // Setup Version History button
  setupVersionHistoryButton();
}
