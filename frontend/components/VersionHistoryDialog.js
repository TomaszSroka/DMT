/**
 * VersionHistoryDialog.js
 *
 * Manages the Version History dialog for dictionary version rows.
 * - Sets up dialog elements and event listeners.
 * - Renders and displays version history rows in a modal table.
 * Usage: Call setupVersionHistoryDialog() and showVersionHistoryDialog(row, columns) as needed.
 */

let recordDetailsDialog, recordDetailsFields, recordDetailsCloseButton;

export function setupVersionHistoryDialog() {
	recordDetailsDialog = document.getElementById("recordDetailsDialog");
	recordDetailsFields = document.getElementById("recordDetailsFields");
	recordDetailsCloseButton = document.getElementById("recordDetailsCloseButton");
	const recordDetailsTitle = document.getElementById("recordDetailsTitle");
	if (recordDetailsTitle) recordDetailsTitle.textContent = "Versions";
	if (recordDetailsCloseButton && recordDetailsDialog) {
		recordDetailsCloseButton.addEventListener("click", () => recordDetailsDialog.close());
	}
}

export function showVersionHistoryDialog(row, columns) {
	// Fields to hide
	const hiddenFields = [
		"DICTIONARY_KEY",
		"DICTIONARY_SORT_ORDER",
		"DICTIONARY_VERSION_KEY",
		"DICTIONARY_VERSION_CODE",
		"DICTIONARY_LOCATION"
	];

	// Handling multiple versions: row can be an array or an object
	const rows = Array.isArray(row) ? row : [row];
	if (!rows.length || !Array.isArray(columns)) return;

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
	const visibleCols = techColumns
		.map((col, idx) => ({
			tech: col,
			business: businessHeaders[idx]
		}))
		.filter(colObj => !hiddenFields.includes(colObj.tech));

	// Render plain table (columns + rows) to match MainTable look.
	let tableHtml = '<table><thead><tr>';
	visibleCols.forEach(colObj => {
		tableHtml += `<th>${escapeHtml(colObj.business)}</th>`;
	});
	tableHtml += '</tr></thead><tbody>';
	rows.forEach(rowObj => {
		tableHtml += '<tr>';
		visibleCols.forEach(colObj => {
			const value = rowObj[colObj.tech] == null ? "" : String(rowObj[colObj.tech]);
			tableHtml += `<td>${escapeHtml(value)}</td>`;
		});
		tableHtml += '</tr>';
	});
	tableHtml += '</tbody></table>';
	recordDetailsFields.innerHTML = tableHtml;
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
