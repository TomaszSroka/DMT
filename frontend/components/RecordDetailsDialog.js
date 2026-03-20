// RecordDetailsDialog.js
// Handles the Record Details dialog UI and logic

let recordDetailsDialog, recordDetailsFields, recordDetailsCloseButton;

export function setupRecordDetailsDialog() {
	recordDetailsDialog = document.getElementById("recordDetailsDialog");
	recordDetailsFields = document.getElementById("recordDetailsFields");
	recordDetailsCloseButton = document.getElementById("recordDetailsCloseButton");
	const recordDetailsTitle = document.getElementById("recordDetailsTitle");
	if (recordDetailsTitle) recordDetailsTitle.textContent = "Version History";
	if (recordDetailsCloseButton && recordDetailsDialog) {
		recordDetailsCloseButton.addEventListener("click", () => recordDetailsDialog.close());
	}
}

export function showRecordDetailsDialog(row, columns) {
	if (!row || !Array.isArray(columns)) return;
	// Pola do ukrycia
	const hiddenFields = [
		"DICTIONARY_KEY",
		"DICTIONARY_SORT_ORDER",
		"DICTIONARY_VERSION_KEY",
		"DICTIONARY_VERSION_CODE",
		"DICTIONARY_LOCATION"
	];
	const businessHeaders = columns.map(colObj =>
		typeof colObj === "object" && colObj !== null && typeof colObj.DICTIONARY_COLUMN_BUSINESS === "string"
			? colObj.DICTIONARY_COLUMN_BUSINESS
			: (typeof colObj === "object" && colObj !== null ? colObj.DICTIONARY_COLUMN_TECHNICAL : String(colObj))
	);
	const techColumns = columns.map(colObj =>
		typeof colObj === "object" && colObj !== null
			? colObj.DICTIONARY_COLUMN_TECHNICAL
			: String(colObj)
	);
	const fields = techColumns.map((col, idx) => {
		if (hiddenFields.includes(col)) return "";
		const colLabel = businessHeaders[idx];
		const value = row[col] == null ? "" : String(row[col]);
		return `<div class="record-details-section"><div class="record-details-label">${escapeHtml(colLabel)}</div><div class="record-details-value">${escapeHtml(value)}</div></div>`;
	}).filter(Boolean);
	recordDetailsFields.innerHTML = fields.join("");
	recordDetailsDialog.showModal();
}

function escapeHtml(str) {
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}
