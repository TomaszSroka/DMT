import { uiTexts } from '../config/ui-texts.js';
import { setupAccountPanel } from '../components/AccountPanel.js';
import { loadUserInfo } from '../components/UserInfo.js';
import { renderDictionaryList } from '../components/DictionaryList.js';
import { renderDictionaryVersionList } from '../components/DictionaryVersionList.js';
import { setupVersionHistoryButton } from '../components/VersionHistoryButton.js';
import { setupVersionHistoryDialog } from '../components/VersionHistoryDialog.js';
import { setupRecordDetailsShowDialog, showRecordDetailsShowDialog } from '../components/RecordDetailsShowDialog.js';
import { setupRecordDetailsEditDialog, showRecordDetailsEditDialog } from '../components/RecordDetailsEditDialog.js';
import { setupErrorDetailsDialog, showErrorDetailsDialog } from '../components/ErrorDetailsDialog.js';
import { createMainTableController } from '../components/MainTable.js';
import { createFiltersDialogController } from '../components/FiltersDialog.js';
import { createEditController } from '../controllers/EditController.js';
import { applyStaticUiTexts } from './app.texts.js';

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

export function initMainApp() {
  const appTitle = document.getElementById('appTitle');
  if (appTitle) appTitle.textContent = uiTexts.appTitle;

  setupVersionHistoryDialog();
  setupRecordDetailsShowDialog();
  setupRecordDetailsEditDialog({ showErrorDetailsDialog });
  setupErrorDetailsDialog();
  applyStaticUiTexts(uiTexts);

  setupAccountPanel();
  loadUserInfo();

  const currentDictionaryInfo = document.getElementById('currentDictionaryInfo');
  const globalLoadingInfo = document.getElementById('globalLoadingInfo');
  const dictionarySelect = document.getElementById('dictionarySelect');
  const dictionaryVersionSelect = document.getElementById('dictionaryVersionSelect');
  const editButton = document.getElementById('editButton');
  let filtersController = null;
  let editController = null;

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

  renderDictionaryList().then((dictionaries) => {
    if (editController && typeof editController.setDictionaryAccess === 'function') {
      editController.setDictionaryAccess(dictionaries);
    }
  });

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

  setupVersionHistoryButton();
}
