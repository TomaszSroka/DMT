const FRONTEND_RUNTIME_CONFIG = window.FRONTEND_RUNTIME_CONFIG || {};
const UI_TEXT = FRONTEND_RUNTIME_CONFIG.text || {};
const UI_DEFAULTS = FRONTEND_RUNTIME_CONFIG.defaults || {};
const UI_TYPOGRAPHY = FRONTEND_RUNTIME_CONFIG.typography || {};
const UI_BEHAVIOR = FRONTEND_RUNTIME_CONFIG.uiBehavior || {};
const SHARED_UI = (window.DMT && window.DMT.sharedUi) || {};
const API_CLIENT = (window.DMT && window.DMT.apiClient) || {};

const textValue =
  typeof SHARED_UI.textValue === "function"
    ? SHARED_UI.textValue
    : (key) => UI_TEXT[key] || `[${key}]`;
const escapeHtml =
  typeof SHARED_UI.escapeHtml === "function"
    ? SHARED_UI.escapeHtml
    : (value) =>
        String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
const truncateValue =
  typeof SHARED_UI.truncateValue === "function"
    ? SHARED_UI.truncateValue
    : (value, maxLength = UI_DEFAULTS.maxCellChars || 120) => {
        const text = value == null ? "" : String(value);
        if (text.length <= maxLength) {
          return text;
        }
        return `${text.slice(0, maxLength - 1)}...`;
      };
const formatRowsMeta =
  typeof SHARED_UI.formatRowsMeta === "function"
    ? SHARED_UI.formatRowsMeta
    : (visibleRowsCount, allRowsCount) => `${textValue("rowsLabel")}: ${visibleRowsCount}/${allRowsCount}`;
const formatPagesMeta =
  typeof SHARED_UI.formatPagesMeta === "function"
    ? SHARED_UI.formatPagesMeta
    : (page, pages) => `${textValue("pageLabel")}: ${page}/${pages}`;
const fillTemplate =
  typeof SHARED_UI.fillTemplate === "function"
    ? SHARED_UI.fillTemplate
    : (template, values) => String(template || "");
const fetchJson =
  typeof API_CLIENT.fetchJson === "function"
    ? API_CLIENT.fetchJson
    : async () => {
        throw new Error(textValue("unknownApiError"));
      };
const UI_FORMATS = SHARED_UI.uiFormats || {};

const dictionarySelect = document.getElementById("dictionarySelect");
const tableContainer = document.getElementById("tableContainer");
const tableMeta = document.getElementById("tableMeta");
const openFiltersButton = document.getElementById("openFiltersButton");
const activeFiltersInfo = document.getElementById("activeFiltersInfo");
const currentDictionaryInfo = document.getElementById("currentDictionaryInfo");
const prevPageButton = document.getElementById("prevPageButton");
const nextPageButton = document.getElementById("nextPageButton");
const pageInfo = document.getElementById("pageInfo");
const discardButton = document.getElementById("discardButton");
const saveButton = document.getElementById("saveButton");
const editButton = document.getElementById("editButton");
const publishButton = document.getElementById("publishButton");
const accountToggle = document.getElementById("accountToggle");
const accountPanel = document.getElementById("accountPanel");
const userNameField = document.getElementById("userNameField");
const userNameLabel = document.getElementById("userNameLabel");
const rolesLabel = document.getElementById("rolesLabel");
const rolesList = document.getElementById("rolesList");
const dictionaryLabel = document.getElementById("dictionaryLabel");
const dictionaryVersionLabel = document.getElementById("dictionaryVersionLabel");
const dictionaryVersionSelect = document.getElementById("dictionaryVersionSelect");
const showVersionDetailsButton = document.getElementById("showVersionDetailsButton");
const appTitle = document.getElementById("appTitle");
// Usunięto inicjalizację dialogu edycji rekordu
const discardDialog = document.getElementById("discardDialog");
const discardDialogTitle = document.getElementById("discardDialogTitle");
const discardDialogIntro = document.getElementById("discardDialogIntro");
const discardChangesList = document.getElementById("discardChangesList");
const discardStayButton = document.getElementById("discardStayButton");
const discardConfirmButton = document.getElementById("discardConfirmButton");
const saveDialog = document.getElementById("saveDialog");
const saveDialogTitle = document.getElementById("saveDialogTitle");
const saveDialogIntro = document.getElementById("saveDialogIntro");
const saveChangesList = document.getElementById("saveChangesList");
const saveStayButton = document.getElementById("saveStayButton");
const saveConfirmButton = document.getElementById("saveConfirmButton");
const discardAllDialog = document.getElementById("discardAllDialog");
const discardAllDialogTitle = document.getElementById("discardAllDialogTitle");
const discardAllDialogIntro = document.getElementById("discardAllDialogIntro");
const discardAllChangesList = document.getElementById("discardAllChangesList");
const discardAllStayButton = document.getElementById("discardAllStayButton");
const discardAllConfirmButton = document.getElementById("discardAllConfirmButton");
const versionDetailsDialog = document.getElementById("versionDetailsDialog");
const versionDetailsTitle = document.getElementById("versionDetailsTitle");
const versionDetailsCloseButton = document.getElementById("versionDetailsCloseButton");
const versionDetailsContent = document.getElementById("versionDetailsContent");
const errorDetailsDialog = document.getElementById("errorDetailsDialog");
const errorDetailsTitle = document.getElementById("errorDetailsTitle");
const errorDetailsCopyButton = document.getElementById("errorDetailsCopyButton");
const errorDetailsCloseButton = document.getElementById("errorDetailsCloseButton");
const errorDetailsMessage = document.getElementById("errorDetailsMessage");
const errorDetailsText = document.getElementById("errorDetailsText");
const filtersDialog = document.getElementById("filtersDialog");
const filtersDialogTitle = document.getElementById("filtersDialogTitle");
const filtersDialogIntro = document.getElementById("filtersDialogIntro");
const filtersRulesList = document.getElementById("filtersRulesList");
const filtersAddRuleButton = document.getElementById("filtersAddRuleButton");
const filtersApplyButton = document.getElementById("filtersApplyButton");
const filtersApplyCloseButton = document.getElementById("filtersApplyCloseButton");
const filtersClearButton = document.getElementById("filtersClearButton");
const filtersCloseButton = document.getElementById("filtersCloseButton");

const MAX_CELL_CHARS = UI_DEFAULTS.maxCellChars;
const PAGE_SIZE = UI_DEFAULTS.pageSize;
const LONG_TEXT_THRESHOLD = UI_DEFAULTS.longTextThreshold;
const USER_DETAILS_DROPDOWN_THRESHOLD = UI_DEFAULTS.userDetailsDropdownThreshold;
const HIDDEN_COLUMNS = new Set(UI_DEFAULTS.hiddenColumns || []);
const DEFAULT_SORT_DIRECTION = UI_BEHAVIOR.defaultSortDirection === "DESC" ? "DESC" : "ASC";
const FILTERS_SUMMARY_TEMPLATE = String(UI_FORMATS.filtersSummaryTemplate || '{column} IN "{value}"');
const FILTERS_SUMMARY_JOINER = String(UI_FORMATS.filtersSummaryJoiner || " AND ");
const ACCOUNT_ROLE_SEPARATOR = " - ";
const CHANGE_ARROW = String(UI_FORMATS.changeArrow || " -> ");
const FILTER_DRAFT_ROW_TEMPLATE = String(
  UI_FORMATS.filterDraftRowTemplate || "Filter rule: Column - Value: {column} - {value}"
);

