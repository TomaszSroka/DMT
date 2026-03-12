const { runQuery } = require("../config/snowflake");
const crypto = require("crypto");
const { createAppError } = require("../errors/app-error");

const accessConfigTable = "DMT.MET_USER_DICTIONARY_ROLE_DETAILS";
const dictionaryInstanceDetailsView = "DMT.MET_DICTIONARY_INSTANCE_DETAILS";
const ROLE_READER = "DICTIONARY_READER";
const ROLE_UPDATER = "DICTIONARY_UPDATER";
const ROLE_READER_KEY = "1";
const ROLE_UPDATER_KEY = "2";
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 1000;
const allowedRoleKeys = new Set([ROLE_READER_KEY, ROLE_UPDATER_KEY]);
const ACCESS_CACHE_TTL_MS = 60 * 1000;
const USER_CONTEXT_CACHE_TTL_MS = 60 * 1000;

const accessCache = {
  rows: null,
  expiresAt: 0,
  userKeyByLogin: new Map()
};

const userContextCache = new Map();

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

async function getAllAccessRows() {
  const now = Date.now();
  if (Array.isArray(accessCache.rows) && accessCache.expiresAt > now) {
    return accessCache.rows;
  }

  const sqlText = `
    SELECT *
    FROM ${accessConfigTable}
  `;

  const rows = await runQuery(sqlText);
  accessCache.rows = rows;
  accessCache.expiresAt = now + ACCESS_CACHE_TTL_MS;
  accessCache.userKeyByLogin.clear();

  rows.forEach((row) => {
    const login = normalizeUserLogin(row && row.USER_LOGIN);
    const key = normalizeUserKey(row && row.USER_KEY);
    if (login && key && !accessCache.userKeyByLogin.has(login)) {
      accessCache.userKeyByLogin.set(login, key);
    }
  });

  return rows;
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

function mapRoleKeyToRoleName(roleKey) {
  const normalizedRoleKey = normalizeUserKey(roleKey);
  if (normalizedRoleKey === ROLE_UPDATER_KEY) {
    return ROLE_UPDATER;
  }
  if (normalizedRoleKey === ROLE_READER_KEY) {
    return ROLE_READER;
  }
  return "";
}

function isSafeDictionaryIdentifier(identifier) {
  return /^[A-Za-z0-9_.$"]+$/.test(identifier);
}

function isSafeColumnIdentifier(identifier) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(identifier || "").trim());
}

function parseFilterRulesInput(filtersInput) {
  if (!filtersInput) {
    return [];
  }

  if (Array.isArray(filtersInput)) {
    return filtersInput;
  }

  if (typeof filtersInput === "string") {
    const trimmed = filtersInput.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      throw createAppError("Filters payload is invalid.", 400, "FILTERS_INVALID");
    }
  }

  return [];
}

function toSqlLikePattern(value) {
  const text = String(value || "").trim();
  const escaped = text
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_")
    .replaceAll("*", "%");

  if (!text.includes("*")) {
    return `%${escaped}%`;
  }

  return escaped;
}

function normalizeFilterRules(filtersInput) {
  const rawRules = parseFilterRulesInput(filtersInput);
  const normalized = [];

  rawRules.forEach((rule) => {
    const column = String(rule && rule.column != null ? rule.column : "").trim().toUpperCase();
    const value = String(rule && rule.value != null ? rule.value : "").trim();
    if (!column || !value) {
      return;
    }

    if (!isSafeColumnIdentifier(column)) {
      throw createAppError("Filter column is invalid.", 400, "FILTER_COLUMN_INVALID");
    }

    normalized.push({
      column,
      pattern: toSqlLikePattern(value)
    });
  });

  return normalized;
}

function normalizeSortDirection(direction) {
  const value = String(direction || "").trim().toUpperCase();
  return value === "DESC" ? "DESC" : "ASC";
}

function extractSortOrderPhrase(row) {
  return String((row && row.DICTIONARY_SORT_ORDER) || "").trim();
}

