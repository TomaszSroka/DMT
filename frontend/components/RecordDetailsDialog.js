/**
 * RecordDetailsDialog.js
 *
 * Dedicated read-mode dialog opened from the Show action in MainTable.
 */

let recordDetailsDialog;
let recordDetailsTitle;
let recordDetailsCloseButton;
let recordDetailsContent;
let isDblClickHandlerBound = false;
const MAX_VISIBLE_FIELDS = 20;

export function setupRecordDetailsDialog() {
  recordDetailsDialog = document.getElementById('showRecordDialog');
  recordDetailsTitle = document.getElementById('showRecordTitle');
  recordDetailsCloseButton = document.getElementById('showRecordCloseButton');
  recordDetailsContent = document.getElementById('showRecordContent');

  if (recordDetailsCloseButton && recordDetailsDialog) {
    recordDetailsCloseButton.addEventListener('click', () => recordDetailsDialog.close());
  }

  if (recordDetailsContent && !isDblClickHandlerBound) {
    recordDetailsContent.addEventListener('dblclick', handleFieldDblClick);
    isDblClickHandlerBound = true;
  }
}

export function showRecordDetailsDialog({ dictionaryLabel = '', versionLabel = '', row = {}, columns = [] } = {}) {
  if (!recordDetailsDialog || !recordDetailsTitle || !recordDetailsContent) {
    return;
  }

  const safeDictionary = String(dictionaryLabel || '').trim();
  const safeVersion = String(versionLabel || '').trim();
  const titleSuffix = [safeDictionary, safeVersion ? `ver. ${safeVersion}` : ''].filter(Boolean).join(' ');

  recordDetailsTitle.textContent = `Record for: ${titleSuffix}`;
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
      return `<label class="show-record-card"><span class="show-record-label">${escapeHtml(field.business)}</span><textarea class="show-record-control" rows="2" readonly title="${escapeHtml(rawValue)}">${escapeHtml(rawValue)}</textarea></label>`;
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