let activeDictionary = "";
let dictionaries = [];
let originalRows = [];
let workingRows = [];
let pendingRowChanges = new Map();
let hasSavedChanges = false;
let editRowIndex = -1;
let editedDraft = null;
let modalOriginalDraft = null;
let currentPage = 1;
let totalPages = 1;
let totalRows = 0;
let currentDictionaryCanUpdate = false;
let dictionaryVersions = [];
let selectedDictionaryVersionKey = "";
let currentSnapshotToken = "";
let lastErrorMessage = "";
let lastErrorDetails = "";
let activeFilters = [];
let filtersDraft = [];
let currentTableColumns = [];
let currentSortColumn = "";
let currentSortDirection = DEFAULT_SORT_DIRECTION;
let hasLoadedTableData = false;
let isDictionaryEditMode = false;

const VERSION_DETAILS_HIDDEN_COLUMNS = new Set(UI_BEHAVIOR.versionDetailsHiddenColumns || []);

function applyTypographyAssets() {
  if (Array.isArray(UI_TYPOGRAPHY.preconnectUrls)) {
    UI_TYPOGRAPHY.preconnectUrls.forEach((url) => {
      if (!url || document.head.querySelector(`link[rel="preconnect"][href="${url}"]`)) {
        return;
      }

      const link = document.createElement("link");
      link.rel = "preconnect";
      link.href = url;
      if (url.includes("gstatic")) {
        link.crossOrigin = "";
      }
      document.head.appendChild(link);
    });
  }

  if (UI_TYPOGRAPHY.stylesheetUrl) {
    const existing = document.head.querySelector(`link[rel="stylesheet"][href="${UI_TYPOGRAPHY.stylesheetUrl}"]`);
    if (!existing) {
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = UI_TYPOGRAPHY.stylesheetUrl;
      document.head.appendChild(stylesheet);
    }
  }
}

function applyStaticConfig() {
  applyTypographyAssets();
  document.title = textValue("documentTitle");
  appTitle.textContent = textValue("appTitle");
  appTitle.title = textValue("appTitle");
  accountToggle.textContent = textValue("accountButton");
  userNameLabel.textContent = textValue("userLabel");
  rolesLabel.textContent = textValue("rolesLabel");
  dictionaryLabel.textContent = textValue("dictionaryLabel");
  dictionaryVersionLabel.textContent = textValue("dictionaryVersionLabel");
  showVersionDetailsButton.textContent = textValue("showVersionDetails");
  showVersionDetailsButton.disabled = true;
  versionDetailsTitle.textContent = textValue("versionDetailsTitle");
  versionDetailsCloseButton.textContent = textValue("versionDetailsClose");
  errorDetailsTitle.textContent = textValue("errorDetailsTitle");
  errorDetailsCopyButton.textContent = textValue("errorDetailsCopy");
  errorDetailsCloseButton.textContent = textValue("errorDetailsClose");
  filtersDialogTitle.textContent = textValue("filtersDialogTitle");
  filtersDialogIntro.textContent = textValue("filtersDialogIntro");
  filtersAddRuleButton.textContent = textValue("filtersAddRule");
  filtersApplyButton.textContent = textValue("filtersApply");
  filtersApplyCloseButton.textContent = textValue("filtersApplyClose");
  filtersClearButton.textContent = textValue("filtersClear");
  filtersCloseButton.textContent = textValue("filtersClose");
  dictionarySelect.setAttribute("aria-label", textValue("dictionarySelectorAriaLabel"));
  dictionaryVersionSelect.setAttribute("aria-label", textValue("dictionaryVersionSelectorAriaLabel"));
  editButton.textContent = textValue("editDictionary");
  saveButton.textContent = textValue("save");
  discardButton.textContent = textValue("discard");
  publishButton.textContent = textValue("publish");
  openFiltersButton.textContent = textValue("filtersOpen");
  setTableDataLoadedState(false);
  prevPageButton.textContent = textValue("previous");
  nextPageButton.textContent = textValue("next");
  // Usunięto odwołania do nieistniejących elementów dialogu edycji rekordu
  discardDialogTitle.textContent = textValue("discardDialogTitle");
  discardDialogIntro.textContent = textValue("discardDialogIntro");
  discardStayButton.textContent = textValue("discardDialogKeepEditing");
  discardConfirmButton.textContent = textValue("discardDialogConfirm");
  saveDialogTitle.textContent = textValue("saveDialogTitle");
  saveDialogIntro.textContent = textValue("saveDialogIntro");
  saveStayButton.textContent = textValue("saveDialogBack");
  saveConfirmButton.textContent = textValue("saveDialogConfirm");
  discardAllDialogTitle.textContent = textValue("discardAllDialogTitle");
  discardAllDialogIntro.textContent = textValue("discardAllDialogIntro");
  discardAllStayButton.textContent = textValue("discardAllDialogBack");
  discardAllConfirmButton.textContent = textValue("discardAllDialogConfirm");
  // Usunięto odwołanie do nieistniejącego elementu dialogu edycji rekordu
  tableMeta.textContent = textValue("rowsInitial");
  pageInfo.textContent = textValue("pageInfoInitial");
  updateCurrentDictionaryInfo();
  resetDictionaryVersionSelect();
  updateFiltersSummary();

  if (UI_TYPOGRAPHY.primaryFont) {
    document.documentElement.style.setProperty("--font-primary", UI_TYPOGRAPHY.primaryFont);
  }
}

function formatFiltersSummary() {
  if (!Array.isArray(activeFilters) || activeFilters.length === 0) {
    return textValue("filtersSummaryNone");
  }

  // Mapuj techniczne nazwy kolumn na aliasy
  const businessMap = {};
  if (Array.isArray(currentTableColumns)) {
    currentTableColumns.forEach(colObj => {
      if (typeof colObj === "object" && colObj !== null && typeof colObj.DICTIONARY_COLUMN_TECHNICAL === "string") {
        businessMap[colObj.DICTIONARY_COLUMN_TECHNICAL] = colObj.DICTIONARY_COLUMN_BUSINESS;
      }
    });
  }

  const parts = activeFilters
    .map((item) => {
      const technical = String(item && item.column != null ? item.column : "").trim();
      const business = businessMap[technical] || technical;
      return {
        column: business,
        value: String(item && item.value != null ? item.value : "").trim()
      };
    })
    .filter((item) => item.column.length > 0 && item.value.length > 0)
    .map((item) =>
      fillTemplate(FILTERS_SUMMARY_TEMPLATE, {
        column: item.column,
        value: item.value
      })
    );

  if (parts.length === 0) {
    return textValue("filtersSummaryNone");
  }

  // Add space after AND
  // Add space before each subsequent rule
  if (parts.length === 0) return textValue("filtersSummaryNone");
  let summary = parts[0];
  for (let i = 1; i < parts.length; i++) {
    summary += ' ' + FILTERS_SUMMARY_JOINER + ' ' + parts[i];
  }
  return summary;
}

