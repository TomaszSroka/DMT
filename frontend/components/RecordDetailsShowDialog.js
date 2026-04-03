/**
 * RecordDetailsShowDialog.js
 *
 * Dedicated read-mode dialog opened from the Show action in MainTable.
 */

import { uiTexts } from '../config/ui-texts.js';
import { escapeHtml } from '../utils/ui-helpers.js';
import { getOrderedRecordFields, getVisibleRecordFields } from './RecordDetailsDialog.fields.js';

let recordDetailsDialog;
let recordDetailsTitle;
let recordDetailsCloseButton;
let recordDetailsContent;
let isHandlersBound = false;
const MAX_VISIBLE_FIELDS = 20;

export function setupRecordDetailsShowDialog() {
  recordDetailsDialog = document.getElementById('showRecordDialog');
  recordDetailsTitle = document.getElementById('showRecordTitle');
  recordDetailsCloseButton = document.getElementById('showRecordCloseButton');
  recordDetailsContent = document.getElementById('showRecordContent');
  bindHandlers();
}

export function showRecordDetailsShowDialog({ dictionaryLabel = '', versionLabel = '', row = {}, columns = [] } = {}) {
  if (!recordDetailsDialog || !recordDetailsTitle || !recordDetailsContent) {
    return;
  }

  const safeDictionary = String(dictionaryLabel || '').trim();
  const safeVersion = String(versionLabel || '').trim();
  const versionPrefix = uiTexts.recordDialogVersionPrefix || 'ver.';
  const titleSuffix = [safeDictionary, safeVersion ? `${versionPrefix} ${safeVersion}` : ''].filter(Boolean).join(' ');

  recordDetailsTitle.textContent = `${uiTexts.recordDialogTitlePrefix || 'Record for: '}${titleSuffix}`;
  recordDetailsContent.innerHTML = buildReadGrid(row, columns);
  recordDetailsDialog.showModal();
}

function bindHandlers() {
  if (isHandlersBound) {
    return;
  }

  if (recordDetailsCloseButton && recordDetailsDialog) {
    recordDetailsCloseButton.addEventListener('click', () => {
      recordDetailsDialog.close();
    });
  }

  if (recordDetailsContent) {
    recordDetailsContent.addEventListener('dblclick', handleFieldDblClick);
  }

  isHandlersBound = true;
}

function buildReadGrid(row, columns) {
  const safeRow = row && typeof row === 'object' ? row : {};
  const orderedFields = getOrderedRecordFields(safeRow, columns);
  const fieldsToDisplay = getVisibleRecordFields(orderedFields, MAX_VISIBLE_FIELDS);

  if (fieldsToDisplay.length === 0) {
    return `<div class="show-record-empty">${uiTexts.recordNoFields || 'No fields to display.'}</div>`;
  }

  const fieldCards = fieldsToDisplay
    .map((field) => {
      const rawValue = safeRow[field.technical] == null ? '' : String(safeRow[field.technical]);
      return `<label class="show-record-card"><span class="show-record-label">${escapeHtml(field.business)}</span><textarea class="show-record-control" rows="2" readonly title="${escapeHtml(rawValue)}">${escapeHtml(rawValue)}</textarea></label>`;
    })
    .join('');

  return `<div class="show-record-grid">${fieldCards}</div>`;
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
    // Run once more after the expand transition starts so final position is corrected.
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
