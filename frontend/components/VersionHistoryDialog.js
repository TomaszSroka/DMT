/**
 * VersionHistoryDialog.js
 *
 * Manages the Version History dialog for dictionary version rows.
 * - Sets up dialog elements and event listeners.
 * - Renders and displays version history rows in a modal table.
 * Usage: Call setupVersionHistoryDialog() and showVersionHistoryDialog(row, columns) as needed.
 */

import { uiTexts } from '../config/ui-texts.js';
import { escapeHtml } from '../utils/ui-helpers.js';

function getDialogRefs() {
	const dialog = document.getElementById("recordDetailsDialog");
	const fields = document.getElementById("recordDetailsFields");
	const closeButton = document.getElementById("recordDetailsCloseButton");
	const title = document.getElementById("recordDetailsTitle");

	return {
		dialog,
		fields,
		closeButton,
		title
	};
}

export function setupVersionHistoryDialog() {
	const { dialog, closeButton, title } = getDialogRefs();
	if (title) {
		title.textContent = uiTexts.showVersionDetails || 'Versions';
	}

	if (closeButton && dialog && closeButton.dataset.vhBound !== '1') {
		closeButton.addEventListener("click", () => dialog.close());
		closeButton.dataset.vhBound = '1';
	}
}

export function showVersionHistoryDialog(row, columns) {
	// Fields to hide
	const hiddenFields = [
		"DICTIONARY_KEY",
		"DICTIONARY_LOCATION",
		"DICTIONARY_SORT_ORDER",
		"DICTIONARY_VERSION_KEY",
		"DICTIONARY_VERSION_CODE",
		"USER_KEY"
	];

	// Handling multiple versions: row can be an array or an object
	const rows = Array.isArray(row) ? row : [row];
	if (!rows.length || !Array.isArray(columns)) return;

	const { dialog, fields, title } = getDialogRefs();
	if (!dialog || !fields) {
		return;
	}

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
	fields.innerHTML = tableHtml;
	if (title) {
		title.style.textAlign = "left";
		title.style.justifySelf = "start";
	}
	dialog.showModal();
}
