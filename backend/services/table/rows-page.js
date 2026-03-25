const { runQuery } = require("../../config/snowflake");
const { createAppError } = require("../../errors/app-error");
const { normalizeFilterRules, normalizeSortDirection } = require("../table.validation");
const { getDictionaryColumns } = require("./dictionary-columns");
const { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = require("./constants");
const {
  normalizePositiveInteger,
  extractCountValue,
  extractWindowTotalCount,
  isSafeDictionaryIdentifier,
  isSafeColumnIdentifier,
  stripWindowColumns,
  buildSnapshotToken,
  cloneRows
} = require("./helpers");
const { getUserDictionaryContext, resolveDictionaryPermission } = require("./access-context");
const {
  getDictionaryVersionDetailsRowsForPermission,
  getDictionarySortOrderFromVersionRows
} = require("./version-details");

async function getDictionaryRowsPageForUser(
  userLogin,
  dictionaryName,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  dictionaryVersionKey = "",
  filtersInput = [],
  sortColumnInput = "",
  sortDirectionInput = "ASC"
) {
  const context = await getUserDictionaryContext(userLogin);
  const permission = resolveDictionaryPermission(context, dictionaryName);

  if (!isSafeDictionaryIdentifier(permission.tableIdentifier)) {
    throw createAppError("Dictionary identifier is invalid.", 400, "DICTIONARY_IDENTIFIER_INVALID");
  }

  const safePageSize = Math.min(normalizePositiveInteger(pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const requestedPage = normalizePositiveInteger(page, 1);

  const normalizedVersionKey = String(dictionaryVersionKey || "").trim();
  if (!normalizedVersionKey) {
    throw createAppError("Dictionary version key is required.", 400, "DICTIONARY_VERSION_KEY_REQUIRED");
  }

  const filterRules = normalizeFilterRules(filtersInput);
  const filterSql = filterRules
    .map((rule) => ` AND UPPER(TRIM(TO_VARCHAR("${rule.column}"))) LIKE UPPER(?) ESCAPE '\\\\'`)
    .join("");
  const filterBindings = filterRules.map((rule) => rule.pattern);

  const versionRows = await getDictionaryVersionDetailsRowsForPermission(permission);
  const sortOrderPhrase = getDictionarySortOrderFromVersionRows(versionRows, normalizedVersionKey);
  const selectedSortColumn = String(sortColumnInput || "").trim().toUpperCase();
  const selectedSortDirection = normalizeSortDirection(sortDirectionInput);

  if (selectedSortColumn && !isSafeColumnIdentifier(selectedSortColumn)) {
    throw createAppError("Sort column is invalid.", 400, "SORT_COLUMN_INVALID");
  }

  const orderByClause = selectedSortColumn
    ? `"${selectedSortColumn}" ${selectedSortDirection}`
    : sortOrderPhrase;

  let safePage = requestedPage;
  let offset = (safePage - 1) * safePageSize;

  function buildDataWithCountSql(targetOffset) {
    return `
      SELECT *, COUNT(*) OVER() AS __TOTAL_COUNT
      FROM ${permission.tableIdentifier}
      WHERE DICTIONARY_VERSION_KEY = ?
      ${filterSql}
      ORDER BY ${orderByClause}
      LIMIT ${safePageSize} OFFSET ${targetOffset}
    `;
  }

  let rowsWithCount = await runQuery(buildDataWithCountSql(offset), [normalizedVersionKey, ...filterBindings]);
  let totalRows = extractWindowTotalCount(rowsWithCount);

  if (rowsWithCount.length === 0 && requestedPage > 1) {
    const countSql = `SELECT COUNT(*) AS TOTAL_COUNT FROM ${permission.tableIdentifier} WHERE DICTIONARY_VERSION_KEY = ?${filterSql}`;
    const countRows = await runQuery(countSql, [normalizedVersionKey, ...filterBindings]);
    totalRows = extractCountValue(countRows[0]);
    const totalPages = Math.max(1, Math.ceil(totalRows / safePageSize));
    safePage = Math.min(requestedPage, totalPages);
    offset = (safePage - 1) * safePageSize;

    rowsWithCount = await runQuery(buildDataWithCountSql(offset), [normalizedVersionKey, ...filterBindings]);
  }

  const totalPages = Math.max(1, Math.ceil(totalRows / safePageSize));
  safePage = Math.min(safePage, totalPages);
  const rows = stripWindowColumns(rowsWithCount);
  const snapshot = buildSnapshotToken(rows, totalRows, normalizedVersionKey);

  const columns = await getDictionaryColumns(dictionaryName, normalizedVersionKey);

  return {
    rows: cloneRows(rows),
    columns,
    page: safePage,
    pageSize: safePageSize,
    totalRows,
    totalPages,
    canUpdate: permission.canUpdate,
    roles: Array.from(permission.roles).sort((a, b) => a.localeCompare(b)),
    dictionaryVersionKey,
    snapshotToken: snapshot.token,
    lockColumns: snapshot.lockColumns
  };
}

module.exports = {
  getDictionaryRowsPageForUser
};
