const FRONTEND_RUNTIME_CONFIG = window.FRONTEND_RUNTIME_CONFIG || {};
const UI_TEXT = FRONTEND_RUNTIME_CONFIG.text || {};
const UI_DEFAULTS = FRONTEND_RUNTIME_CONFIG.defaults || {};
const UI_TYPOGRAPHY = FRONTEND_RUNTIME_CONFIG.typography || {};

const dictionarySelect = document.getElementById("dictionarySelect");
const tableContainer = document.getElementById("tableContainer");
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
const dictionaryVersionLabel = document.getElementById("dictionaryVersionLabel");
const dictionaryVersionSelect = document.getElementById("dictionaryVersionSelect");
const appTitle = document.getElementById("appTitle");
const editDialog = document.getElementById("editDialog");
const editFields = document.getElementById("editFields");
const editDialogTitle = document.getElementById("editDialogTitle");
const rowSaveButton = document.getElementById("rowSaveButton");
const rowCancelButton = document.getElementById("rowCancelButton");
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

const MAX_CELL_CHARS = UI_DEFAULTS.maxCellChars;
const PAGE_SIZE = UI_DEFAULTS.pageSize;
const LONG_TEXT_THRESHOLD = UI_DEFAULTS.longTextThreshold;
const USER_DETAILS_DROPDOWN_THRESHOLD = UI_DEFAULTS.userDetailsDropdownThreshold;
const HIDDEN_COLUMNS = new Set(UI_DEFAULTS.hiddenColumns || []);

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

function textValue(key) {
  return UI_TEXT[key] || `[${key}]`;
}

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
  accountToggle.textContent = textValue("accountButton");
  userNameLabel.textContent = textValue("userLabel");
  rolesLabel.textContent = textValue("rolesLabel");
  dictionaryLabel.textContent = textValue("dictionaryLabel");
  dictionaryVersionLabel.textContent = textValue("dictionaryVersionLabel");
  dictionarySelect.setAttribute("aria-label", textValue("dictionarySelectorAriaLabel"));
  dictionaryVersionSelect.setAttribute("aria-label", textValue("dictionaryVersionSelectorAriaLabel"));
  saveButton.textContent = textValue("save");
  discardButton.textContent = textValue("discard");
  publishButton.textContent = textValue("publish");
  prevPageButton.textContent = textValue("previous");
  nextPageButton.textContent = textValue("next");
  rowSaveButton.textContent = textValue("save");
  rowCancelButton.textContent = textValue("cancel");
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
  editDialogTitle.textContent = textValue("editRecordTitle");
  tableMeta.textContent = textValue("rowsInitial");
  pageInfo.textContent = textValue("pageInfoInitial");
  resetDictionaryVersionSelect();

  if (UI_TYPOGRAPHY.primaryFont) {
    document.documentElement.style.setProperty("--font-primary", UI_TYPOGRAPHY.primaryFont);
  }
  if (UI_TYPOGRAPHY.monoFont) {
    document.documentElement.style.setProperty("--font-mono", UI_TYPOGRAPHY.monoFont);
  }
}

function formatRowsMeta(visibleRowsCount, allRowsCount) {
  return `${textValue("rowsLabel")}: ${visibleRowsCount} / ${allRowsCount}`;
}

function formatPagesMeta(page, pages) {
  return `${textValue("pageLabel")}: ${page} / ${pages}`;
}

function setLoading(message = textValue("loadingData")) {
  tableContainer.innerHTML = `<div class="empty-state">${message}</div>`;
}

function setError(message) {
  tableContainer.innerHTML = `<div class="error-state">${message}</div>`;
}

function resetDictionaryVersionSelect() {
  dictionaryVersions = [];
  selectedDictionaryVersionKey = "";
  currentSnapshotToken = "";
  dictionaryVersionSelect.innerHTML = `<option value="">${escapeHtml(textValue("dictionaryVersionDisabledOption"))}</option>`;
  dictionaryVersionSelect.disabled = true;
}

function setDictionaryVersionLoading() {
  selectedDictionaryVersionKey = "";
  currentSnapshotToken = "";
  dictionaryVersionSelect.innerHTML = `<option value="">${escapeHtml(textValue("dictionaryVersionLoadingOption"))}</option>`;
  dictionaryVersionSelect.disabled = true;
}

