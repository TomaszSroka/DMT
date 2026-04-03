/**
 * RecordDetailsEditDialog.js
 *
 * Editable record dialog used for DICTIONARY_UPDATER role.
 */

import { postJson } from '../services/ApiClient.js';
import { uiTexts } from '../config/ui-texts.js';

let recordDetailsDialog;
let recordDetailsTitle;
let recordDetailsCloseButton;
let recordDetailsContent;
let showErrorDetailsDialog = null;
let saveActionButton = null;
let saveAndCloseActionButton = null;
let discardActionButton = null;
let isHandlersBound = false;

let currentContext = {
  dictionaryName: '',
  dictionaryVersionKey: '',
  checkoutDictionaryLocation: '',
  columns: [],
  originalRow: {},
  currentRow: {},
  isNewRecord: false,
  onAfterSave: null
};

const MAX_VISIBLE_FIELDS = 20;

export function setupRecordDetailsEditDialog({ showErrorDetailsDialog: showErrorDialog } = {}) {
  showErrorDetailsDialog = typeof showErrorDialog === 'function' ? showErrorDialog : null;

  recordDetailsDialog = document.getElementById('editRecordDialog');
  recordDetailsTitle = document.getElementById('editRecordTitle');
  recordDetailsCloseButton = document.getElementById('editRecordCloseButton');
  recordDetailsContent = document.getElementById('editRecordContent');

  ensureActionButtons();
}

function ensureInitialized() {
  if (recordDetailsDialog && recordDetailsTitle && recordDetailsCloseButton && recordDetailsContent) {
    return true;
  }

  setupRecordDetailsEditDialog();
  return Boolean(recordDetailsDialog && recordDetailsTitle && recordDetailsCloseButton && recordDetailsContent);
}

function ensureActionButtons() {
  if (!recordDetailsDialog) {
    return;
  }

  const actionsContainer = recordDetailsDialog.querySelector('.edit-record-actions');
  if (!actionsContainer) {
    return;
  }

  if (saveActionButton && !actionsContainer.contains(saveActionButton)) {
    saveActionButton = null;
  }
  if (saveAndCloseActionButton && !actionsContainer.contains(saveAndCloseActionButton)) {
    saveAndCloseActionButton = null;
  }
  if (discardActionButton && !actionsContainer.contains(discardActionButton)) {
    discardActionButton = null;
  }

  if (!saveActionButton) {
    saveActionButton = document.createElement('button');
    saveActionButton.type = 'button';
    saveActionButton.className = 'btn btn-save';
    saveActionButton.textContent = uiTexts.save || 'Complete';
    saveActionButton.disabled = true;
    saveActionButton.addEventListener('click', onSaveClick);
    actionsContainer.insertBefore(saveActionButton, recordDetailsCloseButton || null);
  }
  saveActionButton.style.display = '';

  if (!saveAndCloseActionButton) {
    saveAndCloseActionButton = document.createElement('button');
    saveAndCloseActionButton.type = 'button';
    saveAndCloseActionButton.className = 'btn btn-save';
    saveAndCloseActionButton.textContent = uiTexts.saveAndClose || 'Complete & Close';
    saveAndCloseActionButton.disabled = true;
    saveAndCloseActionButton.addEventListener('click', onSaveAndCloseClick);
    actionsContainer.insertBefore(saveAndCloseActionButton, recordDetailsCloseButton || null);
  }
  saveAndCloseActionButton.style.display = '';

  if (!discardActionButton) {
    discardActionButton = document.createElement('button');
    discardActionButton.type = 'button';
    discardActionButton.className = 'btn btn-discard';
    discardActionButton.textContent = uiTexts.discard || 'Discard';
    discardActionButton.disabled = true;
    discardActionButton.addEventListener('click', onDiscardClick);
    actionsContainer.insertBefore(discardActionButton, recordDetailsCloseButton || null);
  }
  discardActionButton.style.display = '';

  bindDialogHandlers();
}

function bindDialogHandlers() {
  if (isHandlersBound) {
    return;
  }

  if (recordDetailsCloseButton) {
    recordDetailsCloseButton.addEventListener('click', onCloseClick);
  }

  if (recordDetailsContent) {
    recordDetailsContent.addEventListener('dblclick', handleFieldDblClick);
    recordDetailsContent.addEventListener('input', onFieldInput);
  }

  isHandlersBound = true;
}

