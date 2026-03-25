const { runQuery } = require("../../config/snowflake");
const { createAppError } = require("../../errors/app-error");
const { dictionaryVersionDetailsView } = require("./constants");
const { normalizeDictionaryName, extractSortOrderPhrase } = require("./helpers");
const { isSafeOrderByPhrase } = require("../table.validation");

async function getDictionaryVersionDetailsRowsForPermission(permission) {
  const sqlText = `
    SELECT *
    FROM ${dictionaryVersionDetailsView}
    WHERE UPPER(TRIM(DICTIONARY_KEY)) = ?
    ORDER BY DICTIONARY_VERSION_CODE DESC
  `;

  return runQuery(sqlText, [normalizeDictionaryName(permission.id)]);
}

function getDictionarySortOrderFromVersionRows(rows, dictionaryInstanceKey) {
  const normalizedKey = String(dictionaryInstanceKey || "").trim();
  const versionRow = (Array.isArray(rows) ? rows : []).find((row) => {
    const rowKey = row && row.DICTIONARY_VERSION_KEY != null ? String(row.DICTIONARY_VERSION_KEY).trim() : "";
    return rowKey === normalizedKey;
  });

  const phrase = extractSortOrderPhrase(versionRow);

  if (!phrase) {
    throw createAppError(
      "Dictionary sort order is required for selected version.",
      400,
      "DICTIONARY_SORT_ORDER_REQUIRED"
    );
  }

  if (!isSafeOrderByPhrase(phrase)) {
    throw createAppError(
      "Dictionary sort order is invalid for selected version.",
      400,
      "DICTIONARY_SORT_ORDER_INVALID"
    );
  }

  return phrase;
}

module.exports = {
  getDictionaryVersionDetailsRowsForPermission,
  getDictionarySortOrderFromVersionRows
};
