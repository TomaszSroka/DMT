/**
 * MainTable.js
 *
 * Handles dictionary rows loading and rendering in the main table.
 * - Loads rows for selected dictionary + version.
 * - Supports paging and simple column sorting.
 * - Delegates "Details" action to RecordDetailsDialog.
 */

import { fetchJson } from '../services/ApiClient.js';
import { escapeHtml } from '../utils/ui-helpers.js';
import { uiTexts } from '../config/ui-texts.js';

const runtimeConfig = window.FRONTEND_RUNTIME_CONFIG || {};
const defaultsConfig = runtimeConfig.defaults || {};
const behaviorConfig = runtimeConfig.uiBehavior || {};

const PAGE_SIZE = Number.isFinite(Number(defaultsConfig.pageSize))
  ? Number(defaultsConfig.pageSize)
  : 100;
const MAX_CELL_CHARS = Number.isFinite(Number(defaultsConfig.maxCellChars))
  ? Number(defaultsConfig.maxCellChars)
  : 120;
const HIDDEN_COLUMNS = new Set(
  Array.isArray(defaultsConfig.hiddenColumns)
    ? defaultsConfig.hiddenColumns.map((c) => String(c || '').trim().toUpperCase())
    : ['DICTIONARY_VERSION_KEY']
);
const DEFAULT_SORT_DIRECTION = String(behaviorConfig.defaultSortDirection || 'ASC').toUpperCase() === 'DESC'
  ? 'DESC'
  : 'ASC';
const NO_WRAP_VALUE_MAX_LENGTH = Number.isFinite(Number(behaviorConfig.noWrapValueMaxLength))
  ? Number(behaviorConfig.noWrapValueMaxLength)
  : 15;

function formatPagesMeta(page, pages) {
  return `${uiTexts.pageLabel || 'Page'}: ${page}/${pages}`;
}

function formatRowsMeta(visibleRowsCount, allRowsCount) {
  return `${uiTexts.rowsLabel || 'Rows'}: ${visibleRowsCount}/${allRowsCount}`;
}

