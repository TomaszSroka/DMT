const FRONTEND_CONFIG = window.FRONTEND_CONFIG || {};
const UI_TEXT = FRONTEND_CONFIG.text || {};
const UI_DEFAULTS = FRONTEND_CONFIG.defaults || {};
const UI_TYPOGRAPHY = FRONTEND_CONFIG.typography || {};

const dictionarySelect = document.getElementById("dictionarySelect");
const tableContainer = document.getElementById("tableContainer");
const tableTitle = document.getElementById("tableTitle");
const tableMeta = document.getElementById("tableMeta");
const prevPageButton = document.getElementById("prevPageButton");
const nextPageButton = document.getElementById("nextPageButton");
const pageInfo = document.getElementById("pageInfo");
const discardButton = document.getElementById("discardButton");
const saveButton = document.getElementById("saveButton");
const publishButton = document.getElementById("publishButton");
const accountToggle = document.getElementById("accountToggle");
const accountPanel = document.getElementById("accountPanel");
const userNameField = document.getElementById("userNameField");
const userNameLabel = document.getElementById("userNameLabel");
const rolesLabel = document.getElementById("rolesLabel");
const rolesList = document.getElementById("rolesList");
const dictionaryLabel = document.getElementById("dictionaryLabel");
const appTitle = document.getElementById("appTitle");
const editDialog = document.getElementById("editDialog");
const editFields = document.getElementById("editFields");
const editDialogTitle = document.getElementById("editDialogTitle");
const rowSaveButton = document.getElementById("rowSaveButton");
const rowCancelButton = document.getElementById("rowCancelButton");

const MAX_CELL_CHARS = Number(UI_DEFAULTS.maxCellChars) || 120;
const PAGE_SIZE = Number(UI_DEFAULTS.pageSize) || 100;
const LONG_TEXT_THRESHOLD = Number(UI_DEFAULTS.longTextThreshold) || 90;

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

function textValue(key, fallback) {
  return UI_TEXT[key] || fallback;
}

function applyStaticConfig() {
  document.title = textValue("documentTitle", "DMT Dictionary Console");
  appTitle.textContent = textValue("appTitle", "Dictionary Management Tool (DMT)");
  accountToggle.textContent = textValue("accountButton", "User Account");
  userNameLabel.textContent = textValue("userLabel", "User");
  rolesLabel.textContent = textValue("rolesLabel", "Roles");
  dictionaryLabel.textContent = textValue("dictionaryLabel", "Dictionary Name:");
  dictionarySelect.setAttribute("aria-label", textValue("dictionarySelectorAriaLabel", "Dictionary selector"));
  saveButton.textContent = textValue("save", "Save");
  discardButton.textContent = textValue("discard", "Discard");
  publishButton.textContent = textValue("publish", "Publish");
  prevPageButton.textContent = textValue("previous", "Previous");
  nextPageButton.textContent = textValue("next", "Next");
  rowSaveButton.textContent = textValue("save", "Save");
  rowCancelButton.textContent = textValue("cancel", "Cancel");
  editDialogTitle.textContent = textValue("editRecordTitle", "Edit Record");
  tableTitle.textContent = textValue("loadingShort", "Loading...");
  tableMeta.textContent = textValue("rowsInitial", "Rows: 0");
  pageInfo.textContent = textValue("pageInfoInitial", "Pages: 0 / 0");

  if (UI_TYPOGRAPHY.primaryFont) {
    document.documentElement.style.setProperty("--font-primary", UI_TYPOGRAPHY.primaryFont);
  }
  if (UI_TYPOGRAPHY.monoFont) {
    document.documentElement.style.setProperty("--font-mono", UI_TYPOGRAPHY.monoFont);
  }
}

function formatRowsMeta(visibleRowsCount, allRowsCount) {
  return `${textValue("rowsLabel", "Rows")}: ${visibleRowsCount} / ${allRowsCount}`;
}

function formatPagesMeta(page, pages) {
  return `${textValue("pageLabel", "Pages")}: ${page} / ${pages}`;
}

function setLoading(message = textValue("loadingData", "Loading data...")) {
  tableContainer.innerHTML = `<div class="empty-state">${message}</div>`;
}

function setError(message) {
  tableContainer.innerHTML = `<div class="error-state">${message}</div>`;
}

