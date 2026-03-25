/**
 * RecordDetailsDialog.js
 *
 * Dedicated read-mode dialog opened from the Show action in MainTable.
 */

let recordDetailsDialog;
let recordDetailsTitle;
let recordDetailsCloseButton;
let recordDetailsContent;
const MAX_VISIBLE_FIELDS = 20;
const ELLIPSIS_HINT_MIN_LENGTH = 24;

export function setupRecordDetailsDialog() {
  recordDetailsDialog = document.getElementById('showRecordDialog');
  recordDetailsTitle = document.getElementById('showRecordTitle');
  recordDetailsCloseButton = document.getElementById('showRecordCloseButton');
  recordDetailsContent = document.getElementById('showRecordContent');

  if (recordDetailsCloseButton && recordDetailsDialog) {
    recordDetailsCloseButton.addEventListener('click', () => recordDetailsDialog.close());
  }
}

export function showRecordDetailsDialog({ dictionaryLabel = '', versionLabel = '', row = {}, columns = [] } = {}) {
  if (!recordDetailsDialog || !recordDetailsTitle || !recordDetailsContent) {
    return;
  }

  const safeDictionary = String(dictionaryLabel || '').trim();
  const safeVersion = String(versionLabel || '').trim();
  const titleSuffix = [safeDictionary, safeVersion ? `ver. ${safeVersion}` : ''].filter(Boolean).join(' ');

  recordDetailsTitle.textContent = `Show Record for: ${titleSuffix}`;
  recordDetailsContent.innerHTML = buildReadGrid(row, columns);
  recordDetailsDialog.showModal();
}

function buildReadGrid(row, columns) {
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

  const limitedFields = orderedFields.slice(0, MAX_VISIBLE_FIELDS);
  if (limitedFields.length === 0) {
    return '<div class="show-record-empty">No fields to display.</div>';
  }

  const fieldCards = limitedFields
    .map((field) => {
      const rawValue = safeRow[field.technical] == null ? '' : String(safeRow[field.technical]);
      const controlType = rawValue.length > 100 || rawValue.includes('\n') ? 'textarea' : 'input';
      if (controlType === 'textarea') {
        return `<label class="show-record-card"><span class="show-record-label">${escapeHtml(field.business)}</span><textarea class="show-record-control" readonly disabled title="${escapeHtml(rawValue)}">${escapeHtml(rawValue)}</textarea></label>`;
      }
      const showEllipsisBadge = rawValue.length > ELLIPSIS_HINT_MIN_LENGTH;
      const ellipsisBadge = showEllipsisBadge
        ? '<span class="show-record-ellipsis-badge" aria-hidden="true">...</span>'
        : '';
      return `<label class="show-record-card"><span class="show-record-label">${escapeHtml(field.business)}</span><span class="show-record-control-wrap"><input class="show-record-control show-record-control-ellipsis" type="text" value="${escapeHtml(rawValue)}" readonly disabled title="${escapeHtml(rawValue)}" />${ellipsisBadge}</span></label>`;
    })
    .join('');

  return `<div class="show-record-grid">${fieldCards}</div>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
