const { runQuery } = require("../../config/snowflake");
const { createAppError } = require("../../errors/app-error");
const { checkOutDetailsView } = require("./constants");
const { getUserDictionaryContext, resolveDictionaryPermission } = require("./access-context");
const { resolveCheckOutResultFromProcedureResult } = require("./check-out-result-parser");

const CHECK_OUT_PROCEDURE = "DMT.MET_CHECK_OUT_EDIT";
const CHECK_OUT_MODES = {
  CHECK: "CHECK",
  ADD: "ADD"
};

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

function normalizeCheckOutMode(mode) {
  const normalized = String(mode || "").trim().toUpperCase();
  if (!normalized) {
    return CHECK_OUT_MODES.ADD;
  }

  if (normalized !== CHECK_OUT_MODES.CHECK && normalized !== CHECK_OUT_MODES.ADD) {
    throw createAppError("Body field 'mode' must be CHECK or ADD.", 400, "CHECK_OUT_MODE_INVALID");
  }

  return normalized;
}

async function ensureDictionaryCheckOutForUser(userLogin, dictionaryName, dictionaryVersionKey, mode) {
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

  const checkOutMode = normalizeCheckOutMode(mode);

  const callSql = `CALL ${CHECK_OUT_PROCEDURE}(?, ?, ?, ?, ?)`;
  const procedureRows = await runQuery(callSql, [
    checkOutMode,
    userKey,
    dictionaryKey,
    dictionaryVersionKeyNum,
    checkOutSourceLocation
  ]);

  const procedureResult = resolveCheckOutResultFromProcedureResult(procedureRows);
  const isInserted = procedureResult.procedureResult === "RECORD_INSERTED";

  const basePayload = {
    mode: checkOutMode,
    procedureResult: procedureResult.procedureResult,
    versionName: procedureResult.versionName,
    userLogin: procedureResult.userLogin
  };

  if (checkOutMode === CHECK_OUT_MODES.CHECK) {
    return {
      ...basePayload,
      checkOutDictionaryLocation: procedureResult.tableName,
      created: false
    };
  }

  if (procedureResult.tableName) {
    return {
      ...basePayload,
      checkOutDictionaryLocation: procedureResult.tableName,
      created: isInserted
    };
  }

  const refreshed = await getExistingCheckOutLocation(dictionaryKey);
  if (refreshed.location) {
    return {
      ...basePayload,
      checkOutDictionaryLocation: refreshed.location,
      created: isInserted
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