function updatePaginationControls() {
  pageInfo.textContent = formatPagesMeta(currentPage, totalPages);
  prevPageButton.disabled = !activeDictionary || currentPage <= 1;
  nextPageButton.disabled = !activeDictionary || currentPage >= totalPages;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function truncateValue(value, maxLength = MAX_CELL_CHARS) {
  const text = value == null ? "" : String(value);
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}...`;
}

function updateActionButtons() {
  const hasPending = pendingRowChanges.size > 0;
  saveButton.disabled = !hasPending;
  discardButton.disabled = !hasPending;
  publishButton.disabled = !hasSavedChanges;
}

function renderTable(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    tableContainer.innerHTML = `<div class="empty-state">${textValue("noRowsReturned", "No rows returned.")}</div>`;
    tableMeta.textContent = formatRowsMeta(0, totalRows);
    updateActionButtons();
    updatePaginationControls();
    return;
  }

  const columns = Object.keys(rows[0]);
  const head = `<th>${escapeHtml(textValue("tableActionHeader", "Action"))}</th>${columns
    .map((col) => `<th>${escapeHtml(col)}</th>`)
    .join("")}`;

  const body = rows
    .map((row, rowIndex) => {
      const actionCell = `<td><button class="row-edit-btn" data-row-index="${rowIndex}">${escapeHtml(
        textValue("editRowButton", "Edit")
      )}</button></td>`;
      const tds = columns
        .map((col) => {
          const fullValue = row[col] == null ? "" : String(row[col]);
          const shortValue = truncateValue(fullValue);
          return `<td title="${escapeHtml(fullValue)}">${escapeHtml(shortValue)}</td>`;
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

async function fetchJson(url) {
  const response = await fetch(url);
  const raw = await response.text();

  let payload;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch (error) {
    throw new Error(
      textValue(
        "nonJsonApiError",
        "API returned non-JSON response. Open app via http://localhost:3000 and ensure backend is running."
      )
    );
  }

  if (!response.ok) {
    throw new Error(payload.error || textValue("unknownApiError", "Unknown API error"));
  }

  return payload;
}

function renderRoles(roles) {
  if (!Array.isArray(roles) || roles.length === 0) {
    rolesList.innerHTML = `<li>${escapeHtml(textValue("noRolesLoaded", "No roles loaded."))}</li>`;
    return;
  }

  rolesList.innerHTML = roles.map((role) => `<li>${escapeHtml(role)}</li>`).join("");
}

async function loadUserContext() {
  try {
    const data = await fetchJson("/api/user-context");
    userNameField.value = data.user || "";
    renderRoles(data.roles || []);
  } catch (error) {
    userNameField.value = "";
    rolesList.innerHTML = `<li>${escapeHtml(error.message)}</li>`;
  }
}

async function loadRows(dictionaryName, requestedPage = 1) {
  activeDictionary = dictionaryName;
  const selected = dictionaries.find((item) => item.id === dictionaryName);
  tableTitle.textContent = selected ? selected.label : textValue("dictionaryDataTitle", "Dictionary data");
  setLoading();

  try {
    const data = await fetchJson(
      `/api/dictionaries/${encodeURIComponent(dictionaryName)}/rows?page=${requestedPage}&pageSize=${PAGE_SIZE}`
    );
    originalRows = data.rows || [];
    workingRows = JSON.parse(JSON.stringify(originalRows));
    pendingRowChanges = new Map();
    hasSavedChanges = false;
    currentPage = data.page || 1;
    totalPages = data.totalPages || 1;
    totalRows = data.totalRows || 0;
    renderTable(workingRows);
  } catch (error) {
    totalRows = 0;
    totalPages = 1;
    currentPage = 1;
    updatePaginationControls();
    setError(error.message);
  }
}

function applyMeta(meta) {
  dictionaries = meta.dictionaries || [];

  dictionarySelect.innerHTML = dictionaries
    .map((dictionary) => `<option value="${dictionary.id}">${dictionary.label}</option>`)
    .join("");

  dictionarySelect.insertAdjacentHTML(
    "afterbegin",
    `<option value="" selected data-placeholder="true">${escapeHtml(
      textValue("selectDictionaryOption", "Select dictionary")
    )}</option>`
  );

  tableTitle.textContent = textValue("selectDictionaryTitle", "Select dictionary");
  tableMeta.textContent = textValue("rowsInitial", "Rows: 0");
  currentPage = 1;
  totalPages = 1;
  totalRows = 0;
  updatePaginationControls();
  setLoading(textValue("selectDictionaryPrompt", "Select Dictionary Name to load data."));
  updateActionButtons();
}

function openEditDialog(rowIndex) {
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= workingRows.length) {
    return;
  }

  editRowIndex = rowIndex;
  editedDraft = JSON.parse(JSON.stringify(workingRows[rowIndex]));
  modalOriginalDraft = JSON.parse(JSON.stringify(workingRows[rowIndex]));

  const fields = Object.keys(editedDraft)
    .map((key) => {
      const value = editedDraft[key] == null ? "" : String(editedDraft[key]);
      const isLong = value.length > LONG_TEXT_THRESHOLD;
      const control = isLong
        ? `<textarea data-field="${escapeHtml(key)}">${escapeHtml(value)}</textarea>`
        : `<input data-field="${escapeHtml(key)}" value="${escapeHtml(value)}" />`;

      return `<div class="edit-field"><label>${escapeHtml(key)}</label>${control}</div>`;
    })
    .join("");

  editFields.innerHTML = fields;
  rowSaveButton.disabled = true;
  editDialog.showModal();
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

function updateModalSaveState() {
  rowSaveButton.disabled = !isModalDirty();
}

function saveModalChanges() {
  if (editRowIndex < 0 || !editedDraft) {
    editDialog.close();
    return;
  }

  if (!isModalDirty()) {
    editDialog.close();
    return;
  }

  editedDraft = collectDraftFromModal();
  workingRows[editRowIndex] = editedDraft;

  const original = JSON.stringify(originalRows[editRowIndex] || {});
  const current = JSON.stringify(editedDraft || {});
  if (original === current) {
    pendingRowChanges.delete(editRowIndex);
  } else {
    pendingRowChanges.set(editRowIndex, true);
  }

  hasSavedChanges = false;
  renderTable(workingRows);
  modalOriginalDraft = null;
  editDialog.close();
}

function handleModalCancel() {
  if (!isModalDirty()) {
    modalOriginalDraft = null;
    editDialog.close();
    return;
  }

  const shouldDiscard = window.confirm(textValue("discardUnsavedConfirm", "Discard unsaved changes?"));
  if (shouldDiscard) {
    modalOriginalDraft = null;
    editDialog.close();
  }
}

function discardAllChanges() {
  workingRows = JSON.parse(JSON.stringify(originalRows));
  pendingRowChanges = new Map();
  hasSavedChanges = false;
  renderTable(workingRows);
}

function saveAllChanges() {
  if (pendingRowChanges.size === 0) {
    return;
  }

  originalRows = JSON.parse(JSON.stringify(workingRows));
  pendingRowChanges = new Map();
  hasSavedChanges = true;
  renderTable(workingRows);
}

function publishChanges() {
  if (!hasSavedChanges) {
    return;
  }

  window.alert(textValue("publishNotReady", "Publish flow will be enabled in next iteration."));
}

function handleTableClick(event) {
  const button = event.target.closest(".row-edit-btn");
  if (!button) {
    return;
  }

  const rowIndex = Number.parseInt(button.getAttribute("data-row-index"), 10);
  openEditDialog(rowIndex);
}

function handleAccountToggle() {
  const hidden = accountPanel.classList.toggle("hidden");
  accountToggle.setAttribute("aria-expanded", (!hidden).toString());
}

async function initialize() {
  applyStaticConfig();
  setLoading(textValue("loadingWorkspace", "Loading workspace..."));

  try {
    const meta = await fetchJson("/api/meta");
    applyMeta(meta);
    await loadUserContext();
  } catch (error) {
    setError(error.message);
  }
}

dictionarySelect.addEventListener("change", (event) => {
  if (!event.target.value) {
    activeDictionary = "";
    tableTitle.textContent = textValue("selectDictionaryTitle", "Select dictionary");
    tableMeta.textContent = textValue("rowsInitial", "Rows: 0");
    currentPage = 1;
    totalPages = 1;
    totalRows = 0;
    updatePaginationControls();
    setLoading(textValue("selectDictionaryPrompt", "Select Dictionary Name to load data."));
    return;
  }

  const placeholder = dictionarySelect.querySelector('option[data-placeholder="true"]');
  if (placeholder) {
    placeholder.remove();
  }

  loadRows(event.target.value, 1);
});

prevPageButton.addEventListener("click", () => {
  if (!activeDictionary || currentPage <= 1) {
    return;
  }

  loadRows(activeDictionary, currentPage - 1);
});

nextPageButton.addEventListener("click", () => {
  if (!activeDictionary || currentPage >= totalPages) {
    return;
  }

  loadRows(activeDictionary, currentPage + 1);
});

saveButton.addEventListener("click", saveAllChanges);
discardButton.addEventListener("click", discardAllChanges);
publishButton.addEventListener("click", publishChanges);
accountToggle.addEventListener("click", handleAccountToggle);
tableContainer.addEventListener("click", handleTableClick);
rowSaveButton.addEventListener("click", saveModalChanges);
rowCancelButton.addEventListener("click", handleModalCancel);
editFields.addEventListener("input", updateModalSaveState);
editDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  handleModalCancel();
});

document.addEventListener("click", (event) => {
  if (!accountPanel.classList.contains("hidden") && !event.target.closest(".account-wrap")) {
    accountPanel.classList.add("hidden");
    accountToggle.setAttribute("aria-expanded", "false");
  }
});

initialize();