function isSafeOrderByPhrase(orderByPhrase) {
  const phrase = String(orderByPhrase || "").trim();
  if (!phrase) {
    return false;
  }

  const parts = phrase.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
  if (parts.length === 0) {
    return false;
  }

  const pattern = /^([A-Za-z0-9_$"]+\.)*[A-Za-z0-9_$"]+(\s+(ASC|DESC))?(\s+NULLS\s+(FIRST|LAST))?$/i;
  return parts.every((part) => pattern.test(part));
}

async function getDictionaryInstanceDetailsRowsForPermission(permission) {
  const sqlText = `
    SELECT *
    FROM ${dictionaryInstanceDetailsView}
    WHERE UPPER(TRIM(DICTIONARY_KEY)) = ?
    ORDER BY DICTIONARY_INSTANCE_VERSION_CODE DESC
  `;

  return runQuery(sqlText, [normalizeDictionaryName(permission.id)]);
}

function getDictionarySortOrderFromVersionRows(rows, dictionaryInstanceKey) {
  const normalizedKey = String(dictionaryInstanceKey || "").trim();
  const versionRow = (Array.isArray(rows) ? rows : []).find((row) => {
    const rowKey = row && row.DICTIONARY_INSTANCE_KEY != null ? String(row.DICTIONARY_INSTANCE_KEY).trim() : "";
    return rowKey === normalizedKey;
  });

  const phrase = extractSortOrderPhrase(versionRow);

  if (!phrase) {
    throw createAppError(
      "Dictionary sort order is required for selected version.",
      400,
      "DICTIONARY_SORT_ORDER_REQUIRED"
    );
  }

  if (!isSafeOrderByPhrase(phrase)) {
    throw createAppError(
      "Dictionary sort order is invalid for selected version.",
      400,
      "DICTIONARY_SORT_ORDER_INVALID"
    );
  }

  return phrase;
}

function buildSnapshotToken(rows, totalRows, dictionaryInstanceKey) {
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
    dictionaryInstanceKey,
    totalRows,
    lockColumns,
    lockRows
  });

  return {
    token: crypto.createHash("sha256").update(raw).digest("hex").slice(0, 24),
    lockColumns
  };
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
  const normalizedUserRef = normalizeUserLogin(userLogin);
  const rows = await getAllAccessRows();
  const userKeyFromInput = normalizeUserKey(userLogin);
  const matchedByKey = rows.find((row) => normalizeUserKey(row && row.USER_KEY) === userKeyFromInput);
  const resolvedFromLogin = accessCache.userKeyByLogin.get(normalizedUserRef) || "";
  const matchedByLogin = rows.find((row) => normalizeUserLogin(row && row.USER_LOGIN) === normalizedUserRef);
  const resolvedUserKey = normalizeUserKey(
    (matchedByKey && matchedByKey.USER_KEY) || resolvedFromLogin || (matchedByLogin && matchedByLogin.USER_KEY)
  );

  if (!resolvedUserKey) {
    return [];
  }

  return rows.filter((row) => {
    const rowUserKey = normalizeUserKey(row && row.USER_KEY);
    const rowRoleKey = normalizeUserKey(row && row.ROLE_KEY);
    return rowUserKey === resolvedUserKey && allowedRoleKeys.has(rowRoleKey);
  });
}

