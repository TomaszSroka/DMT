import { fillTemplate } from '../utils/ui-helpers.js';

function normalizeRow(item) {
  return {
    column: String(item && item.column != null ? item.column : '').trim(),
    value: String(item && item.value != null ? item.value : '').trim()
  };
}

export function sanitizeFilterRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map(normalizeRow)
    .filter((item) => item.column.length > 0 && item.value.length > 0);
}

export function normalizeFilterRowsForComparison(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map(normalizeRow)
    .filter((item) => item.column.length > 0 || item.value.length > 0);
}

export function areFilterRowsEqual(leftRows, rightRows) {
  return JSON.stringify(normalizeFilterRowsForComparison(leftRows))
    === JSON.stringify(normalizeFilterRowsForComparison(rightRows));
}

export function getBusinessMap(columns) {
  const map = {};
  if (!Array.isArray(columns)) {
    return map;
  }

  columns.forEach((columnDef) => {
    const technical =
      columnDef && typeof columnDef.DICTIONARY_COLUMN_TECHNICAL === 'string'
        ? columnDef.DICTIONARY_COLUMN_TECHNICAL
        : '';
    if (!technical) {
      return;
    }
    const business =
      columnDef && typeof columnDef.DICTIONARY_COLUMN_BUSINESS === 'string' && columnDef.DICTIONARY_COLUMN_BUSINESS.trim().length > 0
        ? columnDef.DICTIONARY_COLUMN_BUSINESS
        : technical;
    map[technical] = business;
  });

  return map;
}

export function formatFiltersSummary(activeFilters, columns, summaryTemplate, summaryJoiner, emptySummary) {
  const normalized = sanitizeFilterRows(activeFilters);
  if (normalized.length === 0) {
    return emptySummary;
  }

  const businessMap = getBusinessMap(columns);
  const parts = normalized.map((item) => {
    const businessLabel = businessMap[item.column] || item.column;
    return fillTemplate(summaryTemplate, {
      column: businessLabel,
      value: item.value
    });
  });

  const normalizedJoinerCore = String(summaryJoiner || '').trim() || 'AND';
  return parts.join(` ${normalizedJoinerCore} `);
}

export function getFiltersDraftSummaryLines(rawRows, rowTemplate, emptyValueLabel) {
  const rows = normalizeFilterRowsForComparison(rawRows);
  if (rows.length === 0) {
    return [fillTemplate(rowTemplate, { column: emptyValueLabel, value: emptyValueLabel })];
  }

  return rows.map((item) =>
    fillTemplate(rowTemplate, {
      column: item.column.length > 0 ? item.column : emptyValueLabel,
      value: item.value.length > 0 ? item.value : emptyValueLabel
    })
  );
}
