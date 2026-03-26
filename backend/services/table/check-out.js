const { runQuery } = require("../../config/snowflake");
const { createAppError } = require("../../errors/app-error");
const { checkOutDetailsView } = require("./constants");
const { getUserDictionaryContext, resolveDictionaryPermission } = require("./access-context");

const CHECK_OUT_PROCEDURE = "DMT.MET_CHECK_OUT_EDIT";

function parseRequiredInteger(value, fieldName, errorCode) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw createAppError(`Field '${fieldName}' must be a positive integer.`, 400, errorCode);
  }
  return parsed;
}

function resolveDictionaryKey(permission) {
  const metadata = permission && permission.metadata ? permission.metadata : {};
  const candidates = [metadata.DICTIONARY_KEY, metadata.DICTIONARY_ID, permission && permission.id];
  const value = candidates.find((item) => item !== undefined && item !== null && String(item).trim().length > 0);
  return parseRequiredInteger(value, "DICTIONARY_KEY", "CHECK_OUT_DICTIONARY_KEY_INVALID");
}

function resolveUserKey(permission) {
  const metadata = permission && permission.metadata ? permission.metadata : {};
  const value = metadata.USER_KEY;
  return parseRequiredInteger(value, "USER_KEY", "CHECK_OUT_USER_KEY_INVALID");
}

function resolveCheckOutLocationFromRow(row) {
  const candidates = [
    row && row.CHECK_OUT_DICTIONARY_LOCATION,
    row && row.CHECK_OUT_LOCATION,
    row && row.DICTIONARY_LOCATION,
    row && row.DICTIONARY_TABLE
  ];
  const value = candidates.find((item) => item !== undefined && item !== null && String(item).trim().length > 0);
  return value ? String(value).trim() : "";
}

function resolveCheckOutLocationFromProcedureResult(rows) {
  const firstRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!firstRow || typeof firstRow !== "object") {
    return "";
  }

  const values = Object.values(firstRow).map((value) => String(value || "").trim()).filter((value) => value.length > 0);
  const tableName = values.find((value) => /[A-Za-z0-9_.$"]+/.test(value));
  return tableName || "";
}

async function getCheckOutDetailsRows(dictionaryKey) {
  const sqlText = `
    SELECT *
    FROM ${checkOutDetailsView}
    WHERE DICTIONARY_KEY = ?
  `;

  return runQuery(sqlText, [dictionaryKey]);
}

async function getExistingCheckOutLocation(dictionaryKey) {
  const rows = await getCheckOutDetailsRows(dictionaryKey);
  const row = Array.isArray(rows) ? rows.find((item) => resolveCheckOutLocationFromRow(item)) : null;
  const location = resolveCheckOutLocationFromRow(row);
  return {
    location,
    rows: Array.isArray(rows) ? rows : []
  };
}

async function ensureDictionaryCheckOutForUser(userLogin, dictionaryName, dictionaryVersionKey) {
  const context = await getUserDictionaryContext(userLogin);
  const permission = resolveDictionaryPermission(context, dictionaryName);

  if (!permission.canUpdate) {
    throw createAppError("Dictionary is not editable for this user.", 403, "DICTIONARY_NOT_EDITABLE");
  }

  const userKey = resolveUserKey(permission);
  const dictionaryKey = resolveDictionaryKey(permission);
  const dictionaryVersionKeyNum = parseRequiredInteger(
    dictionaryVersionKey,
    "DICTIONARY_VERSION_KEY",
    "CHECK_OUT_DICTIONARY_VERSION_KEY_INVALID"
  );

  const checkOutSourceLocation = String(permission.tableIdentifier || "").trim();
  if (!checkOutSourceLocation) {
    throw createAppError("Dictionary source table is missing.", 400, "CHECK_OUT_SOURCE_LOCATION_MISSING");
  }

  const callSql = `CALL ${CHECK_OUT_PROCEDURE}(?, ?, ?, ?)`;
  const procedureRows = await runQuery(callSql, [
    userKey,
    dictionaryKey,
    dictionaryVersionKeyNum,
    checkOutSourceLocation
  ]);

  const fromProcedure = resolveCheckOutLocationFromProcedureResult(procedureRows);
  if (fromProcedure) {
    return {
      checkOutDictionaryLocation: fromProcedure,
      created: true
    };
  }

  const refreshed = await getExistingCheckOutLocation(dictionaryKey);
  if (refreshed.location) {
    return {
      checkOutDictionaryLocation: refreshed.location,
      created: true
    };
  }

  throw createAppError(
    "Check-out location was not returned by procedure or details view.",
    500,
    "CHECK_OUT_LOCATION_MISSING"
  );
}

module.exports = {
  ensureDictionaryCheckOutForUser,
  getExistingCheckOutLocation
};