function buildDictionaryPermissions(accessRows) {
  const permissions = new Map();

  accessRows.forEach((row) => {
    const dictionaryId = extractDictionaryId(row);
    if (!dictionaryId) {
      return;
    }

    const roleKey = normalizeUserKey(row.ROLE_KEY);
    if (!allowedRoleKeys.has(roleKey)) {
      return;
    }

    const role = mapRoleKeyToRoleName(roleKey);

    const key = normalizeDictionaryName(dictionaryId);
    const tableIdentifier = extractDictionaryTableIdentifier(row);
    const existing = permissions.get(key) || {
      id: dictionaryId,
      tableIdentifier,
      label: extractDictionaryLabel(row, dictionaryId),
      roles: new Set(),
      canRead: false,
      canUpdate: false,
      metadata: {},
      accessRows: []
    };

    existing.roles.add(role);
    existing.canRead = true;
    if (!existing.tableIdentifier && tableIdentifier) {
      existing.tableIdentifier = tableIdentifier;
    }
    if (roleKey === ROLE_UPDATER_KEY) {
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
    const roleKey = normalizeUserKey(row.ROLE_KEY);
    if (!allowedRoleKeys.has(roleKey)) {
      return;
    }

    const role = mapRoleKeyToRoleName(roleKey);

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
  const now = Date.now();
  const cachedContext = userContextCache.get(normalizedUser);
  if (cachedContext && cachedContext.expiresAt > now) {
    return cachedContext.value;
  }

  const accessRows = await getUserAccessRows(normalizedUser);
  const permissions = buildDictionaryPermissions(accessRows);

  const dictionaries = Array.from(permissions.values())
    .filter((item) => item.canRead)
    .map((item) => ({
      id: item.id,
      label: item.label || item.id,
      canUpdate: item.canUpdate,
      roles: Array.from(item.roles).sort((a, b) => a.localeCompare(b))
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const roles = Array.from(
    new Set(
      accessRows
        .map((row) => mapRoleKeyToRoleName(row.ROLE_KEY))
        .filter((role) => role.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));

  const dictionaryRoles = buildDictionaryRolePairs(accessRows);

  const context = {
    user: normalizedUser,
    roles,
    dictionaryRoles,
    dictionaries,
    permissionByDictionary: permissions
  };

  userContextCache.set(normalizedUser, {
    expiresAt: now + USER_CONTEXT_CACHE_TTL_MS,
    value: context
  });

  return context;
}

function resolveDictionaryPermission(context, dictionaryName) {
  const key = normalizeDictionaryName(dictionaryName);
  const permission = context.permissionByDictionary.get(key);
  if (!permission || !permission.canRead) {
    throw createAppError("Dictionary is not allowed for this user.", 403, "DICTIONARY_FORBIDDEN");
  }

  if (!permission.tableIdentifier) {
    throw createAppError("Dictionary table identifier is missing.", 400, "DICTIONARY_TABLE_IDENTIFIER_MISSING");
  }

  return permission;
}

async function getDictionaryRowsPageForUser(
  userLogin,
  dictionaryName,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  dictionaryInstanceKey = "",
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

  const normalizedInstanceKey = String(dictionaryInstanceKey || "").trim();
  if (!normalizedInstanceKey) {
    throw createAppError("Dictionary version key is required.", 400, "DICTIONARY_VERSION_KEY_REQUIRED");
  }

  const filterRules = normalizeFilterRules(filtersInput);
  const filterSql = filterRules
    .map((rule) => ` AND UPPER(TRIM(TO_VARCHAR("${rule.column}"))) LIKE UPPER(?) ESCAPE '\\\\'`)
    .join("");
  const filterBindings = filterRules.map((rule) => rule.pattern);

  const versionRows = await getDictionaryInstanceDetailsRowsForPermission(permission);
  const sortOrderPhrase = getDictionarySortOrderFromVersionRows(versionRows, normalizedInstanceKey);
  const selectedSortColumn = String(sortColumnInput || "").trim().toUpperCase();
  const selectedSortDirection = normalizeSortDirection(sortDirectionInput);

  if (selectedSortColumn && !isSafeColumnIdentifier(selectedSortColumn)) {
    throw createAppError("Sort column is invalid.", 400, "SORT_COLUMN_INVALID");
  }

  const orderByClause = selectedSortColumn
    ? `"${selectedSortColumn}" ${selectedSortDirection}`
    : sortOrderPhrase;

  const countSql = `SELECT COUNT(*) AS TOTAL_COUNT FROM ${permission.tableIdentifier} WHERE DICTIONARY_INSTANCE_KEY = ?${filterSql}`;
  const countRows = await runQuery(countSql, [normalizedInstanceKey, ...filterBindings]);
  const totalRows = extractCountValue(countRows[0]);

  const totalPages = Math.max(1, Math.ceil(totalRows / safePageSize));
  const safePage = Math.min(requestedPage, totalPages);
  const offset = (safePage - 1) * safePageSize;

  const dataSql = `
    SELECT *
    FROM ${permission.tableIdentifier}
    WHERE DICTIONARY_INSTANCE_KEY = ?
    ${filterSql}
    ORDER BY ${orderByClause}
    LIMIT ${safePageSize} OFFSET ${offset}
  `;
  const rows = await runQuery(dataSql, [normalizedInstanceKey, ...filterBindings]);
  const snapshot = buildSnapshotToken(rows, totalRows, normalizedInstanceKey);

  return {
    rows,
    page: safePage,
    pageSize: safePageSize,
    totalRows,
    totalPages,
    canUpdate: permission.canUpdate,
    roles: Array.from(permission.roles).sort((a, b) => a.localeCompare(b)),
    dictionaryInstanceKey: normalizedInstanceKey,
    snapshotToken: snapshot.token,
    lockColumns: snapshot.lockColumns
  };
}

async function getDictionaryVersionsForUser(userLogin, dictionaryName) {
  const context = await getUserDictionaryContext(userLogin);
  const permission = resolveDictionaryPermission(context, dictionaryName);

  // Keep all columns from the source view in backend memory for future operations.
  const rawRows = await getDictionaryInstanceDetailsRowsForPermission(permission);

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

async function getDictionaryVersionHistoryForUser(userLogin, dictionaryName) {
  const context = await getUserDictionaryContext(userLogin);
  const permission = resolveDictionaryPermission(context, dictionaryName);

  const rows = await getDictionaryInstanceDetailsRowsForPermission(permission);

  return {
    rows,
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
  getDictionaryVersionsForUser,
  getDictionaryVersionHistoryForUser
};
