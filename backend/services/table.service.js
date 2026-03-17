const { runQuery } = require("../config/snowflake");
const crypto = require("crypto");
const { createAppError } = require("../errors/app-error");
const {
  normalizeFilterRules,
  normalizeSortDirection,
  isSafeOrderByPhrase
} = require("./table.validation");
const { getDictionaryColumns } = require("./dictionary-columns.service");

const accessConfigTable = "DMT.MET_USER_DICTIONARY_ROLE_DETAILS";
const dictionaryVersionDetailsView = "DMT.MET_DICTIONARY_VERSION_DETAILS";
const ROLE_READER = "DICTIONARY_READER";
const ROLE_UPDATER = "DICTIONARY_UPDATER";
const ROLE_READER_KEY = "1";
const ROLE_UPDATER_KEY = "2";
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 1000;
const allowedRoleKeys = new Set([ROLE_READER_KEY, ROLE_UPDATER_KEY]);
const ACCESS_CACHE_TTL_MS = 60 * 1000;
const USER_CONTEXT_CACHE_TTL_MS = 60 * 1000;

const accessCacheByUser = new Map();

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
    row.DICTIONARY_VERSION_KEY,
    row.DICTIONARY_VERSION_CODE,
    row.DICTIONARY_VERSION_NAME,
    index + 1
  ];

  const value = candidates.find((item) => item !== undefined && item !== null && String(item).trim().length > 0);
  return String(value);
}