function updateFiltersSummary() {
  activeFiltersInfo.textContent = formatFiltersSummary();
}


// Return only the technical dictionary name

function getCurrentDictionaryLabel() {
  const match = Array.isArray(dictionaries)
    ? dictionaries.find((item) => item && item.id === activeDictionary)
    : null;
  return match && match.label ? String(match.label) : String(activeDictionary || "");
}


// Zwracaj tylko techniczny klucz wersji

function getCurrentDictionaryVersionLabel() {
  const selectedKey = String(selectedDictionaryVersionKey || "").trim();
  if (!selectedKey || !Array.isArray(dictionaryVersions)) {
    return "";
  }
  const selectedVersion = dictionaryVersions.find((item) => item && String(item.id) === selectedKey);
  return selectedVersion && selectedVersion.label ? String(selectedVersion.label) : selectedKey;
}

function updateCurrentDictionaryInfo() {
  if (!hasLoadedTableData) {
    currentDictionaryInfo.textContent = textValue("currentDictionaryNone");
    return;
  }

  const label = getCurrentDictionaryLabel();
  if (!label) {
    currentDictionaryInfo.textContent = textValue("currentDictionaryNone");
    return;
  }

  const versionLabel = getCurrentDictionaryVersionLabel();
  if (!versionLabel) {
    currentDictionaryInfo.textContent = `${textValue("currentDictionaryPrefix")} ${label}`;
    return;
  }

  currentDictionaryInfo.textContent = `${textValue("currentDictionaryPrefix")} ${label} ${textValue(
    "currentDictionaryVersionShort"
  )} ${versionLabel}`;
}

function updateFiltersButtonState() {
  openFiltersButton.disabled = !hasLoadedTableData;
}

function resetSorting() {
  currentSortColumn = "";
  currentSortDirection = DEFAULT_SORT_DIRECTION;
}

function setTableDataLoadedState(isLoaded) {
  hasLoadedTableData = Boolean(isLoaded);
  updateFiltersButtonState();
  updateCurrentDictionaryInfo();
}

function createEmptyFilterRule() {
  return { column: "", value: "" };
}

function getNextFilterColumn(previousColumn = "") {
  if (!Array.isArray(currentTableColumns) || currentTableColumns.length === 0) {
    return "";
  }

  // Extract technical column names
  const technicalColumns = currentTableColumns.map(colObj =>
    typeof colObj === "object" && colObj !== null && typeof colObj.DICTIONARY_COLUMN_TECHNICAL === "string"
      ? colObj.DICTIONARY_COLUMN_TECHNICAL
      : String(colObj)
  );

  const normalizedPrevious = String(previousColumn || "").trim();
  if (!normalizedPrevious) {
    return technicalColumns[0];
  }

  const currentIndex = technicalColumns.findIndex((column) => column === normalizedPrevious);
  if (currentIndex < 0) {
    return technicalColumns[0];
  }

  const nextIndex = (currentIndex + 1) % technicalColumns.length;
  return technicalColumns[nextIndex];
}

function renderFiltersDraft() {
  if (!Array.isArray(currentTableColumns) || currentTableColumns.length === 0) {
    filtersRulesList.innerHTML = `<div class="empty-state">${escapeHtml(textValue("filtersNoColumns"))}</div>`;
    return;
  }

  if (!Array.isArray(filtersDraft) || filtersDraft.length === 0) {
    filtersRulesList.innerHTML = `<div class="empty-state">${escapeHtml(textValue("filtersEmpty"))}</div>`;
    return;
  }

  const baseColumns = Array.isArray(currentTableColumns)
    ? currentTableColumns.map(colObj => {
        if (typeof colObj === "object" && colObj !== null) {
          return {
            technical: colObj.DICTIONARY_COLUMN_TECHNICAL,
            business: colObj.DICTIONARY_COLUMN_BUSINESS
          };
        }
        return { technical: String(colObj), business: String(colObj) };
      })
    : [];
  const header = `<div class="filters-rule-header">
    <span>${escapeHtml(textValue("filtersColumnLabel"))}</span>
    <span>${escapeHtml(textValue("filtersValueLabel"))}</span>
    <span></span>
  </div>`;

  const rows = filtersDraft
    .map((rule, index) => {
      const column = rule && rule.column != null ? String(rule.column) : "";
      const value = rule && rule.value != null ? String(rule.value) : "";
      const rowColumns = [...baseColumns];
      if (column && !rowColumns.some(col => col.technical === column)) {
        rowColumns.unshift({ technical: column, business: column });
      }

      const options = rowColumns
        .map((item) => {
          const selectedAttr = item.technical === column ? " selected" : "";
          return `<option value="${escapeHtml(item.technical)}"${selectedAttr}>${escapeHtml(item.business)}</option>`;
        })
        .join("");

      return `<div class="filters-rule-row" data-filter-index="${index}">
        <select data-filter-field="column">${options}</select>
        <input data-filter-field="value" value="${escapeHtml(value)}" placeholder="${escapeHtml(
          textValue("filtersValuePlaceholder")
        )}" />
        <button type="button" class="btn btn-discard" data-filter-remove="${index}">${escapeHtml(
          textValue("filtersRemoveRule")
        )}</button>
      </div>`;
    })
    .join("");

  filtersRulesList.innerHTML = `${header}${rows}`;
}

function openFiltersDialog() {
  if (Array.isArray(activeFilters) && activeFilters.length > 0) {
    filtersDraft = activeFilters.map((item) => {
      let col = item && item.column != null ? item.column : "";
      // If column is an object, extract technical name
      if (typeof col === "object" && col !== null && typeof col.DICTIONARY_COLUMN_TECHNICAL === "string") {
        col = col.DICTIONARY_COLUMN_TECHNICAL;
      } else {
        col = String(col);
      }
      return {
        column: col,
        value: item && item.value != null ? String(item.value) : ""
      };
    });
  } else {
    // Default: empty filter
    filtersDraft = [];
  }

  renderFiltersDraft();
  filtersDialog.showModal();
}

function collectFiltersFromDraft() {
  const rows = Array.from(filtersRulesList.querySelectorAll(".filters-rule-row"));
  return rows
    .map((row) => {
      const columnInput = row.querySelector('[data-filter-field="column"]');
      const valueInput = row.querySelector('[data-filter-field="value"]');
      const column = columnInput ? String(columnInput.value || "").trim() : "";
      const value = valueInput ? String(valueInput.value || "").trim() : "";
      return { column, value };
    })
    .filter((item) => item.column.length > 0 && item.value.length > 0);
}

