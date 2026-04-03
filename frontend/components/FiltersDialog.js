/**
 * FiltersDialog.js
 *
 * Manages filter rules UI and synchronizes active filters with MainTable controller.
 */

import { uiTexts } from '../config/ui-texts.js';
import { escapeHtml } from '../utils/ui-helpers.js';
import { getRuntimeConfig } from '../config/runtime-config.js';
import {
  areFilterRowsEqual,
  formatFiltersSummary,
  getFiltersDraftSummaryLines as getDraftSummaryLines,
  sanitizeFilterRows
} from './FiltersDialog.helpers.js';

const runtimeConfig = getRuntimeConfig();
const behaviorConfig = runtimeConfig.uiBehavior || {};

const FILTERS_SUMMARY_TEMPLATE = String(behaviorConfig.filtersSummaryTemplate || '{column} IN "{value}"');
const FILTERS_SUMMARY_JOINER = String(behaviorConfig.filtersSummaryJoiner || ' AND ');
const FILTER_DRAFT_ROW_TEMPLATE = String(
  behaviorConfig.filterDraftRowTemplate || 'Filter rule: Column - Value: {column} - {value}'
);

export function createFiltersDialogController({ tableController } = {}) {
  const openFiltersButton = document.getElementById('openFiltersButton');
  const activeFiltersInfo = document.getElementById('activeFiltersInfo');
  const filtersDialog = document.getElementById('filtersDialog');
  const filtersRulesList = document.getElementById('filtersRulesList');
  const filtersAddRuleButton = document.getElementById('filtersAddRuleButton');
  const filtersApplyButton = document.getElementById('filtersApplyButton');
  const filtersApplyCloseButton = document.getElementById('filtersApplyCloseButton');
  const filtersClearButton = document.getElementById('filtersClearButton');
  const filtersCloseButton = document.getElementById('filtersCloseButton');
  const discardDialog = document.getElementById('discardDialog');
  const discardDialogTitle = document.getElementById('discardDialogTitle');
  const discardDialogIntro = document.getElementById('discardDialogIntro');
  const discardChangesList = document.getElementById('discardChangesList');
  const discardStayButton = document.getElementById('discardStayButton');
  const discardConfirmButton = document.getElementById('discardConfirmButton');

  let filtersDraft = [];
  let latestTableState = {
    columns: [],
    hasLoadedTableData: false,
    activeFilters: []
  };

  function setSummary(text) {
    if (activeFiltersInfo) {
      activeFiltersInfo.textContent = text;
    }
  }

  function updateSummaryFromState() {
    setSummary(
      formatFiltersSummary(
        latestTableState.activeFilters,
        latestTableState.columns,
        FILTERS_SUMMARY_TEMPLATE,
        FILTERS_SUMMARY_JOINER,
        uiTexts.filtersSummaryNone
      )
    );
  }

  function createEmptyFilterRule() {
    return { column: '', value: '' };
  }

  function getNextFilterColumn(previousColumn = '') {
    const columns = Array.isArray(latestTableState.columns) ? latestTableState.columns : [];
    if (columns.length === 0) {
      return '';
    }

    const technicalColumns = columns
      .map((item) =>
        item && typeof item.DICTIONARY_COLUMN_TECHNICAL === 'string' ? item.DICTIONARY_COLUMN_TECHNICAL : ''
      )
      .filter((item) => item.length > 0);

    if (technicalColumns.length === 0) {
      return '';
    }

    const normalizedPrevious = String(previousColumn || '').trim();
    if (!normalizedPrevious) {
      return technicalColumns[0];
    }

    const index = technicalColumns.findIndex((column) => column === normalizedPrevious);
    if (index < 0) {
      return technicalColumns[0];
    }

    return technicalColumns[(index + 1) % technicalColumns.length];
  }

  function renderFiltersDraft() {
    if (!filtersRulesList) {
      return;
    }

    const columns = Array.isArray(latestTableState.columns) ? latestTableState.columns : [];
    if (columns.length === 0) {
      filtersRulesList.innerHTML = `<div class="empty-state">${escapeHtml(uiTexts.filtersNoColumns)}</div>`;
      return;
    }

    if (!Array.isArray(filtersDraft) || filtersDraft.length === 0) {
      filtersRulesList.innerHTML = `<div class="empty-state">${escapeHtml(uiTexts.filtersEmpty)}</div>`;
      return;
    }

    const baseColumns = columns.map((columnDef) => ({
      technical: String(columnDef.DICTIONARY_COLUMN_TECHNICAL || ''),
      business:
        typeof columnDef.DICTIONARY_COLUMN_BUSINESS === 'string' && columnDef.DICTIONARY_COLUMN_BUSINESS.trim().length > 0
          ? columnDef.DICTIONARY_COLUMN_BUSINESS
          : String(columnDef.DICTIONARY_COLUMN_TECHNICAL || '')
    }));

    const header = `<div class="filters-rule-header">
      <span>${escapeHtml(uiTexts.filtersColumnLabel)}</span>
      <span>${escapeHtml(uiTexts.filtersValueLabel)}</span>
      <span></span>
    </div>`;

    const rows = filtersDraft
      .map((rule, index) => {
        const column = String(rule && rule.column != null ? rule.column : '');
        const value = String(rule && rule.value != null ? rule.value : '');
        const rowColumns = [...baseColumns];

        if (column && !rowColumns.some((item) => item.technical === column)) {
          rowColumns.unshift({ technical: column, business: column });
        }

        const options = rowColumns
          .map((item) => {
            const selectedAttr = item.technical === column ? ' selected' : '';
            return `<option value="${escapeHtml(item.technical)}"${selectedAttr}>${escapeHtml(item.business)}</option>`;
          })
          .join('');

        return `<div class="filters-rule-row" data-filter-index="${index}">
          <select data-filter-field="column">${options}</select>
          <input data-filter-field="value" value="${escapeHtml(value)}" placeholder="${escapeHtml(uiTexts.filtersValuePlaceholder)}" />
          <button type="button" class="btn btn-discard" data-filter-remove="${index}">${escapeHtml(uiTexts.filtersRemoveRule)}</button>
        </div>`;
      })
      .join('');

    filtersRulesList.innerHTML = `${header}${rows}`;
  }

  function collectFiltersFromDraft() {
    if (!filtersRulesList) {
      return [];
    }

    const rows = Array.from(filtersRulesList.querySelectorAll('.filters-rule-row'));
    return rows
      .map((row) => {
        const columnInput = row.querySelector('[data-filter-field="column"]');
        const valueInput = row.querySelector('[data-filter-field="value"]');
        return {
          column: columnInput ? String(columnInput.value || '').trim() : '',
          value: valueInput ? String(valueInput.value || '').trim() : ''
        };
      })
      .filter((item) => item.column.length > 0 && item.value.length > 0);
  }

  function collectFiltersDraftRaw() {
    if (!filtersRulesList) {
      return [];
    }

    const rows = Array.from(filtersRulesList.querySelectorAll('.filters-rule-row'));
    return rows.map((row) => {
      const columnInput = row.querySelector('[data-filter-field="column"]');
      const valueInput = row.querySelector('[data-filter-field="value"]');
      return {
        column: columnInput ? String(columnInput.value || '') : '',
        value: valueInput ? String(valueInput.value || '') : ''
      };
    });
  }

  function syncFiltersDraftFromUi() {
    if (!filtersDialog || !filtersDialog.open || !filtersRulesList) {
      return;
    }

    const rows = Array.from(filtersRulesList.querySelectorAll('.filters-rule-row'));
    filtersDraft = rows.map((row) => {
      const columnInput = row.querySelector('[data-filter-field="column"]');
      const valueInput = row.querySelector('[data-filter-field="value"]');
      return {
        column: columnInput ? String(columnInput.value || '') : '',
        value: valueInput ? String(valueInput.value || '') : ''
      };
    });
  }

  function isFiltersDraftDirty() {
    return !areFilterRowsEqual(latestTableState.activeFilters, collectFiltersDraftRaw());
  }

  function setApplyButtonsEnabled(enabled) {
    const shouldEnable = Boolean(enabled);
    if (filtersApplyButton) {
      filtersApplyButton.disabled = !shouldEnable;
    }
    if (filtersApplyCloseButton) {
      filtersApplyCloseButton.disabled = !shouldEnable;
    }
  }

  function updateApplyButtonsState() {
    const isDialogOpen = Boolean(filtersDialog && filtersDialog.open);
    if (!isDialogOpen) {
      setApplyButtonsEnabled(false);
      return;
    }

    setApplyButtonsEnabled(isFiltersDraftDirty());
  }

  function buildFiltersDraftSummaryLines() {
    return getDraftSummaryLines(
      collectFiltersDraftRaw(),
      FILTER_DRAFT_ROW_TEMPLATE,
      uiTexts.emptyValue
    );
  }

  async function askDiscardFiltersWithChanges(summaryLines) {
    if (
      !discardDialog ||
      !discardDialogTitle ||
      !discardDialogIntro ||
      !discardChangesList ||
      !discardStayButton ||
      !discardConfirmButton
    ) {
      return true;
    }

    const previousTitle = discardDialogTitle.textContent;
    const previousIntro = discardDialogIntro.textContent;
    const previousStay = discardStayButton.textContent;
    const previousConfirm = discardConfirmButton.textContent;
    const previousListHidden = discardChangesList.hidden;

    discardDialogTitle.textContent = uiTexts.filtersDiscardDialogTitle;
    discardDialogIntro.textContent = uiTexts.filtersDiscardDialogIntro;
    discardStayButton.textContent = uiTexts.filtersDiscardDialogKeepEditing;
    discardConfirmButton.textContent = uiTexts.filtersDiscardDialogConfirm;
    discardChangesList.innerHTML = summaryLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
    discardChangesList.hidden = false;

    const shouldDiscard = await new Promise((resolve) => {
      const onStay = () => {
        cleanup();
        discardDialog.close();
        resolve(false);
      };

      const onConfirm = () => {
        cleanup();
        discardDialog.close();
        resolve(true);
      };

      const onCancel = (event) => {
        event.preventDefault();
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        discardStayButton.removeEventListener('click', onStay);
        discardConfirmButton.removeEventListener('click', onConfirm);
        discardDialog.removeEventListener('cancel', onCancel);
      };

      discardStayButton.addEventListener('click', onStay);
      discardConfirmButton.addEventListener('click', onConfirm);
      discardDialog.addEventListener('cancel', onCancel);
      discardDialog.showModal();
    });

    discardDialogTitle.textContent = previousTitle;
    discardDialogIntro.textContent = previousIntro;
    discardStayButton.textContent = previousStay;
    discardConfirmButton.textContent = previousConfirm;
    discardChangesList.hidden = previousListHidden;
    return shouldDiscard;
  }

  async function closeFiltersDialog() {
    if (!filtersDialog) {
      return;
    }

    if (!isFiltersDraftDirty()) {
      filtersDialog.close();
      return;
    }

    const shouldDiscard = await askDiscardFiltersWithChanges(buildFiltersDraftSummaryLines());
    if (shouldDiscard) {
      filtersDialog.close();
    }
  }

  function openDialog() {
    if (!filtersDialog) {
      return;
    }

    filtersDraft = Array.isArray(latestTableState.activeFilters)
      ? latestTableState.activeFilters.map((item) => ({
          column: String(item && item.column != null ? item.column : ''),
          value: String(item && item.value != null ? item.value : '')
        }))
      : [];

    renderFiltersDraft();
    updateApplyButtonsState();
    filtersDialog.showModal();
  }

  function applyFilters(closeAfterApply) {
    const filters = collectFiltersFromDraft();
    if (tableController && typeof tableController.setFilters === 'function') {
      tableController.setFilters(filters);
    }

    latestTableState.activeFilters = filters;
    updateApplyButtonsState();

    if (closeAfterApply && filtersDialog) {
      filtersDialog.close();
    }
  }

  function clearFilters() {
    filtersDraft = [];
    renderFiltersDraft();
    updateApplyButtonsState();
  }

  function bindEvents() {
    if (openFiltersButton) {
      openFiltersButton.addEventListener('click', openDialog);
    }

    if (filtersAddRuleButton) {
      filtersAddRuleButton.addEventListener('click', () => {
        syncFiltersDraftFromUi();
        const lastRule = Array.isArray(filtersDraft) && filtersDraft.length > 0 ? filtersDraft[filtersDraft.length - 1] : null;
        const nextColumn = getNextFilterColumn(lastRule && lastRule.column);
        filtersDraft.push(nextColumn ? { column: nextColumn, value: '' } : createEmptyFilterRule());
        renderFiltersDraft();
        updateApplyButtonsState();
      });
    }

    if (filtersRulesList) {
      filtersRulesList.addEventListener('click', (event) => {
        const removeButton = event.target instanceof Element ? event.target.closest('[data-filter-remove]') : null;
        if (!removeButton) {
          return;
        }

        syncFiltersDraftFromUi();

        const index = Number.parseInt(removeButton.getAttribute('data-filter-remove') || '', 10);
        if (!Number.isInteger(index) || index < 0 || index >= filtersDraft.length) {
          return;
        }

        filtersDraft.splice(index, 1);
        renderFiltersDraft();
        updateApplyButtonsState();
      });

      const onDraftChanged = () => {
        syncFiltersDraftFromUi();
        updateApplyButtonsState();
      };

      filtersRulesList.addEventListener('input', onDraftChanged);
      filtersRulesList.addEventListener('change', onDraftChanged);
    }

    if (filtersApplyButton) {
      filtersApplyButton.addEventListener('click', () => applyFilters(false));
    }

    if (filtersApplyCloseButton) {
      filtersApplyCloseButton.addEventListener('click', () => applyFilters(true));
    }

    if (filtersClearButton) {
      filtersClearButton.addEventListener('click', clearFilters);
    }

    if (filtersCloseButton && filtersDialog) {
      filtersCloseButton.addEventListener('click', () => {
        closeFiltersDialog();
      });
    }

    if (filtersDialog) {
      filtersDialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        closeFiltersDialog();
      });

      filtersDialog.addEventListener('close', () => {
        setApplyButtonsEnabled(false);
      });
    }
  }

  function updateFromTableState(state) {
    latestTableState = {
      columns: Array.isArray(state && state.columns) ? state.columns : [],
      hasLoadedTableData: Boolean(state && state.hasLoadedTableData),
      activeFilters: Array.isArray(state && state.activeFilters) ? state.activeFilters : []
    };

    if (openFiltersButton) {
      openFiltersButton.disabled = !latestTableState.hasLoadedTableData;
    }

    updateSummaryFromState();
    updateApplyButtonsState();
  }

  function initialize() {
    bindEvents();
    updateSummaryFromState();
    if (openFiltersButton) {
      openFiltersButton.disabled = true;
    }
    setApplyButtonsEnabled(false);
  }

  return {
    initialize,
    updateFromTableState
  };
}
