// Backup pliku app.js z dnia 20.03.2026
[pełna zawartość pliku app.js poniżej]
// --- Record Details Dialog ---
let recordDetailsDialog, recordDetailsFields, recordDetailsCloseButton;
document.addEventListener("DOMContentLoaded", () => {
	recordDetailsDialog = document.getElementById("recordDetailsDialog");
	recordDetailsFields = document.getElementById("recordDetailsFields");
	recordDetailsCloseButton = document.getElementById("recordDetailsCloseButton");
	if (recordDetailsCloseButton && recordDetailsDialog) {
		recordDetailsCloseButton.addEventListener("click", () => recordDetailsDialog.close());
	}
});

function showRecordDetailsDialog(rowIndex) {
	const row = workingRows[rowIndex];
	if (!row || !Array.isArray(currentTableColumns)) return;
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
	const fields = columns.map((col, idx) => {
		const colLabel = businessHeaders[idx];
		const value = row[col] == null ? "" : String(row[col]);
		return `<div class="record-details-section"><div class="record-details-label">${escapeHtml(colLabel)}</div><div class="record-details-value">${escapeHtml(value)}</div></div>`;
	});
	recordDetailsFields.innerHTML = fields.join("");
	recordDetailsDialog.showModal();
}

// ...existing code...