function extractDictionaryVersionLabel(row) {
  const name = row.DICTIONARY_VERSION_NAME;
  const code = row.DICTIONARY_VERSION_CODE;
  const status = row.DICTIONARY_VERSION_STATUS;

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

async function getDictionaryVersionDetailsRowsForPermission(permission) {
  const sqlText = `
    SELECT *
    FROM ${dictionaryVersionDetailsView}
    WHERE UPPER(TRIM(DICTIONARY_KEY)) = ?
    ORDER BY DICTIONARY_VERSION_CODE DESC
  `;

  return runQuery(sqlText, [normalizeDictionaryName(permission.id)]);
}

function getDictionarySortOrderFromVersionRows(rows, dictionaryInstanceKey) {
  const normalizedKey = String(dictionaryInstanceKey || "").trim();
  const versionRow = (Array.isArray(rows) ? rows : []).find((row) => {
    const rowKey = row && row.DICTIONARY_VERSION_KEY != null ? String(row.DICTIONARY_VERSION_KEY).trim() : "";
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
  if (!normalizedUser) {
    return [];
  }

  const now = Date.now();
  const cached = accessCacheByUser.get(normalizedUser);
  if (cached && cached.expiresAt > now && Array.isArray(cached.rows)) {
    return cached.rows;
  }

  const normalizedUserKey = normalizeUserKey(userLogin);
  const sqlText = `
    SELECT *
    FROM ${accessConfigTable}
    WHERE UPPER(TRIM(ROLE_KEY)) IN (?, ?)
      AND (
        UPPER(TRIM(USER_LOGIN)) = ?
        OR UPPER(TRIM(USER_KEY)) = ?
      )
  `;

  const rows = await runQuery(sqlText, [ROLE_READER_KEY, ROLE_UPDATER_KEY, normalizedUser, normalizedUserKey]);
  const dedupedRows = [];
  const seen = new Set();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const userKey = normalizeUserKey(row && row.USER_KEY);
    const roleKey = normalizeUserKey(row && row.ROLE_KEY);
    const dictionaryKey = normalizeDictionaryName(row && row.DICTIONARY_KEY);
    const dedupeKey = `${userKey}::${roleKey}::${dictionaryKey}`;

    if (seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);
    dedupedRows.push(row);
  });

  accessCacheByUser.set(normalizedUser, {
    rows: dedupedRows,
    expiresAt: now + ACCESS_CACHE_TTL_MS
  });

  return dedupedRows;
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
      // Usuwamy label, zostaje tylko id
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
    if (!dictionaryId) {
      return;
    }

    const key = `${dictionaryId}::${role}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    pairs.push({
      dictionary: dictionaryId,
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
    .map((item) => {
      // label zawsze z DMT.MET_USER_DICTIONARY_ROLE_DETAILS.DICTIONARY_NAME
      let label = item.metadata && item.metadata.DICTIONARY_NAME
        ? String(item.metadata.DICTIONARY_NAME).trim()
        : item.id;
      return {
        id: item.id, // DICTIONARY_KEY
        label,
        canUpdate: item.canUpdate,
        roles: Array.from(item.roles).sort((a, b) => a.localeCompare(b))
      };
    })
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
  dictionaryVersionKey = "",
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

  const normalizedVersionKey = String(dictionaryVersionKey || "").trim();
  if (!normalizedVersionKey) {
    throw createAppError("Dictionary version key is required.", 400, "DICTIONARY_VERSION_KEY_REQUIRED");
  }

  const filterRules = normalizeFilterRules(filtersInput);
  const filterSql = filterRules
    .map((rule) => ` AND UPPER(TRIM(TO_VARCHAR("${rule.column}"))) LIKE UPPER(?) ESCAPE '\\\\'`)
    .join("");
  const filterBindings = filterRules.map((rule) => rule.pattern);

  const versionRows = await getDictionaryVersionDetailsRowsForPermission(permission);
  const sortOrderPhrase = getDictionarySortOrderFromVersionRows(versionRows, normalizedVersionKey);
  const selectedSortColumn = String(sortColumnInput || "").trim().toUpperCase();
  const selectedSortDirection = normalizeSortDirection(sortDirectionInput);

  if (selectedSortColumn && !isSafeColumnIdentifier(selectedSortColumn)) {
    throw createAppError("Sort column is invalid.", 400, "SORT_COLUMN_INVALID");
  }

  const orderByClause = selectedSortColumn
    ? `"${selectedSortColumn}" ${selectedSortDirection}`
    : sortOrderPhrase;

  let safePage = requestedPage;
  let offset = (safePage - 1) * safePageSize;

  function buildDataWithCountSql(targetOffset) {
    return `
      SELECT *, COUNT(*) OVER() AS __TOTAL_COUNT
      FROM ${permission.tableIdentifier}
      WHERE DICTIONARY_VERSION_KEY = ?
      ${filterSql}
      ORDER BY ${orderByClause}
      LIMIT ${safePageSize} OFFSET ${targetOffset}
    `;
  }

  let rowsWithCount = await runQuery(buildDataWithCountSql(offset), [normalizedVersionKey, ...filterBindings]);
  let totalRows = extractWindowTotalCount(rowsWithCount);

  // Out-of-range page returns 0 rows, so window COUNT cannot be read from result rows.
  if (rowsWithCount.length === 0 && requestedPage > 1) {
    const countSql = `SELECT COUNT(*) AS TOTAL_COUNT FROM ${permission.tableIdentifier} WHERE DICTIONARY_VERSION_KEY = ?${filterSql}`;
    const countRows = await runQuery(countSql, [normalizedVersionKey, ...filterBindings]);
    totalRows = extractCountValue(countRows[0]);
    const totalPages = Math.max(1, Math.ceil(totalRows / safePageSize));
    safePage = Math.min(requestedPage, totalPages);
    offset = (safePage - 1) * safePageSize;

    rowsWithCount = await runQuery(buildDataWithCountSql(offset), [normalizedVersionKey, ...filterBindings]);
  }

  const totalPages = Math.max(1, Math.ceil(totalRows / safePageSize));
  safePage = Math.min(safePage, totalPages);
  const rows = stripWindowColumns(rowsWithCount);
  const snapshot = buildSnapshotToken(rows, totalRows, normalizedVersionKey);

  // Log used keys for debugging

  // Używaj istniejących zmiennych, nie deklaruj ponownie dictionaryVersionKey
  const dictionaryKey = dictionaryName; // techniczna nazwa słownika
  console.log('getDictionaryColumns', { DICTIONARY_KEY: dictionaryKey, DICTIONARY_VERSION_KEY: normalizedVersionKey });
  const columns = await getDictionaryColumns(dictionaryKey, normalizedVersionKey);

  return {
    rows: cloneRows(rows),
    columns, // <-- przekazujemy kolumny z bazy 1:1
    page: safePage,
    pageSize: safePageSize,
    totalRows,
    totalPages,
    canUpdate: permission.canUpdate,
    roles: Array.from(permission.roles).sort((a, b) => a.localeCompare(b)),
    DICTIONARY_VERSION_KEY: dictionaryVersionKey,
    snapshotToken: snapshot.token,
    lockColumns: snapshot.lockColumns
  };
}

async function getDictionaryVersionsForUser(userLogin, dictionaryName) {
  const context = await getUserDictionaryContext(userLogin);
  const permission = resolveDictionaryPermission(context, dictionaryName);

  // Keep all columns from the source view in backend memory for future operations.
  const rawRows = await getDictionaryVersionDetailsRowsForPermission(permission);

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
      label: row.DICTIONARY_VERSION_NAME || row.DICTIONARY_VERSION_KEY || id
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

  const rows = await getDictionaryVersionDetailsRowsForPermission(permission);

  return {
    rows,
    canUpdate: permission.canUpdate
  };
}

module.exports = {
  accessConfigTable,
  dictionaryVersionDetailsView,
  ROLE_READER,
  ROLE_UPDATER,
  getUserDictionaryContext,
  getDictionaryRowsPageForUser,
  getDictionaryVersionsForUser,
  getDictionaryVersionHistoryForUser,
  __test: {
    normalizeFilterRules,
    normalizeSortDirection,
    isSafeOrderByPhrase
  }
};
