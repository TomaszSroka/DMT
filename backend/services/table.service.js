const { runQuery } = require("../config/snowflake");

const accessConfigTable = "DMT.MET_USER_DICTIONARY_ROLE_DETAILS";
const dictionaryInstanceDetailsView = "DMT.MET_DICTIONARY_INSTANCE_DETAILS";
const ROLE_READER = "DICTIONARY_READER";
const ROLE_UPDATER = "DICTIONARY_UPDATER";
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 1000;
const allowedRoles = new Set([ROLE_READER, ROLE_UPDATER]);

function createAppError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeDictionaryName(name) {
  return String(name || "").trim().toUpperCase();
}

function normalizeUserLogin(userLogin) {
  return String(userLogin || "").trim().toUpperCase();
}

function normalizeRole(roleName) {
  return String(roleName || "").trim().toUpperCase();
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

function extractDictionaryId(row) {
  const candidates = [
    row.DICTIONARY_LOCATION,
    row.DICTIONARY_ID,
    row.DICTIONARY_OBJECT_NAME,
    row.DICTIONARY_TABLE,
    row.DICTIONARY_CODE,
    row.DICTIONARY_NAME
  ];

  const value = candidates.find((item) => typeof item === "string" && item.trim().length > 0);
  return value ? value.trim() : "";
}

function extractDictionaryLabel(row, fallbackId) {
  const candidates = [
    row.DICTIONARY_NAME,
    row.DICTIONARY_LABEL,
    row.DICTIONARY_DISPLAY_NAME,
    fallbackId
  ];

  const value = candidates.find((item) => typeof item === "string" && item.trim().length > 0);
  return value ? value.trim() : fallbackId;
}

function extractDictionaryVersionId(row, index) {
  const candidates = [
    row.DICTIONARY_INSTANCE_KEY,
    row.DICTIONARY_INSTANCE_VERSION_CODE,
    row.DICTIONARY_INSTANCE_VERSION_NAME,
    index + 1
  ];

  const value = candidates.find((item) => item !== undefined && item !== null && String(item).trim().length > 0);
  return String(value);
}

function extractDictionaryVersionLabel(row) {
  const name = row.DICTIONARY_INSTANCE_VERSION_NAME;
  const code = row.DICTIONARY_INSTANCE_VERSION_CODE;
  const status = row.DICTIONARY_INSTANCE_STATUS;

  if (name) {
    return String(name);
  }

  if (code !== undefined && code !== null && String(code).trim().length > 0) {
    return `Version ${code}`;
  }

  if (status) {
    return String(status);
  }

  return "Version";
}

function isSafeDictionaryIdentifier(identifier) {
  return /^[A-Za-z0-9_.$"]+$/.test(identifier);
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

async function getUserAccessRows(userLogin) {
  const normalizedUser = normalizeUserLogin(userLogin);
  const sqlText = `
    SELECT *
    FROM ${accessConfigTable}
    WHERE UPPER(TRIM(USER_LOGIN)) = ?
      AND UPPER(TRIM(ROLE_NAME)) IN (?, ?)
  `;

  return runQuery(sqlText, [normalizedUser, ROLE_READER, ROLE_UPDATER]);
}

function buildDictionaryPermissions(accessRows) {
  const permissions = new Map();

  accessRows.forEach((row) => {
    const dictionaryId = extractDictionaryId(row);
    if (!dictionaryId) {
      return;
    }

    const role = normalizeRole(row.ROLE_NAME);
    if (!allowedRoles.has(role)) {
      return;
    }

    const key = normalizeDictionaryName(dictionaryId);
    const existing = permissions.get(key) || {
      id: dictionaryId,
      label: extractDictionaryLabel(row, dictionaryId),
      roles: new Set(),
      canRead: false,
      canUpdate: false,
      metadata: {},
      accessRows: []
    };

    existing.roles.add(role);
    existing.canRead = true;
    if (role === ROLE_UPDATER) {
      existing.canUpdate = true;
    }

    existing.metadata = mergeRowColumns(existing.metadata, row);
    existing.accessRows.push(cloneRow(row));

    permissions.set(key, existing);
  });

  return permissions;
}

function buildDictionaryRolePairs(accessRows) {
  const pairs = [];
  const seen = new Set();

  accessRows.forEach((row) => {
    const role = normalizeRole(row.ROLE_NAME);
    if (!allowedRoles.has(role)) {
      return;
    }

    const dictionaryId = extractDictionaryId(row);
    const dictionaryLabel = extractDictionaryLabel(row, dictionaryId || "");
    if (!dictionaryLabel) {
      return;
    }

    const key = `${dictionaryLabel}::${role}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    pairs.push({
      dictionary: dictionaryLabel,
      role
    });
  });

  return pairs.sort((a, b) => {
    const dictionaryCmp = a.dictionary.localeCompare(b.dictionary);
    if (dictionaryCmp !== 0) {
      return dictionaryCmp;
    }

    return a.role.localeCompare(b.role);
  });
}

async function getUserDictionaryContext(userLogin) {
  const normalizedUser = normalizeUserLogin(userLogin);
  const accessRows = await getUserAccessRows(normalizedUser);
  const permissions = buildDictionaryPermissions(accessRows);

  const dictionaries = Array.from(permissions.values())
    .filter((item) => item.canRead)
    .map((item) => ({
      id: item.id,
      label: item.label,
      canUpdate: item.canUpdate,
      roles: Array.from(item.roles).sort((a, b) => a.localeCompare(b))
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const roles = Array.from(
    new Set(
      accessRows
        .map((row) => normalizeRole(row.ROLE_NAME))
        .filter((role) => allowedRoles.has(role))
    )
  ).sort((a, b) => a.localeCompare(b));

  const dictionaryRoles = buildDictionaryRolePairs(accessRows);

  return {
    user: normalizedUser,
    roles,
    dictionaryRoles,
    dictionaries,
    permissionByDictionary: permissions
  };
}

function resolveDictionaryPermission(context, dictionaryName) {
  const key = normalizeDictionaryName(dictionaryName);
  const permission = context.permissionByDictionary.get(key);
  if (!permission || !permission.canRead) {
    throw createAppError("Dictionary is not allowed for this user.", 403, "DICTIONARY_FORBIDDEN");
  }

  return permission;
}

async function getDictionaryRowsPageForUser(
  userLogin,
  dictionaryName,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  dictionaryInstanceKey = ""
) {
  const context = await getUserDictionaryContext(userLogin);
  const permission = resolveDictionaryPermission(context, dictionaryName);

  if (!isSafeDictionaryIdentifier(permission.id)) {
    throw createAppError("Dictionary identifier is invalid.", 400, "DICTIONARY_IDENTIFIER_INVALID");
  }

  const safePageSize = Math.min(normalizePositiveInteger(pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const requestedPage = normalizePositiveInteger(page, 1);

  const normalizedInstanceKey = String(dictionaryInstanceKey || "").trim();
  if (!normalizedInstanceKey) {
    throw createAppError("Dictionary version key is required.", 400, "DICTIONARY_VERSION_KEY_REQUIRED");
  }

  const countSql = `SELECT COUNT(*) AS TOTAL_COUNT FROM ${permission.id} WHERE DICTIONARY_INSTANCE_KEY = ?`;
  const countRows = await runQuery(countSql, [normalizedInstanceKey]);
  const totalRows = extractCountValue(countRows[0]);

  const totalPages = Math.max(1, Math.ceil(totalRows / safePageSize));
  const safePage = Math.min(requestedPage, totalPages);
  const offset = (safePage - 1) * safePageSize;

  const dataSql = `
    SELECT *
    FROM ${permission.id}
    WHERE DICTIONARY_INSTANCE_KEY = ?
    ORDER BY 1, 2, 3, 4
    LIMIT ${safePageSize} OFFSET ${offset}
  `;
  const rows = await runQuery(dataSql, [normalizedInstanceKey]);

  return {
    rows,
    page: safePage,
    pageSize: safePageSize,
    totalRows,
    totalPages,
    canUpdate: permission.canUpdate,
    roles: Array.from(permission.roles).sort((a, b) => a.localeCompare(b)),
    dictionaryInstanceKey: normalizedInstanceKey
  };
}

async function getDictionaryVersionsForUser(userLogin, dictionaryName) {
  const context = await getUserDictionaryContext(userLogin);
  const permission = resolveDictionaryPermission(context, dictionaryName);

  const sqlText = `
    SELECT *
    FROM ${dictionaryInstanceDetailsView}
    WHERE UPPER(TRIM(DICTIONARY_LOCATION)) = ?
       OR UPPER(TRIM(DICTIONARY_NAME)) = ?
    ORDER BY DICTIONARY_INSTANCE_VERSION_CODE DESC
  `;

  // Keep all columns from the source view in backend memory for future operations.
  const rawRows = await runQuery(sqlText, [
    normalizeDictionaryName(permission.id),
    normalizeDictionaryName(permission.label)
  ]);

  const seenVersionIds = new Set();
  const versions = [];

  rawRows.forEach((row, index) => {
    const id = extractDictionaryVersionId(row, index);
    if (seenVersionIds.has(id)) {
      return;
    }

    seenVersionIds.add(id);
    versions.push({
      id,
      label: extractDictionaryVersionLabel(row)
    });
  });

  return {
    versions,
    canUpdate: permission.canUpdate
  };
}

module.exports = {
  accessConfigTable,
  dictionaryInstanceDetailsView,
  ROLE_READER,
  ROLE_UPDATER,
  getUserDictionaryContext,
  getDictionaryRowsPageForUser,
  getDictionaryVersionsForUser
};