function collectFiltersDraftRaw() {
  const rows = Array.from(filtersRulesList.querySelectorAll(".filters-rule-row"));
  return rows.map((row) => {
    const columnInput = row.querySelector('[data-filter-field="column"]');
    const valueInput = row.querySelector('[data-filter-field="value"]');
    const column = columnInput ? String(columnInput.value || "") : "";
    const value = valueInput ? String(valueInput.value || "") : "";
    return { column, value };
  });
}

function syncFiltersDraftFromUi() {
  if (!filtersDialog.open) {
    return;
  }

  filtersDraft = collectFiltersDraftRaw();
}

function normalizeFilterRowsForComparison(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((item) => ({
      column: String(item && item.column != null ? item.column : "").trim(),
      value: String(item && item.value != null ? item.value : "").trim()
    }))
    .filter((item) => item.column.length > 0 || item.value.length > 0);
}

function isFiltersDraftDirty() {
  const normalizedActive = normalizeFilterRowsForComparison(activeFilters);
  const normalizedDraft = normalizeFilterRowsForComparison(collectFiltersFromDraft());
  return JSON.stringify(normalizedActive) !== JSON.stringify(normalizedDraft);
}

function getFiltersDraftSummaryLines() {
  const rows = collectFiltersDraftRaw()
    .map((item) => ({
      column: String(item && item.column != null ? item.column : "").trim(),
      value: String(item && item.value != null ? item.value : "").trim()
    }))
    .filter((item) => item.column.length > 0 || item.value.length > 0);

  if (rows.length === 0) {
    const emptyValue = textValue("emptyValue");
    return [
      fillTemplate(FILTER_DRAFT_ROW_TEMPLATE, {
        column: emptyValue,
        value: emptyValue
      })
    ];
  }

  return rows.map((item) => {
    const emptyValue = textValue("emptyValue");
    const column = item.column.length > 0 ? item.column : emptyValue;
    const value = item.value.length > 0 ? item.value : emptyValue;
    return fillTemplate(FILTER_DRAFT_ROW_TEMPLATE, { column, value });
  });
}

async function askDiscardFiltersWithChanges(summaryLines) {
  const previousTitle = discardDialogTitle.textContent;
  const previousIntro = discardDialogIntro.textContent;
  const previousStay = discardStayButton.textContent;
  const previousConfirm = discardConfirmButton.textContent;

  discardDialogTitle.textContent = textValue("filtersDiscardDialogTitle");
  discardDialogIntro.textContent = textValue("filtersDiscardDialogIntro");
  discardStayButton.textContent = textValue("filtersDiscardDialogKeepEditing");
  discardConfirmButton.textContent = textValue("filtersDiscardDialogConfirm");

  discardChangesList.innerHTML = summaryLines
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("");
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
      discardStayButton.removeEventListener("click", onStay);
      discardConfirmButton.removeEventListener("click", onConfirm);
      discardDialog.removeEventListener("cancel", onCancel);
    };

    discardStayButton.addEventListener("click", onStay);
    discardConfirmButton.addEventListener("click", onConfirm);
    discardDialog.addEventListener("cancel", onCancel);
    discardDialog.showModal();
  });

  try {
    return shouldDiscard;
  } finally {
    discardDialogTitle.textContent = previousTitle;
    discardDialogIntro.textContent = previousIntro;
    discardStayButton.textContent = previousStay;
    discardConfirmButton.textContent = previousConfirm;
    discardChangesList.hidden = false;
  }
}

async function closeFiltersDialog() {
  if (!isFiltersDraftDirty()) {
    filtersDialog.close();
    return;
  }

  const shouldDiscard = await askDiscardFiltersWithChanges(getFiltersDraftSummaryLines());
  if (shouldDiscard) {
    filtersDialog.close();
  }
}

function applyFilters(closeAfterApply = false) {
  activeFilters = collectFiltersFromDraft();
  updateFiltersSummary();

  if (activeDictionary && selectedDictionaryVersionKey) {
    loadRows(activeDictionary, 1, selectedDictionaryVersionKey);
  }

  if (closeAfterApply) {
    filtersDialog.close();
  }
}

function buildRowsUrl(dictionaryName, requestedPage, dictionaryVersionKey) {
  const params = new URLSearchParams({
    page: String(requestedPage),
    pageSize: String(PAGE_SIZE),
    dictionaryVersionKey: String(dictionaryVersionKey)
  });

  if (Array.isArray(activeFilters) && activeFilters.length > 0) {
    params.set("filters", JSON.stringify(activeFilters));
  }

  if (currentSortColumn) {
    params.set("sortColumn", currentSortColumn);
    params.set("sortDirection", currentSortDirection);
  }

  return `/api/dictionaries/${encodeURIComponent(dictionaryName)}/rows?${params.toString()}`;
}

function setLoading(message = textValue("loadingData")) {
  tableContainer.innerHTML = `<div class="empty-state">${message}</div>`;
}

function setError(message) {
  lastErrorMessage = message || 'Unknown error';
  lastErrorDetails = '';
  openErrorDetailsDialog();
}

function setErrorWithDetails(message, details) {
  lastErrorMessage = String(message || "");
  lastErrorDetails = String(details || "").trim();
  openErrorDetailsDialog();
}

function extractErrorDetails(error) {
  if (!error) {
    return "";
  }

  if (typeof error.details === "string" && error.details.trim()) {
    return error.details.trim();
  }

  return "";
}

function openErrorDetailsDialog() {
  // Fallback: zawsze pokazuj okno błędu, nawet jeśli brak szczegółów
  errorDetailsMessage.textContent = lastErrorMessage || "Nie można zainicjalizować aplikacji. Sprawdź połączenie z API lub konfigurację frontendu.";
  errorDetailsText.textContent = lastErrorDetails || "Brak szczegółów błędu. Sprawdź konsolę przeglądarki i backend.";
  errorDetailsCopyButton.textContent = textValue("errorDetailsCopy");
  errorDetailsDialog.showModal();
}

async function copyErrorDetails() {
  if (!lastErrorDetails) {
    return;
  }

  try {
    await navigator.clipboard.writeText(lastErrorDetails);
    errorDetailsCopyButton.textContent = textValue("errorDetailsCopied");
  } catch (error) {
    errorDetailsCopyButton.textContent = textValue("errorDetailsCopyFailed");
  }
}

function resetDictionaryVersionSelect() {
  dictionaryVersions = [];
  selectedDictionaryVersionKey = "";
  currentSnapshotToken = "";
  dictionaryVersionSelect.innerHTML = `<option value="">${escapeHtml(textValue("dictionaryVersionDisabledOption"))}</option>`;
  dictionaryVersionSelect.disabled = true;
  showVersionDetailsButton.disabled = true;
  updateCurrentDictionaryInfo();
}

