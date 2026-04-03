const { runQuery } = require("../../config/snowflake");
const { createAppError } = require("../../errors/app-error");
const {
  KEY_COLUMN,
  DICTIONARY_VERSION_KEY_COLUMN,
  normalizeObject,
  toComparable,
  buildWherePredicate,
  getInsertableColumns,
  prepareRowEditContext
} = require("./row-edit.common");

async function saveDictionaryRowForUser(userLogin, dictionaryName, payload = {}) {
  const { saveContext, allowedColumns } = await prepareRowEditContext({
    userLogin,
    dictionaryName,
    payload,
    emptyColumnsMessage: "No editable columns found for selected dictionary version.",
    emptyColumnsErrorCode: "ROW_UPDATE_COLUMNS_EMPTY"
  });
  const originalRow = normalizeObject(payload.originalRow);
  const updatedRow = normalizeObject(payload.updatedRow);

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
    UPDATE ${saveContext.sourceTableIdentifier}
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

async function insertDictionaryRowForUser(userLogin, dictionaryName, payload = {}) {
  const { dictionaryVersionKey, saveContext, allowedColumns } = await prepareRowEditContext({
    userLogin,
    dictionaryName,
    payload,
    emptyColumnsMessage: "No editable columns found for selected dictionary version.",
    emptyColumnsErrorCode: "ROW_INSERT_COLUMNS_EMPTY"
  });
  const newRow = normalizeObject(payload.newRow);

  const insertableColumns = getInsertableColumns(allowedColumns, newRow);
  if (insertableColumns.length === 0) {
    throw createAppError("At least one editable field is required to add a new row.", 400, "ROW_INSERT_EMPTY");
  }

  const insertColumns = [];

  if (allowedColumns.has(KEY_COLUMN)) {
    insertColumns.push({ columnName: KEY_COLUMN, useExpression: true, expressionSql: "DMT.DIC_SEQ.nextval" });
  }

  insertColumns.push({ columnName: DICTIONARY_VERSION_KEY_COLUMN, useExpression: true, expressionSql: "?" });

  insertableColumns.forEach((item) => {
    insertColumns.push({ ...item, useExpression: false });
  });

  const columnsSql = insertColumns.map((item) => `"${item.columnName}"`).join(", ");
  const valuesSql = insertColumns
    .map((item) => (item.useExpression ? item.expressionSql : "?"))
    .join(", ");
  const binds = [dictionaryVersionKey, ...insertableColumns.map((item) => item.value)];

  const insertSql = `
    INSERT INTO ${saveContext.sourceTableIdentifier} (${columnsSql})
    VALUES (${valuesSql})
  `;

  await runQuery(insertSql, binds);

  return {
    inserted: true,
    insertedColumns: insertableColumns.map((item) => item.columnName)
  };
}

module.exports = {
  saveDictionaryRowForUser,
  insertDictionaryRowForUser
};
