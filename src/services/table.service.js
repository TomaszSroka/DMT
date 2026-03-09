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

async function getDictionaryRows(dictionaryName, limit = 200) {
  const normalized = normalizeDictionaryName(dictionaryName);
  if (!isAllowedDictionary(normalized)) {
    throw new Error("Dictionary is not allowed.");
  }

  const cappedLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 1000) : 200;
  const sqlText = `SELECT * FROM ${normalized} LIMIT ${cappedLimit}`;

  return runQuery(sqlText);
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
  getDictionaryRows,
  getUserRoles
};