function populateDictionaryVersions(versions) {
  dictionaryVersions = Array.isArray(versions) ? versions : [];

  if (dictionaryVersions.length === 0) {
    dictionaryVersionSelect.innerHTML = `<option value="">${escapeHtml(textValue("dictionaryVersionEmptyOption"))}</option>`;
    dictionaryVersionSelect.disabled = true;
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
}

function updatePaginationControls() {
  const hasVersionSelection = Boolean(selectedDictionaryVersionKey);
  pageInfo.textContent = formatPagesMeta(currentPage, totalPages);
  prevPageButton.disabled = !activeDictionary || !hasVersionSelection || currentPage <= 1;
  nextPageButton.disabled = !activeDictionary || !hasVersionSelection || currentPage >= totalPages;
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

function isHiddenColumn(columnName) {
  return HIDDEN_COLUMNS.has(String(columnName || "").trim().toUpperCase());
}

function getVisibleColumnsFromRow(row) {
  return Object.keys(row || {}).filter((column) => !isHiddenColumn(column));
}

function updateActionButtons() {
  const hasPending = pendingRowChanges.size > 0;
  saveButton.disabled = !currentDictionaryCanUpdate || !hasPending;
  discardButton.disabled = !currentDictionaryCanUpdate || !hasPending;
  publishButton.disabled = !hasSavedChanges;
}

function renderTable(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    tableContainer.innerHTML = `<div class="empty-state">${textValue("noRowsReturned")}</div>`;
    tableMeta.textContent = formatRowsMeta(0, totalRows);
    updateActionButtons();
    updatePaginationControls();
    return;
  }

  const columns = getVisibleColumnsFromRow(rows[0]);
  const head = `<th>${escapeHtml(textValue("tableActionHeader"))}</th>${columns
    .map((col) => `<th>${escapeHtml(col)}</th>`)
    .join("")}`;

  const body = rows
    .map((row, rowIndex) => {
      const rowActionLabel = currentDictionaryCanUpdate
        ? textValue("editRowButton")
        : textValue("showRowButton");
      const disabledAttr = currentDictionaryCanUpdate ? "" : "disabled";
      const actionCell = `<td><button class="row-edit-btn" data-row-index="${rowIndex}" ${disabledAttr}>${escapeHtml(
        rowActionLabel
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
    throw new Error(textValue("nonJsonApiError"));
  }

  if (!response.ok) {
    throw new Error(payload.error || textValue("unknownApiError"));
  }

  return payload;
}

function renderRoles(dictionaryRoles) {
  if (!Array.isArray(dictionaryRoles) || dictionaryRoles.length === 0) {
    rolesList.innerHTML = `<li>${escapeHtml(textValue("noRolesLoaded"))}</li>`;
    return;
  }

  const labels = dictionaryRoles.map((item) => {
    const dictionary = item && typeof item.dictionary === "string" ? item.dictionary : "";
    const role = item && typeof item.role === "string" ? item.role : "";
    return dictionary && role ? `${dictionary} - ${role}` : dictionary || role;
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
    userNameField.value = data.user || "";
    renderRoles(data.dictionaryRoles || []);
  } catch (error) {
    userNameField.value = "";
    rolesList.innerHTML = `<li>${escapeHtml(error.message)}</li>`;
  }
}

async function loadRows(dictionaryName, requestedPage = 1, dictionaryInstanceKey = "") {
  activeDictionary = dictionaryName;
  const selected = dictionaries.find((item) => item.id === dictionaryName);
  currentDictionaryCanUpdate = Boolean(selected && selected.canUpdate);

  const normalizedVersionKey = String(dictionaryInstanceKey || "").trim();
  if (!normalizedVersionKey) {
    totalRows = 0;
    totalPages = 1;
    currentPage = 1;
    currentSnapshotToken = "";
    updatePaginationControls();
    setLoading(textValue("selectDictionaryVersionPrompt"));
    return;
  }

  selectedDictionaryVersionKey = normalizedVersionKey;
  setLoading();

  try {
    const data = await fetchJson(
      `/api/dictionaries/${encodeURIComponent(dictionaryName)}/rows?page=${requestedPage}&pageSize=${PAGE_SIZE}&dictionaryInstanceKey=${encodeURIComponent(normalizedVersionKey)}`
    );
    originalRows = data.rows || [];
    workingRows = JSON.parse(JSON.stringify(originalRows));
    pendingRowChanges = new Map();
    hasSavedChanges = false;
    currentPage = data.page || 1;
    totalPages = data.totalPages || 1;
    totalRows = data.totalRows || 0;
    currentDictionaryCanUpdate = Boolean(data.canUpdate);
    currentSnapshotToken = typeof data.snapshotToken === "string" ? data.snapshotToken : "";
    renderTable(workingRows);
  } catch (error) {
    selectedDictionaryVersionKey = "";
    currentSnapshotToken = "";
    currentDictionaryCanUpdate = false;
    totalRows = 0;
    totalPages = 1;
    currentPage = 1;
    updatePaginationControls();
    setError(error.message);
  }
}

async function fetchSnapshotToken(dictionaryName, requestedPage, dictionaryInstanceKey) {
  const data = await fetchJson(
    `/api/dictionaries/${encodeURIComponent(dictionaryName)}/rows?page=${requestedPage}&pageSize=${PAGE_SIZE}&dictionaryInstanceKey=${encodeURIComponent(dictionaryInstanceKey)}`
  );

  return typeof data.snapshotToken === "string" ? data.snapshotToken : "";
}

async function loadDictionaryVersions(dictionaryName) {
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
      textValue("selectDictionaryOption")
    )}</option>`
  );

  tableMeta.textContent = textValue("rowsInitial");
  currentDictionaryCanUpdate = false;
  currentPage = 1;
  totalPages = 1;
  totalRows = 0;
  updatePaginationControls();
  setLoading(textValue("selectDictionaryPrompt"));
  updateActionButtons();
  resetDictionaryVersionSelect();
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

function openEditDialog(rowIndex) {
  if (!currentDictionaryCanUpdate) {
    return;
  }

  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= workingRows.length) {
    return;
  }

  editRowIndex = rowIndex;
  editedDraft = normalizeRowForModal(workingRows[rowIndex]);
  modalOriginalDraft = normalizeRowForModal(workingRows[rowIndex]);

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
      return `<li><strong>${escapeHtml(item.field)}</strong>: ${escapeHtml(oldText)} -> ${escapeHtml(newText)}</li>`;
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
    false
  );
}

function updateModalSaveState() {
  rowSaveButton.disabled = !isModalDirty();
}

async function saveModalChanges() {
  if (editRowIndex < 0 || !editedDraft) {
    editDialog.close();
    return;
  }

  if (!isModalDirty()) {
    editDialog.close();
    return;
  }

  const changes = getModalChanges();
  const shouldSave = await askSaveWithChanges(changes);
  if (!shouldSave) {
    return;
  }

  editedDraft = collectDraftFromModal();
  workingRows[editRowIndex] = {
    ...(workingRows[editRowIndex] || {}),
    ...editedDraft
  };

  const original = JSON.stringify(normalizeRowForModal(originalRows[editRowIndex] || {}));
  const current = JSON.stringify(normalizeRowForModal(workingRows[editRowIndex] || {}));
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

async function handleModalCancel() {
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
  if (!currentDictionaryCanUpdate) {
    return;
  }

  if (pendingRowChanges.size > 0) {
    const shouldDiscardAll = await askDiscardAllWithChanges([]);
    if (!shouldDiscardAll) {
      return;
    }
  }

  workingRows = JSON.parse(JSON.stringify(originalRows));
  pendingRowChanges = new Map();
  hasSavedChanges = false;
  renderTable(workingRows);
}

async function saveAllChanges() {
  if (!currentDictionaryCanUpdate) {
    return;
  }

  if (pendingRowChanges.size === 0) {
    return;
  }

  try {
    const latestSnapshotToken = await fetchSnapshotToken(activeDictionary, currentPage, selectedDictionaryVersionKey);
    if (currentSnapshotToken && latestSnapshotToken && latestSnapshotToken !== currentSnapshotToken) {
      window.alert(textValue("optimisticLockConflict"));
      return;
    }
  } catch (error) {
    window.alert(error.message || textValue("unknownApiError"));
    return;
  }

  const changes = getPendingChanges();
  const shouldSave = await askSaveWithChanges(changes);
  if (!shouldSave) {
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

  window.alert(textValue("publishNotReady"));
}

function handleTableClick(event) {
  const button = event.target.closest(".row-edit-btn");
  if (!button) {
    return;
  }

  if (button.disabled || !currentDictionaryCanUpdate) {
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
  setLoading(textValue("loadingWorkspace"));

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
    currentDictionaryCanUpdate = false;
    pendingRowChanges = new Map();
    hasSavedChanges = false;
    tableMeta.textContent = textValue("rowsInitial");
    currentPage = 1;
    totalPages = 1;
    totalRows = 0;
    updatePaginationControls();
    setLoading(textValue("selectDictionaryPrompt"));
    resetDictionaryVersionSelect();
    return;
  }

  const placeholder = dictionarySelect.querySelector('option[data-placeholder="true"]');
  if (placeholder) {
    placeholder.remove();
  }

  activeDictionary = event.target.value;
  loadDictionaryVersions(event.target.value);
});

dictionaryVersionSelect.addEventListener("change", (event) => {
  const versionKey = String(event.target.value || "").trim();
  selectedDictionaryVersionKey = versionKey;

  if (versionKey) {
    const placeholder = dictionaryVersionSelect.querySelector('option[data-placeholder="true"]');
    if (placeholder) {
      placeholder.remove();
    }
  }

  if (!activeDictionary || !versionKey) {
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