export function showRecordDetailsEditDialog({
  dictionaryName = '',
  dictionaryLabel = '',
  versionLabel = '',
  dictionaryVersionKey = '',
  checkoutDictionaryLocation = '',
  row = {},
  columns = [],
  isNewRecord = false,
  onAfterSave = null
} = {}) {
  if (!ensureInitialized()) {
    return;
  }

  ensureActionButtons();

  const safeDictionary = String(dictionaryLabel || '').trim();
  const safeVersion = String(versionLabel || '').trim();
  const versionPrefix = uiTexts.recordDialogVersionPrefix || 'ver.';
  const titleSuffix = [safeDictionary, safeVersion ? `${versionPrefix} ${safeVersion}` : ''].filter(Boolean).join(' ');
  const normalizedIsNewRecord = Boolean(isNewRecord);

  currentContext = {
    dictionaryName: String(dictionaryName || '').trim(),
    dictionaryVersionKey: String(dictionaryVersionKey || '').trim(),
    checkoutDictionaryLocation: String(checkoutDictionaryLocation || '').trim(),
    columns: Array.isArray(columns) ? columns : [],
    originalRow: cloneRow(row),
    currentRow: cloneRow(row),
    isNewRecord: normalizedIsNewRecord,
    onAfterSave: typeof onAfterSave === 'function' ? onAfterSave : null
  };

  recordDetailsTitle.textContent = `${normalizedIsNewRecord ? (uiTexts.newRecordDialogTitlePrefix || 'Add record for: ') : (uiTexts.recordDialogTitlePrefix || 'Record for: ')}${titleSuffix}`;
  syncActionButtonsLabels();
  renderEditGrid();
  updateActionButtonsState();
  recordDetailsDialog.showModal();
}

function syncActionButtonsLabels() {
  if (saveActionButton) {
    saveActionButton.textContent = currentContext.isNewRecord ? (uiTexts.addRowSave || 'Add') : (uiTexts.save || 'Complete');
  }

  if (saveAndCloseActionButton) {
    saveAndCloseActionButton.textContent = currentContext.isNewRecord ? (uiTexts.addRowSaveAndClose || 'Add & Close') : (uiTexts.saveAndClose || 'Complete & Close');
  }

  if (discardActionButton) {
    discardActionButton.textContent = uiTexts.discard || 'Discard';
  }
}

function renderEditGrid() {
  recordDetailsContent.innerHTML = buildEditGrid(currentContext.currentRow, currentContext.columns);
}

function buildEditGrid(row, columns) {
  const safeRow = row && typeof row === 'object' ? row : {};
  const orderedFields = Array.isArray(columns) && columns.length > 0
    ? columns
        .map((columnDef) => {
          const technical = columnDef && typeof columnDef.DICTIONARY_COLUMN_TECHNICAL === 'string'
            ? columnDef.DICTIONARY_COLUMN_TECHNICAL
            : '';
          if (!technical) {
            return null;
          }
          return {
            technical,
            business:
              columnDef && typeof columnDef.DICTIONARY_COLUMN_BUSINESS === 'string' && columnDef.DICTIONARY_COLUMN_BUSINESS.trim().length > 0
                ? columnDef.DICTIONARY_COLUMN_BUSINESS
                : technical
          };
        })
        .filter(Boolean)
    : Object.keys(safeRow).map((key) => ({ technical: key, business: key }));

  // Separate KEY column (always last, readonly)
  const keyField = orderedFields.find((f) => f.technical === 'KEY');
  const regularFields = orderedFields.filter((f) => f.technical !== 'KEY');
  const limitedRegularFields = regularFields.slice(0, MAX_VISIBLE_FIELDS);
  const fieldsToDisplay = [...limitedRegularFields, ...(keyField ? [keyField] : [])];

  if (fieldsToDisplay.length === 0) {
    return `<div class="show-record-empty">${uiTexts.recordNoFields || 'No fields to display.'}</div>`;
  }

  const changedMap = getChangedMap();
  const fieldCards = fieldsToDisplay
    .map((field) => {
      const technical = String(field.technical || '').trim();
      const rawValue = safeRow[technical] == null ? '' : String(safeRow[technical]);
      const isKeyField = technical === 'KEY';
      const changedClass = !isKeyField && changedMap.has(technical) ? ' show-record-card-changed' : '';
      const readonlyAttr = isKeyField ? ' readonly' : '';
      return `<label class="show-record-card${changedClass}"><span class="show-record-label">${escapeHtml(field.business)}</span><textarea class="show-record-control" rows="2" data-column="${escapeHtml(technical)}" title="${escapeHtml(rawValue)}"${readonlyAttr}>${escapeHtml(rawValue)}</textarea></label>`;
    })
    .join('');

  return `<div class="show-record-grid">${fieldCards}</div>`;
}

