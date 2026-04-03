export function cloneRecordRow(row) {
  return JSON.parse(JSON.stringify(row && typeof row === 'object' ? row : {}));
}

function normalizeComparableValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

export function getChangedEntriesForRows(originalRow, currentRow, keyColumnName) {
  const original = originalRow && typeof originalRow === 'object' ? originalRow : {};
  const current = currentRow && typeof currentRow === 'object' ? currentRow : {};
  const keyColumn = String(keyColumnName || 'KEY');
  const entries = [];

  Object.keys(current).forEach((columnName) => {
    if (columnName === keyColumn) {
      return;
    }

    const before = normalizeComparableValue(original[columnName]);
    const after = normalizeComparableValue(current[columnName]);
    if (before !== after) {
      entries.push({
        column: columnName,
        from: original[columnName],
        to: current[columnName]
      });
    }
  });

  return entries;
}

export function getChangedColumnsSet(changes) {
  return new Set((Array.isArray(changes) ? changes : []).map((item) => item.column));
}

function formatChangeValue(value, emptyValueLabel) {
  if (value === null || value === undefined || String(value).length === 0) {
    return String(emptyValueLabel || '(empty)');
  }

  return String(value);
}

export function buildChangesListHtml(changes, { escapeHtml, emptyValueLabel } = {}) {
  const escape = typeof escapeHtml === 'function' ? escapeHtml : (value) => String(value);

  return (Array.isArray(changes) ? changes : [])
    .map((change) => {
      const from = escape(formatChangeValue(change.from, emptyValueLabel));
      const to = escape(formatChangeValue(change.to, emptyValueLabel));
      return `<li><strong>${escape(change.column)}</strong>: ${from} -> ${to}</li>`;
    })
    .join('');
}
