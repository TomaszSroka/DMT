const { runQuery } = require("../config/snowflake");

const defaultDictionaryId = "DMT.MET_USER_ROLE_DETAILS";

const dictionaryDefinitions = [
  {
    id: defaultDictionaryId,
    label: "USER ROLE DETAILS"
  }
];

const allowedDictionaryIds = dictionaryDefinitions.map((item) => item.id);

function normalizeDictionaryName(name) {
  return String(name || "").trim().toUpperCase();
}

function isAllowedDictionary(name) {
  const normalized = normalizeDictionaryName(name);
  return allowedDictionaryIds.includes(normalized);
}

function extractCountValue(row) {
  if (!row || typeof row !== "object") {
    return 0;
  }

  const countKey = Object.keys(row).find((key) => key.toUpperCase().includes("COUNT"));
  if (!countKey) {
    return 0;
  }

  const value = Number.parseInt(row[countKey], 10);
  return Number.isFinite(value) ? value : 0;
}

async function getDictionaryRowsPage(dictionaryName, page = 1, pageSize = 100) {
  const normalized = normalizeDictionaryName(dictionaryName);
  if (!isAllowedDictionary(normalized)) {
    throw new Error("Dictionary is not allowed.");
  }

  const safePageSize = Number.isFinite(pageSize) ? Math.min(Math.max(pageSize, 1), 1000) : 100;
  const requestedPage = Number.isFinite(page) ? Math.max(page, 1) : 1;

  const countSql = `SELECT COUNT(*) AS TOTAL_COUNT FROM ${normalized}`;
  const countRows = await runQuery(countSql);
  const totalRows = extractCountValue(countRows[0]);

  const totalPages = Math.max(1, Math.ceil(totalRows / safePageSize));
  const safePage = Math.min(requestedPage, totalPages);
  const offset = (safePage - 1) * safePageSize;

  const dataSql = `SELECT * FROM ${normalized} LIMIT ${safePageSize} OFFSET ${offset}`;
  const rows = await runQuery(dataSql);

  return {
    rows,
    page: safePage,
    pageSize: safePageSize,
    totalRows,
    totalPages
  };
}

async function getUserRoles(limit = 100) {
  const cappedLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 100;
  const sqlText = `SELECT DISTINCT ROLE_NAME FROM ${defaultDictionaryId} WHERE ROLE_NAME IS NOT NULL LIMIT ${cappedLimit}`;
  const rows = await runQuery(sqlText);

  return rows
    .map((row) => row.ROLE_NAME)
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .sort((a, b) => a.localeCompare(b));
}

module.exports = {
  defaultDictionaryId,
  dictionaryDefinitions,
  isAllowedDictionary,
  getDictionaryRowsPage,
  getUserRoles
};
