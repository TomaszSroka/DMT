const { createAppError } = require("../../errors/app-error");
const { getDictionaryColumns } = require("./dictionary-columns");
const { getUserDictionaryContext, resolveDictionaryPermission } = require("./access-context");
const { getExistingCheckOutLocation } = require("./check-out");
const { isSafeDictionaryIdentifier, isSafeColumnIdentifier } = require("./helpers");

const KEY_COLUMN = "KEY";
const DICTIONARY_VERSION_KEY_COLUMN = "DICTIONARY_VERSION_KEY";

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toComparable(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function buildWherePredicate(columnName, value, binds) {
  if (value === null || value === undefined) {
    return `"${columnName}" IS NULL`;
  }

  binds.push(value);
  return `"${columnName}" = ?`;
}

function getAllowedColumnsByVersion(columnDefs) {
  return new Set(
    (Array.isArray(columnDefs) ? columnDefs : [])
      .map((col) => String(col && col.DICTIONARY_COLUMN_TECHNICAL ? col.DICTIONARY_COLUMN_TECHNICAL : "").trim().toUpperCase())
      .filter((col) => col.length > 0 && isSafeColumnIdentifier(col))
  );
}

function getInsertableColumns(allowedColumns, newRow) {
  const normalizedRow = normalizeObject(newRow);
  const insertableColumns = [];

  allowedColumns.forEach((columnName) => {
    if (columnName === KEY_COLUMN || columnName === DICTIONARY_VERSION_KEY_COLUMN) {
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(normalizedRow, columnName)) {
      return;
    }

    insertableColumns.push({
      columnName,
      value: normalizedRow[columnName]
    });
  });

  return insertableColumns;
}

async function resolveSaveContext(permission, checkoutDictionaryLocation) {
  const normalizedCheckOutLocation = String(checkoutDictionaryLocation || "").trim();
  if (!normalizedCheckOutLocation) {
    return {
      sourceTableIdentifier: permission.tableIdentifier,
      columnsDictionaryVersionKey: ""
    };
  }

  if (!permission.canUpdate) {
    throw createAppError("Dictionary check-out table is not allowed for this user.", 403, "CHECK_OUT_TABLE_FORBIDDEN");
  }

  const dictionaryKeyRaw = permission && permission.metadata ? permission.metadata.DICTIONARY_KEY : "";
  const dictionaryKey = Number.parseInt(String(dictionaryKeyRaw || "").trim(), 10);
  if (!Number.isFinite(dictionaryKey) || dictionaryKey < 1) {
    throw createAppError("Dictionary key is invalid for check-out table usage.", 400, "CHECK_OUT_DICTIONARY_KEY_INVALID");
  }

  const checkOutDetails = await getExistingCheckOutLocation(dictionaryKey);
  if (!checkOutDetails.location || checkOutDetails.location !== normalizedCheckOutLocation) {
    throw createAppError("Check-out table does not match active Dictionary check-out details.", 403, "CHECK_OUT_TABLE_MISMATCH");
  }

  return {
    sourceTableIdentifier: normalizedCheckOutLocation,
    columnsDictionaryVersionKey: String(checkOutDetails.dictionaryVersionKey || "").trim()
  };
}

async function prepareRowEditContext({
  userLogin,
  dictionaryName,
  payload,
  emptyColumnsMessage,
  emptyColumnsErrorCode
}) {
  const safePayload = payload || {};
  const context = await getUserDictionaryContext(userLogin);
  const permission = resolveDictionaryPermission(context, dictionaryName);

  if (!permission.canUpdate) {
    throw createAppError("Dictionary is not editable for this user.", 403, "DICTIONARY_NOT_EDITABLE");
  }

  const dictionaryVersionKey = String(safePayload.dictionaryVersionKey || "").trim();
  if (!dictionaryVersionKey) {
    throw createAppError("Field 'dictionaryVersionKey' is required.", 400, "DICTIONARY_VERSION_KEY_REQUIRED");
  }

  const saveContext = await resolveSaveContext(permission, safePayload.checkoutDictionaryLocation);
  if (!isSafeDictionaryIdentifier(saveContext.sourceTableIdentifier)) {
    throw createAppError("Dictionary identifier is invalid.", 400, "DICTIONARY_IDENTIFIER_INVALID");
  }

  const columnsVersionKey = saveContext.columnsDictionaryVersionKey || dictionaryVersionKey;
  const columnDefs = await getDictionaryColumns(permission.id, columnsVersionKey);
  const allowedColumns = getAllowedColumnsByVersion(columnDefs);

  if (allowedColumns.size === 0) {
    throw createAppError(emptyColumnsMessage, 400, emptyColumnsErrorCode);
  }

  return {
    dictionaryVersionKey,
    saveContext,
    allowedColumns
  };
}

module.exports = {
  KEY_COLUMN,
  DICTIONARY_VERSION_KEY_COLUMN,
  normalizeObject,
  toComparable,
  buildWherePredicate,
  getInsertableColumns,
  prepareRowEditContext
};
