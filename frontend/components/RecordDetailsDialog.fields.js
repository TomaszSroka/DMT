export const KEY_COLUMN_NAME = 'KEY';

export function getOrderedRecordFields(row, columns) {
  const safeRow = row && typeof row === 'object' ? row : {};

  if (Array.isArray(columns) && columns.length > 0) {
    return columns
      .map((columnDef) => {
        const technical =
          columnDef && typeof columnDef.DICTIONARY_COLUMN_TECHNICAL === 'string'
            ? columnDef.DICTIONARY_COLUMN_TECHNICAL
            : '';
        if (!technical) {
          return null;
        }

        return {
          technical,
          business:
            columnDef && typeof columnDef.DICTIONARY_COLUMN_BUSINESS === 'string' && columnDef.DICTIONARY_COLUMN_BUSINESS.trim().length > 0
              ? columnDef.DICTIONARY_COLUMN_BUSINESS
              : technical
        };
      })
      .filter(Boolean);
  }

  return Object.keys(safeRow).map((key) => ({ technical: key, business: key }));
}

export function getVisibleRecordFields(orderedFields, maxVisibleFields) {
  const safeFields = Array.isArray(orderedFields) ? orderedFields : [];
  const maxVisible = Number.isFinite(Number(maxVisibleFields)) ? Number(maxVisibleFields) : 20;

  const keyField = safeFields.find((field) => field && field.technical === KEY_COLUMN_NAME);
  const regularFields = safeFields.filter((field) => field && field.technical !== KEY_COLUMN_NAME);
  const limitedRegularFields = regularFields.slice(0, maxVisible);

  return [...limitedRegularFields, ...(keyField ? [keyField] : [])];
}
