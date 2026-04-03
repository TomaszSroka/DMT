function getClosestFromEventTarget(target, selector) {
  if (target instanceof Element) {
    return target.closest(selector);
  }

  if (target && target.parentElement instanceof Element) {
    return target.parentElement.closest(selector);
  }

  return null;
}

export function bindMainTableEvents({
  prevPageButton,
  nextPageButton,
  tableContainer,
  state,
  loadRows,
  onAddRequested,
  onDetailsRequested,
  defaultSortDirection
}) {
  if (prevPageButton) {
    prevPageButton.addEventListener('click', () => {
      if (state.currentPage <= 1) {
        return;
      }
      loadRows(state.currentPage - 1);
    });
  }

  if (nextPageButton) {
    nextPageButton.addEventListener('click', () => {
      if (state.currentPage >= state.totalPages) {
        return;
      }
      loadRows(state.currentPage + 1);
    });
  }

  if (!tableContainer) {
    return;
  }

  tableContainer.addEventListener('click', (event) => {
    const inlineAddOpenButton = getClosestFromEventTarget(event.target, '[data-inline-add-open]');
    if (inlineAddOpenButton) {
      if (typeof onAddRequested === 'function') {
        onAddRequested(state.columns);
      }
      return;
    }

    const detailsButton = getClosestFromEventTarget(event.target, '[data-row-index]');
    if (detailsButton) {
      const rowIndex = Number.parseInt(detailsButton.getAttribute('data-row-index') || '', 10);
      if (Number.isInteger(rowIndex) && state.rows[rowIndex]) {
        if (typeof onDetailsRequested === 'function') {
          onDetailsRequested(state.rows[rowIndex], state.columns);
        }
      }
      return;
    }

    const sortButton = getClosestFromEventTarget(event.target, '[data-sort-column]');
    if (!sortButton) {
      return;
    }

    if (!state.selectedDictionaryVersionKey || !state.activeDictionary) {
      return;
    }

    const sortColumn = String(sortButton.getAttribute('data-sort-column') || '').trim().toUpperCase();
    if (!sortColumn) {
      return;
    }

    if (state.currentSortColumn === sortColumn) {
      state.currentSortDirection = state.currentSortDirection === 'ASC' ? 'DESC' : 'ASC';
    } else {
      state.currentSortColumn = sortColumn;
      state.currentSortDirection = defaultSortDirection;
    }

    loadRows(1);
  });
}