function setDictionaryVersionLoading() {
  selectedDictionaryVersionKey = "";
  currentSnapshotToken = "";
  dictionaryVersionSelect.innerHTML = `<option value="">${escapeHtml(textValue("dictionaryVersionLoadingOption"))}</option>`;
  dictionaryVersionSelect.disabled = true;
  showVersionDetailsButton.disabled = true;
  updateCurrentDictionaryInfo();
}

function populateDictionaryVersions(versions) {
  dictionaryVersions = Array.isArray(versions) ? versions : [];

  if (dictionaryVersions.length === 0) {
    dictionaryVersionSelect.innerHTML = `<option value="">${escapeHtml(textValue("dictionaryVersionEmptyOption"))}</option>`;
    dictionaryVersionSelect.disabled = true;
    showVersionDetailsButton.disabled = true;
    updateCurrentDictionaryInfo();
    return;
  }

  const baseOption = `<option value="" data-placeholder="true">${escapeHtml(
    textValue("selectDictionaryVersionOption")
  )}</option>`;


  const options = dictionaryVersions
    .map((item) => {
      const id = item && item.id != null ? String(item.id) : "";
      const label = item && typeof item.label === "string" ? item.label : id;
      return `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`;
    })
    .join("");

  dictionaryVersionSelect.innerHTML = `${baseOption}${options}`;
  dictionaryVersionSelect.disabled = false;
  showVersionDetailsButton.disabled = false;
  updateCurrentDictionaryInfo();
}

