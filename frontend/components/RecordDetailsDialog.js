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
	// Filtruj kolumny
	const visibleCols = techColumns
		.map((col, idx) => ({
			tech: col,
			business: businessHeaders[idx]
		}))
		.filter(colObj => !hiddenFields.includes(colObj.tech));

	// Renderuj tabelę 4-kolumnową z nagłówkami nad wartościami
	let tableHtml = '<table><tbody>';
	for (let i = 0; i < visibleCols.length; i += 4) {
		// Wiersz nagłówków
		tableHtml += '<tr>';
		for (let j = 0; j < 4; j++) {
			const colObj = visibleCols[i + j];
			if (colObj) {
				tableHtml += `<td><div class=\"record-details-label\" data-label=\"${escapeHtml(colObj.business)}\">${escapeHtml(colObj.business)}</div></td>`;
			} else {
				tableHtml += '<td></td>';
			}
		}
		tableHtml += '</tr>';
		// Wiersz wartości
		tableHtml += '<tr>';
		for (let j = 0; j < 4; j++) {
			const colObj = visibleCols[i + j];
			if (colObj) {
				const value = row[colObj.tech] == null ? "" : String(row[colObj.tech]);
				tableHtml += `<td><div class=\"record-details-section\"><div class=\"record-details-value\">${escapeHtml(value)}</div></div></td>`;
			} else {
				tableHtml += '<td></td>';
			}
		}
		tableHtml += '</tr>';
	}
	tableHtml += '</tbody></table>';
	recordDetailsFields.innerHTML = tableHtml;
	// Przesuwam tytuł Version History na lewo
	const recordDetailsTitle = document.getElementById("recordDetailsTitle");
	if (recordDetailsTitle) {
		recordDetailsTitle.style.textAlign = "left";
		recordDetailsTitle.style.justifySelf = "start";
	}
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
