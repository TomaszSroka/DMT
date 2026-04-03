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
import { beginDbLoading } from '../utils/db-loading.js';
import { buildInlineCreateRowHtml, buildTableHead, buildTableBody } from './MainTable.render.js';
import { getRuntimeConfig } from '../config/runtime-config.js';
import {
  buildRowsUrl,
  createHiddenColumnsSet,
  formatPagesMeta,
  formatRowsMeta,
  getColumnsFromPayload,
  normalizeFilters
} from './MainTable.data.js';
import { bindMainTableEvents } from './MainTable.events.js';

const runtimeConfig = getRuntimeConfig();
const defaultsConfig = runtimeConfig.defaults || {};
const behaviorConfig = runtimeConfig.uiBehavior || {};

const PAGE_SIZE = Number.isFinite(Number(defaultsConfig.pageSize))
  ? Number(defaultsConfig.pageSize)
  : 100;
const MAX_CELL_CHARS = Number.isFinite(Number(defaultsConfig.maxCellChars))
  ? Number(defaultsConfig.maxCellChars)
  : 120;
const HIDDEN_COLUMNS = createHiddenColumnsSet(defaultsConfig.hiddenColumns);
const DEFAULT_SORT_DIRECTION = String(behaviorConfig.defaultSortDirection || 'ASC').toUpperCase() === 'DESC'
  ? 'DESC'
  : 'ASC';
const NO_WRAP_VALUE_MAX_LENGTH = Number.isFinite(Number(behaviorConfig.noWrapValueMaxLength))
  ? Number(behaviorConfig.noWrapValueMaxLength)
  : 15;

export function createMainTableController({ onStateChange, onDetailsRequested, onAddRequested, onError, apiClient } = {}) {
  const resolvedApiClient = apiClient && typeof apiClient.fetchJson === 'function' ? apiClient : { fetchJson };
  const tableContainer = document.getElementById('tableContainer');
  const tableMeta = document.getElementById('tableMeta');
  const pageInfo = document.getElementById('pageInfo');
  const prevPageButton = document.getElementById('prevPageButton');
  const nextPageButton = document.getElementById('nextPageButton');

  const state = {
    activeDictionary: '',
    selectedDictionaryVersionKey: '',
    checkoutDictionaryLocation: '',
    activeFilters: [],
    currentPage: 1,
    totalPages: 1,
    totalRows: 0,
    rows: [],
    columns: [],
    rowActionLabel: uiTexts.showRowButton || 'Show',
    hasLoadedTableData: false,
    currentSortColumn: '',
    currentSortDirection: DEFAULT_SORT_DIRECTION,
    inlineCreateEnabled: false
  };

  function hasInlineCreateRow() {
    return state.inlineCreateEnabled && Array.isArray(state.columns) && state.columns.length > 0;
  }

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
      pageInfo.textContent = formatPagesMeta(uiTexts, page, pages);
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
      tableMeta.textContent = formatRowsMeta(uiTexts, 0, 0);
    }

    updatePaginationControls();
    emitState();
  }

  function renderTable() {
    if ((!Array.isArray(state.rows) || state.rows.length === 0) && !hasInlineCreateRow()) {
      if (tableContainer) {
        tableContainer.innerHTML = `<div class="empty-state">${escapeHtml(uiTexts.noRowsReturned)}</div>`;
      }
      if (tableMeta) {
        tableMeta.textContent = formatRowsMeta(uiTexts, 0, state.totalRows);
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

    const head = buildTableHead({
      technicalColumns,
      businessHeaders,
      currentSortColumn: state.currentSortColumn,
      currentSortDirection: state.currentSortDirection,
      uiTexts,
      escapeHtml
    });

    const inlineCreateRowHtml = hasInlineCreateRow()
      ? buildInlineCreateRowHtml(technicalColumns, uiTexts, escapeHtml)
      : '';

    const body = buildTableBody({
      rows: state.rows,
      technicalColumns,
      noWrapColumns,
      rowActionLabel: state.rowActionLabel,
      uiTexts,
      escapeHtml,
      inlineCreateRowHtml,
      truncateValueWithoutEllipsis,
      maxCellChars: MAX_CELL_CHARS
    });

    if (tableContainer) {
      tableContainer.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    }
    if (tableMeta) {
      tableMeta.textContent = formatRowsMeta(uiTexts, state.rows.length, state.totalRows);
    }

    updatePaginationControls();
    emitState();
  }

  async function loadRows(requestedPage = 1) {
    if (!state.activeDictionary || !state.selectedDictionaryVersionKey) {
      setTablePrompt(uiTexts.selectDictionaryVersionPrompt);
      return;
    }

    const globalLoadingInfo = document.getElementById('globalLoadingInfo');
    const endDbLoading = beginDbLoading(globalLoadingInfo);
    state.hasLoadedTableData = false;
    setLoading(uiTexts.loadingData);
    emitState();

    try {
      const payload = await resolvedApiClient.fetchJson(
        buildRowsUrl({
          activeDictionary: state.activeDictionary,
          selectedDictionaryVersionKey: state.selectedDictionaryVersionKey,
          checkoutDictionaryLocation: state.checkoutDictionaryLocation,
          activeFilters: state.activeFilters,
          currentSortColumn: state.currentSortColumn,
          currentSortDirection: state.currentSortDirection,
          pageSize: PAGE_SIZE,
          requestedPage
        })
      );
      state.rows = Array.isArray(payload.rows) ? payload.rows : [];
      state.columns = getColumnsFromPayload(state.rows, payload.columns, HIDDEN_COLUMNS);
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
    } finally {
      endDbLoading();
    }
  }

  function setDictionary(dictionaryId) {
    state.activeDictionary = String(dictionaryId || '').trim();
    state.selectedDictionaryVersionKey = '';
    state.checkoutDictionaryLocation = '';
    state.activeFilters = [];
    state.rowActionLabel = uiTexts.showRowButton || 'Show';
    state.currentSortColumn = '';
    state.currentSortDirection = DEFAULT_SORT_DIRECTION;
    state.inlineCreateEnabled = false;

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

  function setCheckoutDictionaryLocation(location) {
    const normalizedLocation = String(location || '').trim();
    if (state.checkoutDictionaryLocation === normalizedLocation) {
      return Promise.resolve();
    }

    state.checkoutDictionaryLocation = normalizedLocation;

    if (!state.activeDictionary || !state.selectedDictionaryVersionKey) {
      emitState();
      return Promise.resolve();
    }

    return loadRows(1);
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
    bindMainTableEvents({
      prevPageButton,
      nextPageButton,
      tableContainer,
      state,
      loadRows,
      onAddRequested,
      onDetailsRequested,
      defaultSortDirection: DEFAULT_SORT_DIRECTION
    });
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

  function setInlineCreateRowEnabled(enabled) {
    const nextEnabled = Boolean(enabled);
    state.inlineCreateEnabled = nextEnabled;

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
    setCheckoutDictionaryLocation,
    setRowActionLabel,
    setInlineCreateRowEnabled,
    getState
  };
}