function renderVersionDetailsRows(rows) {
  const safeRows = Array.isArray(rows)
    ? [...rows].sort((a, b) => {
        const left = Number.parseFloat(a && a.DICTIONARY_VERSION_CODE);
        const right = Number.parseFloat(b && b.DICTIONARY_VERSION_CODE);

        if (Number.isFinite(left) && Number.isFinite(right)) {
          return right - left;
        }

        const leftText = String((a && a.DICTIONARY_VERSION_CODE) || "");
        const rightText = String((b && b.DICTIONARY_VERSION_CODE) || "");
        return rightText.localeCompare(leftText, undefined, { numeric: true, sensitivity: "base" });
      })
    : [];

  if (safeRows.length === 0) {
    versionDetailsContent.innerHTML = `<div class="empty-state">${escapeHtml(textValue("versionDetailsEmpty"))}</div>`;
    return;
  }

  const columns = Object.keys(safeRows[0]).filter((column) => !VERSION_DETAILS_HIDDEN_COLUMNS.has(column));

  if (columns.length === 0) {
    versionDetailsContent.innerHTML = `<div class="empty-state">${escapeHtml(textValue("versionDetailsEmpty"))}</div>`;
    return;
  }
  const head = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const body = safeRows
    .map((row) => {
      const cells = columns
        .map((column) => {
          const fullValue = row[column] == null ? "" : String(row[column]);
          const shortValue = truncateValue(fullValue);
          return `<td title="${escapeHtml(fullValue)}">${escapeHtml(shortValue)}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  versionDetailsContent.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

async function openVersionDetailsDialog() {
  if (!activeDictionary || showVersionDetailsButton.disabled) {
    return;
  }

  versionDetailsTitle.textContent = textValue("versionDetailsTitle");
  versionDetailsContent.innerHTML = `<div class="empty-state">${escapeHtml(textValue("versionDetailsLoading"))}</div>`;
  versionDetailsDialog.showModal();

  try {
    const data = await fetchJson(`/api/dictionaries/${encodeURIComponent(activeDictionary)}/version-history`);
    renderVersionDetailsRows(data.rows || []);
  } catch (error) {
    versionDetailsContent.innerHTML = `<div class="error-state">${escapeHtml(error.message)}</div>`;
  }
}

function updatePaginationControls() {
  const hasVersionSelection = Boolean(selectedDictionaryVersionKey);
  if (!activeDictionary || !hasVersionSelection) {
    pageInfo.textContent = formatPagesMeta(0, 0);
  } else {
    pageInfo.textContent = formatPagesMeta(currentPage, totalPages);
  }
  prevPageButton.disabled = !activeDictionary || !hasVersionSelection || currentPage <= 1;
  nextPageButton.disabled = !activeDictionary || !hasVersionSelection || currentPage >= totalPages;
}

function isHiddenColumn(columnName) {
  return HIDDEN_COLUMNS.has(String(columnName || "").trim().toUpperCase());
}

function getVisibleColumnsFromRow(row) {
  return Object.keys(row || {}).filter((column) => !isHiddenColumn(column));
}

function updateActionButtons() {
  const canStartEditing = Boolean(activeDictionary && selectedDictionaryVersionKey && hasLoadedTableData && currentDictionaryCanUpdate);
  const hasPending = pendingRowChanges.size > 0;

  editButton.disabled = !canStartEditing || isDictionaryEditMode;
  saveButton.disabled = !isDictionaryEditMode;
  discardButton.disabled = !hasPending;
  publishButton.disabled = true;
}

function renderTable(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    tableContainer.innerHTML = `<div class="empty-state">${textValue("noRowsReturned")}</div>`;
    tableMeta.textContent = formatRowsMeta(0, totalRows);
    updateActionButtons();
    updatePaginationControls();
    return;
  }

  // Render columns using DICTIONARY_COLUMN_BUSINESS
  const columns = Array.isArray(currentTableColumns)
    ? currentTableColumns.map(colObj =>
        typeof colObj === "object" && colObj !== null
          ? colObj.DICTIONARY_COLUMN_TECHNICAL
          : String(colObj)
      )
    : [];

  const businessHeaders = Array.isArray(currentTableColumns)
    ? currentTableColumns.map(colObj =>
        typeof colObj === "object" && colObj !== null && typeof colObj.DICTIONARY_COLUMN_BUSINESS === "string"
          ? colObj.DICTIONARY_COLUMN_BUSINESS
          : (typeof colObj === "object" && colObj !== null ? colObj.DICTIONARY_COLUMN_TECHNICAL : String(colObj))
      )
    : columns;

  const isCenteredColumn = (columnName) => String(columnName || "").toUpperCase() === "MET_DICTIONARY_VERSION";

  const head = `<th>${escapeHtml(textValue("tableActionHeader"))}</th>${businessHeaders
    .map((col, idx) => {
      const isActiveSort = currentSortColumn === String(columns[idx]).toUpperCase();
      const directionMark = isActiveSort ? (currentSortDirection === "DESC" ? " ▼" : " ▲") : "";
      const headerClass = isCenteredColumn(columns[idx]) ? " class=\"col-center\"" : "";
      return `<th${headerClass}><button type="button" class="th-sort-btn" data-sort-column="${escapeHtml(columns[idx])}">${escapeHtml(
        col
      )}${directionMark}</button></th>`;
    })
    .join("")}`;

  const body = rows
    .map((row, rowIndex) => {
      const rowActionLabel = isDictionaryEditMode ? textValue("editRowButton") : textValue("showRowButton");
      const disabledAttr = "";
      const actionCell = `<td><button class="row-edit-btn" data-row-index="${rowIndex}" ${disabledAttr}>${escapeHtml(
        rowActionLabel
      )}</button></td>`;
      const tds = columns
        .map((col) => {
          const fullValue = row[col] == null ? "" : String(row[col]);
          const shortValue = truncateValue(fullValue);
          const cellClass = isCenteredColumn(col) ? " class=\"col-center\"" : "";
          return `<td${cellClass} title="${escapeHtml(fullValue)}">${escapeHtml(shortValue)}</td>`;
        })
        .join("");
      return `<tr>${actionCell}${tds}</tr>`;
    })
    .join("");

  tableContainer.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  tableMeta.textContent = formatRowsMeta(rows.length, totalRows);
  updateActionButtons();
  updatePaginationControls();
}

function renderRoles(dictionaryRoles) {
  if (!Array.isArray(dictionaryRoles) || dictionaryRoles.length === 0) {
    rolesList.innerHTML = `<li>${escapeHtml(textValue("noRolesLoaded"))}</li>`;
    return;
  }

  // Map dictionary id to label
  const dictionaryLabelMap = {};
  if (Array.isArray(dictionaries)) {
    dictionaries.forEach(dict => {
      if (dict && typeof dict.id === "string" && typeof dict.label === "string") {
        dictionaryLabelMap[dict.id] = dict.label;
      }
    });
  }

  const labels = dictionaryRoles.map((item) => {
    const dictionaryId = item && typeof item.dictionary === "string" ? item.dictionary.trim() : "";
    const dictionaryLabel = dictionaryLabelMap[dictionaryId] || dictionaryId;
    const role = item && typeof item.role === "string" ? item.role.trim() : "";
    return dictionaryLabel && role ? `${dictionaryLabel}${ACCOUNT_ROLE_SEPARATOR}${role}` : dictionaryLabel || role;
  });

  if (labels.length > USER_DETAILS_DROPDOWN_THRESHOLD) {
    const options = labels
      .map((label) => `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`)
      .join("");

    rolesList.innerHTML = `<li><select class="roles-select" aria-label="${escapeHtml(
      textValue("rolesSelectAriaLabel")
    )}">${options}</select></li>`;
    return;
  }

  rolesList.innerHTML = labels.map((label) => `<li>${escapeHtml(label)}</li>`).join("");
}

async function loadUserContext() {
  try {
    const data = await fetchJson("/api/user-context");
    userNameField.textContent = data.user || "";
    renderRoles(data.dictionaryRoles || []);
  } catch (error) {
    userNameField.textContent = "";
    rolesList.innerHTML = `<li>${escapeHtml(error.message)}</li>`;
    lastErrorMessage = error.message || 'Unknown error';
    lastErrorDetails = extractErrorDetails(error) || JSON.stringify(error, null, 2);
    openErrorDetailsDialog();
  }
}

async function loadRows(dictionaryName, requestedPage = 1, dictionaryVersionKey = "") {
  activeDictionary = dictionaryName;
  updateCurrentDictionaryInfo();
  const selected = dictionaries.find((item) => item.id === dictionaryName);
  currentDictionaryCanUpdate = Boolean(selected && selected.canUpdate);

  const normalizedVersionKey = String(dictionaryVersionKey || "").trim();
  if (!normalizedVersionKey) {
    setTableDataLoadedState(false);
    currentTableColumns = [];
    totalRows = 0;
    totalPages = 1;
    currentPage = 1;
    currentSnapshotToken = "";
    updatePaginationControls();
    setLoading(textValue("selectDictionaryVersionPrompt"));
    return;
  }

  selectedDictionaryVersionKey = normalizedVersionKey;
  setTableDataLoadedState(false);
  setLoading();

  try {
    const data = await fetchJson(buildRowsUrl(dictionaryName, requestedPage, normalizedVersionKey));
    originalRows = data.rows || [];
    workingRows = JSON.parse(JSON.stringify(originalRows));
    pendingRowChanges = new Map();
    hasSavedChanges = false;
    currentPage = data.page || 1;
    totalPages = data.totalPages || 1;
    totalRows = data.totalRows || 0;
    currentDictionaryCanUpdate = Boolean(data.canUpdate);
    currentSnapshotToken = typeof data.snapshotToken === "string" ? data.snapshotToken : "";
    if (Array.isArray(data.columns) && data.columns.length > 0) {
      currentTableColumns = [...data.columns];
    } else if (workingRows.length > 0) {
      currentTableColumns = getVisibleColumnsFromRow(workingRows[0]);
    } else {
      currentTableColumns = [];
    }
    setTableDataLoadedState(true);
    renderTable(workingRows);
  } catch (error) {
    setTableDataLoadedState(false);
    selectedDictionaryVersionKey = "";
    currentSnapshotToken = "";
    currentDictionaryCanUpdate = false;
    totalRows = 0;
    totalPages = 1;
    currentPage = 1;
    updatePaginationControls();
    lastErrorMessage = error.message || 'Unknown error';
    lastErrorDetails = extractErrorDetails(error) || JSON.stringify(error, null, 2);
    openErrorDetailsDialog();
  }
}

async function fetchSnapshotToken(dictionaryName, requestedPage, dictionaryVersionKey) {
  const data = await fetchJson(buildRowsUrl(dictionaryName, requestedPage, dictionaryVersionKey));

  return typeof data.snapshotToken === "string" ? data.snapshotToken : "";
}

async function loadDictionaryVersions(dictionaryName) {
  setTableDataLoadedState(false);
  currentTableColumns = [];
  setDictionaryVersionLoading();
  totalRows = 0;
  totalPages = 1;
  currentPage = 1;
  tableMeta.textContent = textValue("rowsInitial");
  updatePaginationControls();
  setLoading(textValue("selectDictionaryVersionPrompt"));

  try {
    const data = await fetchJson(`/api/dictionaries/${encodeURIComponent(dictionaryName)}/versions`);
    populateDictionaryVersions(data.versions || []);
  } catch (error) {
    dictionaryVersionSelect.innerHTML = `<option value="">${escapeHtml(error.message)}</option>`;
    dictionaryVersionSelect.disabled = true;
    lastErrorMessage = error.message || 'Unknown error';
    lastErrorDetails = extractErrorDetails(error) || JSON.stringify(error, null, 2);
    openErrorDetailsDialog();
  }
}

async function applyMeta(meta) {
  dictionaries = meta.dictionaries || [];


  dictionarySelect.innerHTML = dictionaries
    .map((dictionary) => `<option value="${dictionary.id}">${escapeHtml(dictionary.label || dictionary.id)}</option>`)
    .join("");

  dictionarySelect.insertAdjacentHTML(
    "afterbegin",
    `<option value="" selected data-placeholder="true">${escapeHtml(
      textValue("selectDictionaryOption")
    )}</option>`
  );

  tableMeta.textContent = textValue("rowsInitial");
  currentDictionaryCanUpdate = false;
  currentPage = 1;
  totalPages = 1;
  totalRows = 0;
  setTableDataLoadedState(false);
  updatePaginationControls();
  setLoading(textValue("selectDictionaryPrompt"));
  updateActionButtons();
  resetDictionaryVersionSelect();
  updateFiltersSummary();
  updateCurrentDictionaryInfo();
}

function normalizeRowForModal(row) {
  const source = row && typeof row === "object" ? row : {};
  const normalized = {};

  Object.keys(source).forEach((key) => {
    if (isHiddenColumn(key)) {
      return;
    }
    normalized[key] = source[key] == null ? "" : String(source[key]);
  });

  return normalized;
}

function openRowDialog(rowIndex, editable) {
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= workingRows.length) {
    return;
  }

  // Usunięto dialog edycji rekordu (Edit Record)
}