function getChangedEntries() {
  const entries = [];
  const original = currentContext.originalRow || {};
  const current = currentContext.currentRow || {};

  Object.keys(current).forEach((key) => {
    // KEY column is never editable, skip from change tracking
    if (key === 'KEY') {
      return;
    }

    const before = normalizeComparableValue(original[key]);
    const after = normalizeComparableValue(current[key]);
    if (before !== after) {
      entries.push({
        column: key,
        from: original[key],
        to: current[key]
      });
    }
  });

  return entries;
}

function getChangedMap() {
  return new Set(getChangedEntries().map((item) => item.column));
}

function normalizeComparableValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

function onFieldInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement)) {
    return;
  }

  const technical = String(target.dataset.column || '').trim();
  if (!technical) {
    return;
  }

  // KEY column is readonly, prevent any changes
  if (technical === 'KEY') {
    target.value = currentContext.originalRow[technical] || '';
    return;
  }

  currentContext.currentRow[technical] = target.value;
  target.title = target.value;
  updateActionButtonsState();
  renderDirtyHighlight();
}

function renderDirtyHighlight() {
  const changedMap = getChangedMap();
  const cards = Array.from(recordDetailsContent.querySelectorAll('.show-record-card'));
  cards.forEach((card) => {
    const textarea = card.querySelector('textarea[data-column]');
    const technical = textarea ? String(textarea.dataset.column || '').trim() : '';
    card.classList.toggle('show-record-card-changed', Boolean(technical && changedMap.has(technical)));
  });
}

function updateActionButtonsState() {
  const hasChanges = getChangedEntries().length > 0;
  if (saveActionButton) {
    saveActionButton.disabled = !hasChanges;
  }
  if (saveAndCloseActionButton) {
    saveAndCloseActionButton.disabled = !hasChanges;
  }
  if (discardActionButton) {
    discardActionButton.disabled = !hasChanges;
  }
}

function formatChangeValue(value) {
  if (value === null || value === undefined || String(value).length === 0) {
    return uiTexts.emptyValue || '(empty)';
  }
  return String(value);
}

function buildChangesListHtml(changes) {
  return changes
    .map((change) => {
      const from = escapeHtml(formatChangeValue(change.from));
      const to = escapeHtml(formatChangeValue(change.to));
      return `<li><strong>${escapeHtml(change.column)}</strong>: ${from} -> ${to}</li>`;
    })
    .join('');
}

function openSaveConfirmation(changes) {
  const dialog = document.getElementById('saveDialog');
  const intro = document.getElementById('saveDialogIntro');
  const list = document.getElementById('saveChangesList');
  const confirmButton = document.getElementById('saveConfirmButton');
  const cancelButton = document.getElementById('saveStayButton');

  const saveIntro = currentContext.isNewRecord
    ? (uiTexts.addRowSaveDialogIntro || 'Are you sure you want to add this row?')
    : (uiTexts.saveDialogIntro || 'Are you sure you want to complete changes?');

  if (!dialog || !intro || !list || !confirmButton || !cancelButton) {
    return Promise.resolve(window.confirm(saveIntro));
  }

  intro.textContent = saveIntro;
  list.innerHTML = buildChangesListHtml(changes);

  return openConfirmDialog(dialog, confirmButton, cancelButton);
}

function openDiscardConfirmation(changes, introText) {
  const dialog = document.getElementById('discardDialog');
  const intro = document.getElementById('discardDialogIntro');
  const list = document.getElementById('discardChangesList');
  const confirmButton = document.getElementById('discardConfirmButton');
  const cancelButton = document.getElementById('discardStayButton');

  if (!dialog || !intro || !list || !confirmButton || !cancelButton) {
    return Promise.resolve(window.confirm(introText || uiTexts.discardDialogIntro || 'Are you sure you want to discard changes?'));
  }

  intro.textContent = introText || uiTexts.discardDialogIntro || 'Are you sure you want to discard changes?';
  list.innerHTML = buildChangesListHtml(changes);

  return openConfirmDialog(dialog, confirmButton, cancelButton);
}

function openConfirmDialog(dialog, confirmButton, cancelButton) {
  return new Promise((resolve) => {
    let finished = false;
    let confirmed = false;

    const finish = (result) => {
      if (finished) {
        return;
      }
      finished = true;
      cleanup();
      resolve(Boolean(result));
    };

    const onConfirm = () => {
      confirmed = true;
      dialog.close();
    };

    const onCancel = () => {
      confirmed = false;
      dialog.close();
    };

    const onClose = () => finish(confirmed);

    const cleanup = () => {
      confirmButton.removeEventListener('click', onConfirm);
      cancelButton.removeEventListener('click', onCancel);
      dialog.removeEventListener('close', onClose);
    };

    confirmButton.addEventListener('click', onConfirm);
    cancelButton.addEventListener('click', onCancel);
    dialog.addEventListener('close', onClose);
    dialog.showModal();
  });
}

