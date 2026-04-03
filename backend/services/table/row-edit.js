const { runQuery } = require("../../config/snowflake");
const { createAppError } = require("../../errors/app-error");
const { getDictionaryColumns } = require("./dictionary-columns");
const { getUserDictionaryContext, resolveDictionaryPermission } = require("./access-context");
const { getExistingCheckOutLocation } = require("./check-out");
const { isSafeDictionaryIdentifier, isSafeColumnIdentifier } = require("./helpers");

const KEY_COLUMN = "KEY";

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

async function resolveSourceTableIdentifier(permission, checkoutDictionaryLocation) {
  const normalizedCheckOutLocation = String(checkoutDictionaryLocation || "").trim();
  if (!normalizedCheckOutLocation) {
    return permission.tableIdentifier;
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

  return normalizedCheckOutLocation;
}

async function saveDictionaryRowForUser(userLogin, dictionaryName, payload = {}) {
  const context = await getUserDictionaryContext(userLogin);
  const permission = resolveDictionaryPermission(context, dictionaryName);

  if (!permission.canUpdate) {
    throw createAppError("Dictionary is not editable for this user.", 403, "DICTIONARY_NOT_EDITABLE");
  }

  const dictionaryVersionKey = String(payload.dictionaryVersionKey || "").trim();
  if (!dictionaryVersionKey) {
    throw createAppError("Field 'dictionaryVersionKey' is required.", 400, "DICTIONARY_VERSION_KEY_REQUIRED");
  }

  const sourceTableIdentifier = await resolveSourceTableIdentifier(permission, payload.checkoutDictionaryLocation);
  if (!isSafeDictionaryIdentifier(sourceTableIdentifier)) {
    throw createAppError("Dictionary identifier is invalid.", 400, "DICTIONARY_IDENTIFIER_INVALID");
  }

  const originalRow = normalizeObject(payload.originalRow);
  const updatedRow = normalizeObject(payload.updatedRow);
  const columnDefs = await getDictionaryColumns(permission.id, dictionaryVersionKey);

  const allowedColumns = new Set(
    (Array.isArray(columnDefs) ? columnDefs : [])
      .map((col) => String(col && col.DICTIONARY_COLUMN_TECHNICAL ? col.DICTIONARY_COLUMN_TECHNICAL : "").trim().toUpperCase())
      .filter((col) => col.length > 0 && isSafeColumnIdentifier(col))
  );

  if (allowedColumns.size === 0) {
    throw createAppError("No editable columns found for selected dictionary version.", 400, "ROW_UPDATE_COLUMNS_EMPTY");
  }

  const changedColumns = [];
  allowedColumns.forEach((columnName) => {
    // KEY column is used only for WHERE clause, never in SET
    if (columnName === KEY_COLUMN) {
      return;
    }

    if (!(columnName in updatedRow)) {
      return;
    }

    const oldValue = Object.prototype.hasOwnProperty.call(originalRow, columnName) ? originalRow[columnName] : null;
    const newValue = updatedRow[columnName];

    if (toComparable(oldValue) !== toComparable(newValue)) {
      changedColumns.push({ columnName, oldValue, newValue });
    }
  });

  if (changedColumns.length === 0) {
    return {
      updated: false,
      changedColumns: []
    };
  }

  // Build WHERE clause: prefer KEY column if available, otherwise use original row columns
  const hasKeyColumn = allowedColumns.has(KEY_COLUMN);
  const keyValue = Object.prototype.hasOwnProperty.call(originalRow, KEY_COLUMN) ? originalRow[KEY_COLUMN] : null;

  const whereBinds = [];
  let whereSql;

  if (hasKeyColumn && keyValue != null) {
    // Use KEY for WHERE clause
    whereSql = buildWherePredicate(KEY_COLUMN, keyValue, whereBinds);
  } else {
    // Fallback: use all original row columns that are in allowedColumns (except KEY)
    const whereColumns = [];
    allowedColumns.forEach((columnName) => {
      if (columnName === KEY_COLUMN) {
        return;
      }
      if (Object.prototype.hasOwnProperty.call(originalRow, columnName)) {
        whereColumns.push({ columnName, value: originalRow[columnName] });
      }
    });

    if (whereColumns.length === 0) {
      throw createAppError("Original row data is required to identify record for update.", 400, "ROW_UPDATE_ORIGINAL_ROW_MISSING");
    }

    whereSql = whereColumns
      .map(({ columnName, value }) => buildWherePredicate(columnName, value, whereBinds))
      .join(" AND ");
  }

  const setSql = changedColumns.map((change) => `"${change.columnName}" = ?`).join(", ");
  const setBinds = changedColumns.map((change) => change.newValue);

  const updateSql = `
    UPDATE ${sourceTableIdentifier}
    SET ${setSql}
    WHERE ${whereSql}
  `;

  await runQuery(updateSql, [...setBinds, ...whereBinds]);

  return {
    updated: true,
    changedColumns: changedColumns.map((change) => ({
      column: change.columnName,
      from: change.oldValue,
      to: change.newValue
    }))
  };
}

module.exports = {
  saveDictionaryRowForUser
};