export function createMainTableController({ onStateChange, onDetailsRequested, onError } = {}) {
  const tableContainer = document.getElementById('tableContainer');
  const tableMeta = document.getElementById('tableMeta');
  const pageInfo = document.getElementById('pageInfo');
  const prevPageButton = document.getElementById('prevPageButton');
  const nextPageButton = document.getElementById('nextPageButton');

  const state = {
    activeDictionary: '',
    selectedDictionaryVersionKey: '',
    activeFilters: [],
    currentPage: 1,
    totalPages: 1,
    totalRows: 0,
    rows: [],
    columns: [],
    rowActionLabel: uiTexts.showRowButton || 'Show',
    hasLoadedTableData: false,
    currentSortColumn: '',
    currentSortDirection: DEFAULT_SORT_DIRECTION
  };

  function emitState() {
    if (typeof onStateChange === 'function') {
      onStateChange({
        ...state,
        activeFilters: Array.isArray(state.activeFilters) ? [...state.activeFilters] : []
      });
    }
  }

  function updatePaginationControls() {
    const hasSelection = Boolean(state.activeDictionary && state.selectedDictionaryVersionKey);
    const page = hasSelection ? state.currentPage : 0;
    const pages = hasSelection ? state.totalPages : 0;

    if (pageInfo) {
      pageInfo.textContent = formatPagesMeta(page, pages);
    }
    if (prevPageButton) {
      prevPageButton.disabled = !hasSelection || state.currentPage <= 1;
    }
    if (nextPageButton) {
      nextPageButton.disabled = !hasSelection || state.currentPage >= state.totalPages;
    }
  }

  function setLoading(message = uiTexts.loadingData) {
    if (tableContainer) {
      tableContainer.innerHTML = '';
    }
  }

  function setTablePrompt(message, isError = false) {
    state.rows = [];
    state.columns = [];
    state.totalRows = 0;
    state.totalPages = 1;
    state.currentPage = 1;
    state.hasLoadedTableData = false;

    if (tableContainer) {
      if (message) {
        const cls = isError ? 'empty-state empty-state--error' : 'empty-state';
        tableContainer.innerHTML = `<div class="${cls}">${escapeHtml(message)}</div>`;
      } else {
        tableContainer.innerHTML = '';
      }
    }
    if (tableMeta) {
      tableMeta.textContent = formatRowsMeta(0, 0);
    }

    updatePaginationControls();
    emitState();
  }

  function buildRowsUrl(requestedPage) {
    const params = new URLSearchParams({
      page: String(requestedPage),
      pageSize: String(PAGE_SIZE),
      dictionaryVersionKey: String(state.selectedDictionaryVersionKey)
    });

    if (Array.isArray(state.activeFilters) && state.activeFilters.length > 0) {
      params.set('filters', JSON.stringify(state.activeFilters));
    }

    if (state.currentSortColumn) {
      params.set('sortColumn', state.currentSortColumn);
      params.set('sortDirection', state.currentSortDirection);
    }

    return `/api/dictionaries/${encodeURIComponent(state.activeDictionary)}/rows?${params.toString()}`;
  }

  function isHiddenColumn(columnName) {
    return HIDDEN_COLUMNS.has(String(columnName || '').trim().toUpperCase());
  }

  function getColumnsFromPayload(rows, payloadColumns) {
    if (Array.isArray(payloadColumns) && payloadColumns.length > 0) {
      return payloadColumns.filter(
        (colObj) => colObj && typeof colObj.DICTIONARY_COLUMN_TECHNICAL === 'string' && !isHiddenColumn(colObj.DICTIONARY_COLUMN_TECHNICAL)
      );
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }

    return Object.keys(rows[0])
      .filter((col) => !isHiddenColumn(col))
      .map((col) => ({
        DICTIONARY_COLUMN_TECHNICAL: col,
        DICTIONARY_COLUMN_BUSINESS: col
      }));
  }

  function renderTable() {
    if (!Array.isArray(state.rows) || state.rows.length === 0) {
      if (tableContainer) {
        tableContainer.innerHTML = `<div class="empty-state">${escapeHtml(uiTexts.noRowsReturned)}</div>`;
      }
      if (tableMeta) {
        tableMeta.textContent = formatRowsMeta(0, state.totalRows);
      }
      updatePaginationControls();
      emitState();
      return;
    }

    const technicalColumns = state.columns.map((c) => c.DICTIONARY_COLUMN_TECHNICAL);
    const businessHeaders = state.columns.map((c) => c.DICTIONARY_COLUMN_BUSINESS || c.DICTIONARY_COLUMN_TECHNICAL);
    const noWrapColumns = new Set(
      technicalColumns.filter((columnName) =>
        state.rows.every((row) => {
          const text = row && row[columnName] != null ? String(row[columnName]) : '';
          return text.length <= NO_WRAP_VALUE_MAX_LENGTH;
        })
      )
    );

    const head = `<th>${escapeHtml(uiTexts.tableActionHeader || 'Action')}</th>${businessHeaders
      .map((header, idx) => {
        const sortColumn = String(technicalColumns[idx] || '').toUpperCase();
        const isActiveSort = state.currentSortColumn === sortColumn;
        const sortMark = isActiveSort ? (state.currentSortDirection === 'DESC' ? ' ▼' : ' ▲') : '';
        return `<th><button type="button" class="th-sort-btn" data-sort-column="${escapeHtml(sortColumn)}">${escapeHtml(
          header
        )}${sortMark}</button></th>`;
      })
      .join('')}`;

    const body = state.rows
      .map((row, rowIndex) => {
        const actionCell = `<td><button type="button" class="btn btn-discard show-row-btn" data-row-index="${rowIndex}">${escapeHtml(
          state.rowActionLabel || uiTexts.showRowButton || 'Show'
        )}</button></td>`;
        const cells = technicalColumns
          .map((columnName) => {
            const fullValue = row[columnName] == null ? '' : String(row[columnName]);
            const shortValue = truncateValueWithoutEllipsis(fullValue, MAX_CELL_CHARS);
            const classNames = [];
            if (noWrapColumns.has(columnName)) {
              classNames.push('col-nowrap-short');
            }

            const classAttr = classNames.length > 0 ? ` class="${classNames.join(' ')}"` : '';
            return `<td${classAttr}>${escapeHtml(shortValue)}</td>`;
          })
          .join('');
        return `<tr>${actionCell}${cells}</tr>`;
      })
      .join('');

    if (tableContainer) {
      tableContainer.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    }
    if (tableMeta) {
      tableMeta.textContent = formatRowsMeta(state.rows.length, state.totalRows);
    }

    updatePaginationControls();
    emitState();
  }

  async function loadRows(requestedPage = 1) {
    if (!state.activeDictionary || !state.selectedDictionaryVersionKey) {
      setTablePrompt(uiTexts.selectDictionaryVersionPrompt);
      return;
    }

    state.hasLoadedTableData = false;
    setLoading(uiTexts.loadingData);
    emitState();

    try {
      const payload = await fetchJson(buildRowsUrl(requestedPage));
      state.rows = Array.isArray(payload.rows) ? payload.rows : [];
      state.columns = getColumnsFromPayload(state.rows, payload.columns);
      state.currentPage = Number.isFinite(Number(payload.page)) ? Number(payload.page) : 1;
      state.totalPages = Number.isFinite(Number(payload.totalPages)) ? Number(payload.totalPages) : 1;
      state.totalRows = Number.isFinite(Number(payload.totalRows)) ? Number(payload.totalRows) : 0;
      state.hasLoadedTableData = true;
      renderTable();
    } catch (error) {
      state.rows = [];
      state.columns = [];
      state.totalRows = 0;
      state.totalPages = 1;
      state.currentPage = 1;
      state.hasLoadedTableData = false;
      setTablePrompt(error && error.message ? error.message : uiTexts.noRowsReturned, true);
      if (typeof onError === 'function') {
        onError(error);
      }
    }
  }

  function setDictionary(dictionaryId) {
    state.activeDictionary = String(dictionaryId || '').trim();
    state.selectedDictionaryVersionKey = '';
    state.activeFilters = [];
    state.rowActionLabel = uiTexts.showRowButton || 'Show';
    state.currentSortColumn = '';
    state.currentSortDirection = DEFAULT_SORT_DIRECTION;

    if (!state.activeDictionary) {
      setTablePrompt('');
      return;
    }

    setTablePrompt('');
  }

  function setDictionaryVersion(versionKey) {
    state.selectedDictionaryVersionKey = String(versionKey || '').trim();

    if (!state.selectedDictionaryVersionKey) {
      setTablePrompt('');
      return;
    }

    loadRows(1);
  }

  function normalizeFilters(filters) {
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

  function setFilters(filters) {
    state.activeFilters = normalizeFilters(filters);

    if (!state.activeDictionary || !state.selectedDictionaryVersionKey) {
      emitState();
      return;
    }

    loadRows(1);
  }

  function clearFilters() {
    state.activeFilters = [];

    if (!state.activeDictionary || !state.selectedDictionaryVersionKey) {
      emitState();
      return;
    }

    loadRows(1);
  }

  function bindEvents() {
    if (prevPageButton) {
      prevPageButton.addEventListener('click', () => {
        if (state.currentPage <= 1) {
          return;
        }
        loadRows(state.currentPage - 1);
      });
    }

    if (nextPageButton) {
      nextPageButton.addEventListener('click', () => {
        if (state.currentPage >= state.totalPages) {
          return;
        }
        loadRows(state.currentPage + 1);
      });
    }

    if (tableContainer) {
      tableContainer.addEventListener('click', (event) => {
        const detailsButton = getClosestFromEventTarget(event.target, '[data-row-index]');
        if (detailsButton) {
          const rowIndex = Number.parseInt(detailsButton.getAttribute('data-row-index') || '', 10);
          if (Number.isInteger(rowIndex) && state.rows[rowIndex]) {
            if (typeof onDetailsRequested === 'function') {
              onDetailsRequested(state.rows[rowIndex], state.columns);
            }
          }
          return;
        }

        const sortButton = getClosestFromEventTarget(event.target, '[data-sort-column]');
        if (sortButton) {
          if (!state.selectedDictionaryVersionKey || !state.activeDictionary) {
            return;
          }

          const sortColumn = String(sortButton.getAttribute('data-sort-column') || '').trim().toUpperCase();
          if (!sortColumn) {
            return;
          }

          if (state.currentSortColumn === sortColumn) {
            state.currentSortDirection = state.currentSortDirection === 'ASC' ? 'DESC' : 'ASC';
          } else {
            state.currentSortColumn = sortColumn;
            state.currentSortDirection = DEFAULT_SORT_DIRECTION;
          }

          loadRows(1);
          return;
        }

      });
    }
  }

  function getClosestFromEventTarget(target, selector) {
    if (target instanceof Element) {
      return target.closest(selector);
    }

    if (target && target.parentElement instanceof Element) {
      return target.parentElement.closest(selector);
    }

    return null;
  }

  function initialize() {
    bindEvents();
    setTablePrompt('');
  }

  function truncateValueWithoutEllipsis(value, maxLength) {
    if (value.length <= maxLength) {
      return value;
    }
    return value.slice(0, maxLength);
  }

  function getState() {
    return {
      ...state,
      activeFilters: Array.isArray(state.activeFilters) ? [...state.activeFilters] : []
    };
  }

  function setRowActionLabel(label) {
    const normalized = String(label || '').trim();
    state.rowActionLabel = normalized || uiTexts.showRowButton || 'Show';

    if (state.hasLoadedTableData) {
      renderTable();
    } else {
      emitState();
    }
  }

  return {
    initialize,
    setDictionary,
    setDictionaryVersion,
    setFilters,
    clearFilters,
    setRowActionLabel,
    getState
  };
}
