const {
  accessConfigTable,
  dictionaryVersionDetailsView,
  ROLE_READER,
  ROLE_UPDATER
} = require("./table/constants");
const { getUserDictionaryContext } = require("./table/access-context");
const { getDictionaryRowsPageForUser } = require("./table/rows-page");
const { getDictionaryVersionsForUser } = require("./table/versions");
const { getDictionaryVersionHistoryForUser } = require("./table/version-history");
const {
  normalizeFilterRules,
  normalizeSortDirection,
  isSafeOrderByPhrase
} = require("./table.validation");

module.exports = {
  accessConfigTable,
  dictionaryVersionDetailsView,
  ROLE_READER,
  ROLE_UPDATER,
  getUserDictionaryContext,
  getDictionaryRowsPageForUser,
  getDictionaryVersionsForUser,
  getDictionaryVersionHistoryForUser,
  __test: {
    normalizeFilterRules,
    normalizeSortDirection,
    isSafeOrderByPhrase
  }
};
