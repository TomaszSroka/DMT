/**
 * MainTable.render.js
 *
 * Rendering helpers extracted from MainTable controller to keep
 * state/query logic separate from HTML generation.
 */

export function buildInlineCreateRowHtml(technicalColumns, uiTexts, escapeHtml) {
  const actionCell = `
    <td class="table-action-cell inline-add-actions-cell">
      <div class="inline-add-actions">
        <button type="button" class="btn btn-discard show-row-btn" data-inline-add-open>${escapeHtml(uiTexts.addRowSave || 'Add')}</button>
      </div>
    </td>
  `;

  const cells = technicalColumns
    .map((columnName) => {
      if (columnName === 'KEY') {
        return `<td><input type="text" class="inline-add-control" value="${escapeHtml(uiTexts.addRowAutoValue || 'Auto')}" disabled /></td>`;
      }

      return '<td><input type="text" class="inline-add-control" value="" disabled /></td>';
    })
    .join('');

  return `<tr class="inline-add-row">${actionCell}${cells}</tr>`;
}

export function buildTableHead({ technicalColumns, businessHeaders, currentSortColumn, currentSortDirection, uiTexts, escapeHtml }) {
  return `<th class="table-action-header">${escapeHtml(uiTexts.tableActionHeader || 'Action')}</th>${businessHeaders
    .map((header, idx) => {
      const sortColumn = String(technicalColumns[idx] || '').toUpperCase();
      const isActiveSort = currentSortColumn === sortColumn;
      const sortMark = isActiveSort ? (currentSortDirection === 'DESC' ? ' ▼' : ' ▲') : '';
      return `<th><button type="button" class="th-sort-btn" data-sort-column="${escapeHtml(sortColumn)}">${escapeHtml(header)}${sortMark}</button></th>`;
    })
    .join('')}`;
}

export function buildTableBody({
  rows,
  technicalColumns,
  noWrapColumns,
  rowActionLabel,
  uiTexts,
  escapeHtml,
  inlineCreateRowHtml,
  truncateValueWithoutEllipsis,
  maxCellChars
}) {
  const rowsHtml = rows
    .map((row, rowIndex) => {
      const actionCell = `<td class="table-action-cell"><button type="button" class="btn btn-discard show-row-btn" data-row-index="${rowIndex}">${escapeHtml(
        rowActionLabel || uiTexts.showRowButton || 'Show'
      )}</button></td>`;
      const cells = technicalColumns
        .map((columnName) => {
          const fullValue = row[columnName] == null ? '' : String(row[columnName]);
          const shortValue = truncateValueWithoutEllipsis(fullValue, maxCellChars);
          const classNames = [];
          if (noWrapColumns.has(columnName)) {
            classNames.push('col-nowrap-short');
          }

          const classAttr = classNames.length > 0 ? ` class="${classNames.join(' ')}"` : '';
          return `<td${classAttr}>${escapeHtml(shortValue)}</td>`;
        })
        .join('');
      return `<tr>${actionCell}${cells}</tr>`;
    })
    .join('');

  return `${inlineCreateRowHtml || ''}${rowsHtml}`;
}
