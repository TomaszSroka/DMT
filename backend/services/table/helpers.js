const crypto = require("crypto");

function normalizeDictionaryName(name) {
  return String(name || "").trim().toUpperCase();
}

function normalizeUserLogin(userLogin) {
  return String(userLogin || "").trim().toUpperCase();
}

function normalizeUserKey(userKey) {
  const value = String(userKey || "").trim();
  return value.length > 0 ? value.toUpperCase() : "";
}

function cloneRows(rows) {
  return JSON.parse(JSON.stringify(Array.isArray(rows) ? rows : []));
}

function normalizePositiveInteger(value, defaultValue) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return defaultValue;
  }
  return parsed;
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

function extractWindowTotalCount(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return 0;
  }

  const firstRow = rows[0] || {};
  const rawValue = firstRow.__TOTAL_COUNT;
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractDictionaryId(row) {
  const value = row && row.DICTIONARY_KEY;
  if (value === undefined || value === null) {
    return "";
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : "";
}

function extractDictionaryTableIdentifier(row) {
  const candidates = [
    row && row.DICTIONARY_LOCATION,
    row && row.DICTIONARY_TABLE,
    row && row.DICTIONARY_OBJECT_NAME,
    row && row.DICTIONARY_ID
  ];

  const value = candidates.find((item) => typeof item === "string" && item.trim().length > 0);
  return value ? value.trim() : "";
}

function extractDictionaryVersionId(row, index) {
  const candidates = [
    row.DICTIONARY_VERSION_KEY,
    row.DICTIONARY_VERSION_CODE,
    row.DICTIONARY_VERSION_NAME,
    index + 1
  ];

  const value = candidates.find((item) => item !== undefined && item !== null && String(item).trim().length > 0);
  return String(value);
}

function mapRoleKeyToRoleName(roleKey, updaterKey, readerKey, updaterRole, readerRole) {
  const normalizedRoleKey = normalizeUserKey(roleKey);
  if (normalizedRoleKey === updaterKey) {
    return updaterRole;
  }
  if (normalizedRoleKey === readerKey) {
    return readerRole;
  }
  return "";
}

function isSafeDictionaryIdentifier(identifier) {
  return /^[A-Za-z0-9_.$"]+$/.test(identifier);
}

function isSafeColumnIdentifier(identifier) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(identifier || "").trim());
}

function cloneRow(row) {
  return row && typeof row === "object" ? { ...row } : {};
}

function mergeRowColumns(target, row) {
  const merged = target || {};
  const source = row && typeof row === "object" ? row : {};

  Object.keys(source).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(merged, key) || merged[key] == null) {
      merged[key] = source[key];
    }
  });

  return merged;
}

function stripWindowColumns(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const cloned = cloneRow(row);
    delete cloned.__TOTAL_COUNT;
    return cloned;
  });
}

function extractSortOrderPhrase(row) {
  return String((row && row.DICTIONARY_SORT_ORDER) || "").trim();
}

function buildSnapshotToken(rows, totalRows, dictionaryVersionKey) {
  const sampleRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : {};
  const lockColumns = Object.keys(sampleRow).slice(0, 4);
  const lockRows = Array.isArray(rows)
    ? rows.map((row) => {
        const reduced = {};
        lockColumns.forEach((column) => {
          reduced[column] = row[column];
        });
        return reduced;
      })
    : [];

  const raw = JSON.stringify({
    dictionaryVersionKey,
    totalRows,
    lockColumns,
    lockRows
  });

  return {
    token: crypto.createHash("sha256").update(raw).digest("hex").slice(0, 24),
    lockColumns
  };
}

module.exports = {
  normalizeDictionaryName,
  normalizeUserLogin,
  normalizeUserKey,
  cloneRows,
  normalizePositiveInteger,
  extractCountValue,
  extractWindowTotalCount,
  extractDictionaryId,
  extractDictionaryTableIdentifier,
  extractDictionaryVersionId,
  mapRoleKeyToRoleName,
  isSafeDictionaryIdentifier,
  isSafeColumnIdentifier,
  cloneRow,
  mergeRowColumns,
  stripWindowColumns,
  extractSortOrderPhrase,
  buildSnapshotToken
};
