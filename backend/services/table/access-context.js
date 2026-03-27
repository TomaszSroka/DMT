const { runQuery } = require("../../config/snowflake");
const { createAppError } = require("../../errors/app-error");
const {
  accessConfigTable,
  ROLE_READER,
  ROLE_UPDATER,
  ROLE_READER_KEY,
  ROLE_UPDATER_KEY,
  ACCESS_CACHE_TTL_MS,
  USER_CONTEXT_CACHE_TTL_MS,
  allowedRoleKeys
} = require("./constants");
const {
  normalizeDictionaryName,
  normalizeUserLogin,
  normalizeUserKey,
  extractDictionaryId,
  extractDictionaryTableIdentifier,
  mapRoleKeyToRoleName,
  cloneRow,
  mergeRowColumns
} = require("./helpers");

const accessCacheByUser = new Map();
const userContextCache = new Map();

function resolveRoleNameFromRow(row) {
  const roleKey = normalizeUserKey(row && row.ROLE_KEY);
  const mapped = mapRoleKeyToRoleName(roleKey, ROLE_UPDATER_KEY, ROLE_READER_KEY, ROLE_UPDATER, ROLE_READER);
  if (mapped) {
    return mapped;
  }

  const rawRoleName = row && row.ROLE_NAME != null ? String(row.ROLE_NAME).trim() : "";
  return rawRoleName;
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

  const sqlText = `
    SELECT *
    FROM ${accessConfigTable}
    WHERE UPPER(TRIM(USER_LOGIN)) = ?
  `;
  const rows = await runQuery(sqlText, [normalizedUser]);

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

    const role = mapRoleKeyToRoleName(roleKey, ROLE_UPDATER_KEY, ROLE_READER_KEY, ROLE_UPDATER, ROLE_READER);

    const key = normalizeDictionaryName(dictionaryId);
    const tableIdentifier = extractDictionaryTableIdentifier(row);
    const existing = permissions.get(key) || {
      id: dictionaryId,
      tableIdentifier,
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
    const role = resolveRoleNameFromRow(row);
    if (!role) {
      return;
    }

    const dictionaryId = extractDictionaryId(row);
    if (!dictionaryId) {
      return;
    }

    const dictionaryLabel = row && row.DICTIONARY_NAME != null
      ? String(row.DICTIONARY_NAME).trim()
      : "";

    const key = `${dictionaryId}::${role}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    pairs.push({ dictionary: dictionaryId, dictionaryLabel, role });
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
      const label = item.metadata && item.metadata.DICTIONARY_NAME
        ? String(item.metadata.DICTIONARY_NAME).trim()
        : item.id;
      return {
        id: item.id,
        label,
        canUpdate: item.canUpdate,
        roles: Array.from(item.roles).sort((a, b) => a.localeCompare(b))
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  const roles = Array.from(
    new Set(
      accessRows
        .map((row) => resolveRoleNameFromRow(row))
        .filter((role) => role.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));

  const dictionaryRoles = buildDictionaryRolePairs(accessRows);

  const userKey = accessRows.length > 0 && accessRows[0].USER_KEY != null
    ? Number(accessRows[0].USER_KEY)
    : null;

  const context = {
    user: normalizedUser,
    userKey,
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

module.exports = {
  getUserDictionaryContext,
  resolveDictionaryPermission
};