async function persistCurrentRow() {
  if (currentContext.isNewRecord) {
    await postJson(`/api/dictionaries/${encodeURIComponent(currentContext.dictionaryName)}/rows/insert`, {
      dictionaryVersionKey: currentContext.dictionaryVersionKey,
      checkoutDictionaryLocation: currentContext.checkoutDictionaryLocation,
      newRow: currentContext.currentRow
    });
    return;
  }

  await postJson(`/api/dictionaries/${encodeURIComponent(currentContext.dictionaryName)}/rows/save`, {
    dictionaryVersionKey: currentContext.dictionaryVersionKey,
    checkoutDictionaryLocation: currentContext.checkoutDictionaryLocation,
    originalRow: currentContext.originalRow,
    updatedRow: currentContext.currentRow
  });
}

async function onSaveClick() {
  const changes = getChangedEntries();
  if (changes.length === 0) {
    return;
  }

  const confirmed = await openSaveConfirmation(changes);
  if (!confirmed) {
    return;
  }

  try {
    await persistCurrentRow();

    if (typeof currentContext.onAfterSave === 'function') {
      await currentContext.onAfterSave();
    }

    if (currentContext.isNewRecord) {
      recordDetailsDialog.close();
      return;
    }

    currentContext.originalRow = cloneRow(currentContext.currentRow);
    updateActionButtonsState();
    renderDirtyHighlight();
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    const details = error && error.details ? error.details : '';
    if (showErrorDetailsDialog) {
      showErrorDetailsDialog(message, details);
    } else {
      window.alert(message);
    }
  }
}

async function onSaveAndCloseClick() {
  const changes = getChangedEntries();
  if (changes.length === 0) {
    recordDetailsDialog.close();
    return;
  }

  const confirmed = await openSaveConfirmation(changes);
  if (!confirmed) {
    return;
  }

  try {
    await persistCurrentRow();

    if (typeof currentContext.onAfterSave === 'function') {
      await currentContext.onAfterSave();
    }

    recordDetailsDialog.close();
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    const details = error && error.details ? error.details : '';
    if (showErrorDetailsDialog) {
      showErrorDetailsDialog(message, details);
    } else {
      window.alert(message);
    }
  }
}

async function onDiscardClick() {
  const changes = getChangedEntries();
  if (changes.length === 0) {
    return;
  }

  const confirmed = await openDiscardConfirmation(changes, uiTexts.discardDialogIntro || 'Are you sure you want to discard changes?');
  if (!confirmed) {
    return;
  }

  currentContext.currentRow = cloneRow(currentContext.originalRow);
  renderEditGrid();
  updateActionButtonsState();
}

async function onCloseClick() {
  const changes = getChangedEntries();
  if (changes.length === 0) {
    recordDetailsDialog.close();
    return;
  }

  const confirmed = await openDiscardConfirmation(
    changes,
    uiTexts.recordCloseUnsavedPrompt || 'Unsaved changes were detected. Are you sure you want to discard these changes?'
  );
  if (!confirmed) {
    return;
  }

  currentContext.currentRow = cloneRow(currentContext.originalRow);
  renderEditGrid();
  updateActionButtonsState();
  recordDetailsDialog.close();
}

function cloneRow(row) {
  return JSON.parse(JSON.stringify(row && typeof row === 'object' ? row : {}));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function handleFieldDblClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement)) {
    return;
  }
  if (!target.classList.contains('show-record-control')) {
    return;
  }

  const isExpanded = target.classList.toggle('show-record-control-expanded');
  if (isExpanded) {
    requestAnimationFrame(() => {
      scrollFieldIntoDialogView(target);
    });
    window.setTimeout(() => {
      scrollFieldIntoDialogView(target);
    }, 140);
  }
}

function scrollFieldIntoDialogView(fieldElement) {
  if (!recordDetailsContent || !(recordDetailsContent instanceof HTMLElement)) {
    return;
  }

  const containerRect = recordDetailsContent.getBoundingClientRect();
  const fieldRect = fieldElement.getBoundingClientRect();
  const edgePadding = 14;

  if (fieldRect.bottom > containerRect.bottom - edgePadding) {
    const delta = fieldRect.bottom - containerRect.bottom + edgePadding;
    recordDetailsContent.scrollBy({ top: delta, behavior: 'smooth' });
    return;
  }

  if (fieldRect.top < containerRect.top + edgePadding) {
    const delta = fieldRect.top - containerRect.top - edgePadding;
    recordDetailsContent.scrollBy({ top: delta, behavior: 'smooth' });
  }
}
