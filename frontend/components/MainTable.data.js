export function formatPagesMeta(uiTexts, page, pages) {
  return `${uiTexts.pageLabel || 'Page'}: ${page}/${pages}`;
}

export function formatRowsMeta(uiTexts, visibleRowsCount, allRowsCount) {
  return `${uiTexts.rowsLabel || 'Rows'}: ${visibleRowsCount}/${allRowsCount}`;
}

export function createHiddenColumnsSet(hiddenColumnsConfig) {
  return new Set(
    Array.isArray(hiddenColumnsConfig)
      ? hiddenColumnsConfig.map((column) => String(column || '').trim().toUpperCase())
      : ['DICTIONARY_VERSION_KEY']
  );
}

function isHiddenColumn(columnName, hiddenColumns) {
  return hiddenColumns.has(String(columnName || '').trim().toUpperCase());
}

export function getColumnsFromPayload(rows, payloadColumns, hiddenColumns) {
  if (Array.isArray(payloadColumns) && payloadColumns.length > 0) {
    return payloadColumns.filter(
      (columnDef) =>
        columnDef
        && typeof columnDef.DICTIONARY_COLUMN_TECHNICAL === 'string'
        && !isHiddenColumn(columnDef.DICTIONARY_COLUMN_TECHNICAL, hiddenColumns)
    );
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  return Object.keys(rows[0])
    .filter((columnName) => !isHiddenColumn(columnName, hiddenColumns))
    .map((columnName) => ({
      DICTIONARY_COLUMN_TECHNICAL: columnName,
      DICTIONARY_COLUMN_BUSINESS: columnName
    }));
}

export function normalizeFilters(filters) {
  if (!Array.isArray(filters)) {
    return [];
  }

  return filters
    .map((item) => ({
      column: String(item && item.column != null ? item.column : '').trim(),
      value: String(item && item.value != null ? item.value : '').trim()
    }))
    .filter((item) => item.column.length > 0 && item.value.length > 0);
}

export function buildRowsUrl({
  activeDictionary,
  selectedDictionaryVersionKey,
  checkoutDictionaryLocation,
  activeFilters,
  currentSortColumn,
  currentSortDirection,
  pageSize,
  requestedPage
}) {
  const params = new URLSearchParams({
    page: String(requestedPage),
    pageSize: String(pageSize),
    dictionaryVersionKey: String(selectedDictionaryVersionKey)
  });

  if (checkoutDictionaryLocation) {
    params.set('checkoutDictionaryLocation', checkoutDictionaryLocation);
  }

  if (Array.isArray(activeFilters) && activeFilters.length > 0) {
    params.set('filters', JSON.stringify(activeFilters));
  }

  if (currentSortColumn) {
    params.set('sortColumn', currentSortColumn);
    params.set('sortDirection', currentSortDirection);
  }

  return `/api/dictionaries/${encodeURIComponent(activeDictionary)}/rows?${params.toString()}`;
}