function collectDraftFromModal() {
  const controls = editFields.querySelectorAll("[data-field]");
  const draft = {};

  controls.forEach((control) => {
    const key = control.getAttribute("data-field");
    draft[key] = control.value;
  });

  return draft;
}

function isModalDirty() {
  if (!modalOriginalDraft) {
    return false;
  }

  const current = collectDraftFromModal();
  return JSON.stringify(current) !== JSON.stringify(modalOriginalDraft);
}

function getModalChanges() {
  if (!modalOriginalDraft) {
    return [];
  }

  const current = collectDraftFromModal();
  const keys = Array.from(new Set([...Object.keys(modalOriginalDraft), ...Object.keys(current)])).sort((a, b) =>
    a.localeCompare(b)
  );

  return keys
    .map((key) => {
      const oldValue = modalOriginalDraft[key] == null ? "" : String(modalOriginalDraft[key]);
      const newValue = current[key] == null ? "" : String(current[key]);
      return {
        field: key,
        oldValue,
        newValue,
        changed: oldValue !== newValue
      };
    })
    .filter((item) => item.changed);
}

function getPendingChanges() {
  const allChanges = [];

  pendingRowChanges.forEach((_, rowIndex) => {
    const originalRow = normalizeRowForModal(originalRows[rowIndex] || {});
    const currentRow = normalizeRowForModal(workingRows[rowIndex] || {});
    const keys = Array.from(new Set([...Object.keys(originalRow), ...Object.keys(currentRow)])).sort((a, b) =>
      a.localeCompare(b)
    );

    keys.forEach((key) => {
      const oldValue = originalRow[key] == null ? "" : String(originalRow[key]);
      const newValue = currentRow[key] == null ? "" : String(currentRow[key]);
      if (oldValue === newValue) {
        return;
      }

      allChanges.push({
        field: `${textValue("rowLabel")} ${rowIndex + 1} / ${key}`,
        oldValue,
        newValue,
        changed: true
      });
    });
  });

  return allChanges;
}

function renderChangesList(container, changes) {
  const emptyValue = textValue("emptyValue");
  container.innerHTML = changes
    .map((item) => {
      const oldText = item.oldValue.length > 0 ? item.oldValue : emptyValue;
      const newText = item.newValue.length > 0 ? item.newValue : emptyValue;
      return `<li><strong>${escapeHtml(item.field)}</strong>: ${escapeHtml(oldText)}${escapeHtml(
        CHANGE_ARROW
      )}${escapeHtml(newText)}</li>`;
    })
    .join("");
}

function askConfirmationWithChanges(dialog, listContainer, stayButton, confirmButton, changes, showChanges = true) {
  if (showChanges) {
    renderChangesList(listContainer, changes);
    listContainer.hidden = false;
  } else {
    listContainer.innerHTML = "";
    listContainer.hidden = true;
  }

  return new Promise((resolve) => {
    const onStay = () => {
      cleanup();
      dialog.close();
      resolve(false);
    };

    const onConfirm = () => {
      cleanup();
      dialog.close();
      resolve(true);
    };

    const onCancel = (event) => {
      event.preventDefault();
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      stayButton.removeEventListener("click", onStay);
      confirmButton.removeEventListener("click", onConfirm);
      dialog.removeEventListener("cancel", onCancel);
    };

    stayButton.addEventListener("click", onStay);
    confirmButton.addEventListener("click", onConfirm);
    dialog.addEventListener("cancel", onCancel);
    dialog.showModal();
  });
}

function askDiscardWithChanges(changes) {
  return askConfirmationWithChanges(discardDialog, discardChangesList, discardStayButton, discardConfirmButton, changes);
}

function askSaveWithChanges(changes) {
  return askConfirmationWithChanges(saveDialog, saveChangesList, saveStayButton, saveConfirmButton, changes);
}

function askDiscardAllWithChanges(changes) {
  return askConfirmationWithChanges(
    discardAllDialog,
    discardAllChangesList,
    discardAllStayButton,
    discardAllConfirmButton,
    changes,
    true
  );
}

function updateModalSaveState() {
  if (!isDictionaryEditMode) {
    rowSaveButton.disabled = true;
    return;
  }

  rowSaveButton.disabled = !isModalDirty();
}

async function saveModalChanges() {
  if (!isDictionaryEditMode) {
    editDialog.close();
    return;
  }

  // Usunięto obsługę dialogu edycji rekordu
  // ...existing code...
}

async function handleModalCancel() {
  if (!isDictionaryEditMode) {
    modalOriginalDraft = null;
    editDialog.close();
    return;
  }

  if (!isModalDirty()) {
    modalOriginalDraft = null;
    editDialog.close();
    return;
  }

  const changes = getModalChanges();
  const shouldDiscard = await askDiscardWithChanges(changes);
  if (shouldDiscard) {
    modalOriginalDraft = null;
    editDialog.close();
  }
}

async function discardAllChanges() {
  if (pendingRowChanges.size === 0) {
    return;
  }

  const allChanges = getPendingChanges();
  const previewChanges = allChanges.slice(0, 10);
  if (allChanges.length > 10) {
    previewChanges.push({
      field: "...",
      oldValue: "",
      newValue: "",
      changed: true
    });
  }

  const shouldDiscardAll = await askDiscardAllWithChanges(previewChanges);
  if (!shouldDiscardAll) {
    return;
  }

  workingRows = JSON.parse(JSON.stringify(originalRows));
  pendingRowChanges = new Map();
  hasSavedChanges = false;
  renderTable(workingRows);
}

async function saveAllChanges() {
  const previousTitle = saveDialogTitle.textContent;
  const previousIntro = saveDialogIntro.textContent;
  const previousStayText = saveStayButton.textContent;
  const previousConfirmText = saveConfirmButton.textContent;
  const previousStayHidden = saveStayButton.hidden;

  saveDialogTitle.textContent = textValue("save");
  saveDialogIntro.textContent = textValue("notYetImplemented");
  saveStayButton.hidden = true;
  saveConfirmButton.textContent = textValue("close");

  await askConfirmationWithChanges(saveDialog, saveChangesList, saveStayButton, saveConfirmButton, [], false);

  saveDialogTitle.textContent = previousTitle;
  saveDialogIntro.textContent = previousIntro;
  saveStayButton.textContent = previousStayText;
  saveConfirmButton.textContent = previousConfirmText;
  saveStayButton.hidden = previousStayHidden;
}

