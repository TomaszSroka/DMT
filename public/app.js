const dictionarySelect = document.getElementById("dictionarySelect");
const tableContainer = document.getElementById("tableContainer");
const tableTitle = document.getElementById("tableTitle");
const tableMeta = document.getElementById("tableMeta");
const discardButton = document.getElementById("discardButton");
const saveButton = document.getElementById("saveButton");
const publishButton = document.getElementById("publishButton");
const accountToggle = document.getElementById("accountToggle");
const accountPanel = document.getElementById("accountPanel");
const userNameField = document.getElementById("userNameField");
const rolesList = document.getElementById("rolesList");
const editDialog = document.getElementById("editDialog");
const editFields = document.getElementById("editFields");
const rowSaveButton = document.getElementById("rowSaveButton");
const rowCancelButton = document.getElementById("rowCancelButton");

const MAX_CELL_CHARS = 120;

let activeDictionary = "";
let dictionaries = [];
let originalRows = [];
let workingRows = [];
let pendingRowChanges = new Map();
let hasSavedChanges = false;
let editRowIndex = -1;
let editedDraft = null;
let modalOriginalDraft = null;

function setLoading(message = "Loading data...") {
  tableContainer.innerHTML = `<div class="empty-state">${message}</div>`;
}

function setError(message) {
  tableContainer.innerHTML = `<div class="error-state">${message}</div>`;
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
    tableContainer.innerHTML = "<div class=\"empty-state\">No rows returned.</div>";
    tableMeta.textContent = "Rows: 0";
    updateActionButtons();
    return;
  }

  const columns = Object.keys(rows[0]);
  const head = `<th>Action</th>${columns.map((col) => `<th>${escapeHtml(col)}</th>`).join("")}`;

  const body = rows
    .map((row, rowIndex) => {
      const actionCell = `<td><button class="row-edit-btn" data-row-index="${rowIndex}">Edit</button></td>`;
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
  tableMeta.textContent = `Rows: ${rows.length}`;
  updateActionButtons();
}

async function fetchJson(url) {
  const response = await fetch(url);
  const raw = await response.text();

  let payload;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch (error) {
    throw new Error(
      "API returned non-JSON response. Open app via http://localhost:3000 and ensure backend is running."
    );
  }

  if (!response.ok) {
    throw new Error(payload.error || "Unknown API error");
  }

  return payload;
}

function renderRoles(roles) {
  if (!Array.isArray(roles) || roles.length === 0) {
    rolesList.innerHTML = "<li>No roles loaded.</li>";
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

async function loadRows(dictionaryName) {
  activeDictionary = dictionaryName;
  const selected = dictionaries.find((item) => item.id === dictionaryName);
  tableTitle.textContent = selected ? selected.label : "Dictionary data";
  setLoading();

  try {
    const data = await fetchJson(`/api/dictionaries/${encodeURIComponent(dictionaryName)}/rows?limit=200`);
    originalRows = data.rows || [];
    workingRows = JSON.parse(JSON.stringify(originalRows));
    pendingRowChanges = new Map();
    hasSavedChanges = false;
    renderTable(workingRows);
  } catch (error) {
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
    '<option value="" selected>Select dictionary</option>'
  );

  tableTitle.textContent = "Select dictionary";
  tableMeta.textContent = "Rows: 0";
  setLoading("Select Dictionary Name to load data.");
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
      const isLong = value.length > 90;
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

  const shouldDiscard = window.confirm("Discard unsaved changes?");
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

  alert("Publish flow will be enabled in next iteration.");
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
  setLoading("Loading workspace...");

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
    tableTitle.textContent = "Select dictionary";
    tableMeta.textContent = "Rows: 0";
    setLoading("Select Dictionary Name to load data.");
    return;
  }

  loadRows(event.target.value);
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
