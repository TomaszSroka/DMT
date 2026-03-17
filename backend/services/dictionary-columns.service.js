// backend/services/dictionary-columns.service.js
const { runQuery } = require("../config/snowflake");

/**
 * Pobiera definicje kolumn (nazwy biznesowe i kolejność) dla danej wersji słownika
 * @param {string} dictionaryKey
 * @param {string} dictionaryVersionKey
 * @returns {Promise<Array<{ name: string, businessName: string, position: number }>>}
 */
async function getDictionaryColumns(dictionaryKey, dictionaryVersionKey) {
  const sql = `
    SELECT DICTIONARY_COLUMN_TECHNICAL,
           DICTIONARY_COLUMN_BUSINESS,
           DICTIONARY_COLUMN_POSITION
    FROM DMT.MET_DICTIONARY_COLUMN_DETAILS
    WHERE UPPER(TRIM(DICTIONARY_KEY)) = UPPER(?)
      AND TRIM(DICTIONARY_VERSION_KEY) = ?
    ORDER BY DICTIONARY_COLUMN_POSITION
  `;
  return runQuery(sql, [dictionaryKey, dictionaryVersionKey]);
}

module.exports = {
  getDictionaryColumns
};