function publishChanges() {
  // Not yet implemented.
}

function startDictionaryEditMode() {
  // Disabled: Edit record modal does not appear in any situation
  return;
}

function handleTableClick(event) {
  const detailsButton = event.target.closest("#showErrorDetailsButton");
  if (detailsButton) {
    openErrorDetailsDialog();
    return;
  }

  const sortButton = event.target.closest("[data-sort-column]");
  if (sortButton) {
    const column = String(sortButton.getAttribute("data-sort-column") || "").trim().toUpperCase();
    if (!column || !activeDictionary || !selectedDictionaryVersionKey) {
      return;
    }

    if (currentSortColumn === column) {
      currentSortDirection = currentSortDirection === "ASC" ? "DESC" : "ASC";
    } else {
      currentSortColumn = column;
      currentSortDirection = DEFAULT_SORT_DIRECTION;
    }

    loadRows(activeDictionary, 1, selectedDictionaryVersionKey);
    return;
  }

  const button = event.target.closest(".row-edit-btn");
  if (!button) {
    return;
  }

  if (button.disabled) {
    return;
  }

  const rowIndex = Number.parseInt(button.getAttribute("data-row-index"), 10);
  openRowDialog(rowIndex, isDictionaryEditMode && currentDictionaryCanUpdate);
}

function handleAccountToggle() {
  const hidden = accountPanel.classList.toggle("hidden");
  accountToggle.setAttribute("aria-expanded", (!hidden).toString());
}

async function initialize() {
  applyStaticConfig();
  setLoading(textValue("loadingWorkspace"));
  try {
    const meta = await fetchJson("/api/meta");
    applyMeta(meta);
    await loadUserContext();
  } catch (error) {
    lastErrorMessage = error.message || 'Unknown error';
    lastErrorDetails = extractErrorDetails(error) || JSON.stringify(error, null, 2);
    openErrorDetailsDialog();
  }
}

dictionarySelect.addEventListener("change", (event) => {
  if (!event.target.value) {
    activeDictionary = "";
    updateCurrentDictionaryInfo();
    currentDictionaryCanUpdate = false;
    isDictionaryEditMode = false;
    activeFilters = [];
    resetSorting();
    pendingRowChanges = new Map();
    hasSavedChanges = false;
    tableMeta.textContent = textValue("rowsInitial");
    currentPage = 1;
    totalPages = 1;
    totalRows = 0;
    setTableDataLoadedState(false);
    updatePaginationControls();
    setLoading(textValue("selectDictionaryPrompt"));
    resetDictionaryVersionSelect();
    updateFiltersSummary();
    return;
  }

  const placeholder = dictionarySelect.querySelector('option[data-placeholder="true"]');
  if (placeholder) {
    placeholder.remove();
  }

  activeDictionary = event.target.value;
  isDictionaryEditMode = false;
  updateCurrentDictionaryInfo();
  activeFilters = [];
  resetSorting();
  updateFiltersSummary();
  loadDictionaryVersions(event.target.value);
});

dictionaryVersionSelect.addEventListener("change", (event) => {
  const versionKey = String(event.target.value || "").trim();
  selectedDictionaryVersionKey = versionKey;
  isDictionaryEditMode = false;
  updateCurrentDictionaryInfo();

  if (versionKey) {
    const placeholder = dictionaryVersionSelect.querySelector('option[data-placeholder="true"]');
    if (placeholder) {
      placeholder.remove();
    }
  }

  if (!activeDictionary || !versionKey) {
    setTableDataLoadedState(false);
    totalRows = 0;
    totalPages = 1;
    currentPage = 1;
    tableMeta.textContent = textValue("rowsInitial");
    updatePaginationControls();
    setLoading(textValue("selectDictionaryVersionPrompt"));
    return;
  }

  loadRows(activeDictionary, 1, versionKey);
});

prevPageButton.addEventListener("click", () => {
  if (!activeDictionary || !selectedDictionaryVersionKey || currentPage <= 1) {
    return;
  }

  loadRows(activeDictionary, currentPage - 1, selectedDictionaryVersionKey);
});

nextPageButton.addEventListener("click", () => {
  if (!activeDictionary || !selectedDictionaryVersionKey || currentPage >= totalPages) {
    return;
  }

  loadRows(activeDictionary, currentPage + 1, selectedDictionaryVersionKey);
});

openFiltersButton.addEventListener("click", openFiltersDialog);

filtersAddRuleButton.addEventListener("click", () => {
  syncFiltersDraftFromUi();
  const lastRule = Array.isArray(filtersDraft) && filtersDraft.length > 0 ? filtersDraft[filtersDraft.length - 1] : null;
  const nextColumn = getNextFilterColumn(lastRule && lastRule.column);
  filtersDraft.push({ column: nextColumn, value: "" });
  renderFiltersDraft();
});

filtersRulesList.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-filter-remove]");
  if (!removeButton) {
    return;
  }

  syncFiltersDraftFromUi();

  const index = Number.parseInt(removeButton.getAttribute("data-filter-remove"), 10);
  if (!Number.isInteger(index) || index < 0 || index >= filtersDraft.length) {
    return;
  }

  filtersDraft.splice(index, 1);
  renderFiltersDraft();
});

filtersApplyButton.addEventListener("click", () => {
  applyFilters(false);
});

filtersApplyCloseButton.addEventListener("click", () => {
  applyFilters(true);
});

filtersClearButton.addEventListener("click", () => {
  activeFilters = [];
  filtersDraft = [];
  updateFiltersSummary();
  renderFiltersDraft();

  if (activeDictionary && selectedDictionaryVersionKey) {
    loadRows(activeDictionary, 1, selectedDictionaryVersionKey);
  }
});

filtersCloseButton.addEventListener("click", () => {
  closeFiltersDialog();
});

filtersDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeFiltersDialog();
});

editButton.addEventListener("click", startDictionaryEditMode);
saveButton.addEventListener("click", saveAllChanges);
discardButton.addEventListener("click", discardAllChanges);
publishButton.addEventListener("click", () => {});
showVersionDetailsButton.addEventListener("click", openVersionDetailsDialog);
versionDetailsCloseButton.addEventListener("click", () => {
  versionDetailsDialog.close();
});
errorDetailsCloseButton.addEventListener("click", () => {
  errorDetailsDialog.close();
});
errorDetailsCopyButton.addEventListener("click", copyErrorDetails);
accountToggle.addEventListener("click", handleAccountToggle);
tableContainer.addEventListener("click", handleTableClick);
// Usunięto obsługę nieistniejących elementów dialogu edycji rekordu
// Usunięto obsługę zdarzenia cancel dla dialogu edycji rekordu

document.addEventListener("click", (event) => {
  if (!accountPanel.classList.contains("hidden") && !event.target.closest(".account-wrap")) {
    accountPanel.classList.add("hidden");
    accountToggle.setAttribute("aria-expanded", "false");
  }
});

initialize();

