const express = require("express");
const { staticUser, userReader, userUpdater, userCreator } = require("../config/env");
const { asyncHandler } = require("../utils/async-handler");
const { createAppError } = require("../errors/app-error");
const {
  getDictionaryRowsPageForUser,
  getDictionaryVersionHistoryForUser,
  getDictionaryVersionsForUser,
  getUserDictionaryContext,
  getUsersForRole,
  ensureDictionaryCheckOutForUser,
  saveDictionaryRowForUser
} = require("../services/table.service");
const { getErrorPayload } = require("../errors/app-error");
const { getDictionaryColumns } = require("../services/table/dictionary-columns");

const router = express.Router();

const USER_KEY_TO_LOGIN = new Map([
  ["READER", userReader || staticUser],
  ["UPDATER", userUpdater || staticUser],
  ["CREATOR", userCreator || staticUser]
]);

function getUserLogin(userKey) {
  const rawValue = String(userKey || "").trim();
  if (!rawValue) {
    return staticUser;
  }

  const key = rawValue.toUpperCase();
  return USER_KEY_TO_LOGIN.get(key) || rawValue;
}

function sendApiError(res, error, fallbackMessage, fallbackCode) {
  const { status, message, errorCode, details } = getErrorPayload(error, fallbackMessage, fallbackCode);
  const payload = { error: message, errorCode };
  if (details) {
    payload.details = details;
  }
  res.status(status).json(payload);
}

function withApiErrorHandling(fallbackMessage, fallbackCode, handler) {
  return asyncHandler(async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      sendApiError(res, error, fallbackMessage, fallbackCode);
    }
  });
}



// Return full object (id, label, canUpdate, roles)

async function getDynamicUserContext(req) {
  return getUserDictionaryContext(getUserLogin(req.query.userKey));
}

function hasQueryValue(value) {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function parsePositiveIntegerQuery(value, message, errorCode) {
  if (!hasQueryValue(value)) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw createAppError(message, 400, errorCode);
  }

  return parsed;
}

function parseFiltersQuery(value) {
  if (!hasQueryValue(value)) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw createAppError("Query param 'filters' must be a JSON string.", 400, "FILTERS_QUERY_INVALID");
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      throw new Error("not-array");
    }
    return parsed;
  } catch (error) {
    throw createAppError("Query param 'filters' must be a JSON array.", 400, "FILTERS_QUERY_INVALID");
  }
}

function parseSortDirectionQuery(value) {
  if (!hasQueryValue(value)) {
    return "";
  }

  const direction = String(value).trim().toUpperCase();
  if (direction !== "ASC" && direction !== "DESC") {
    throw createAppError("Query param 'sortDirection' must be ASC or DESC.", 400, "SORT_DIRECTION_INVALID");
  }

  return direction;
}

function validateRowsQuery(req) {
  const page = parsePositiveIntegerQuery(req.query.page, "Query param 'page' must be a positive integer.", "PAGE_INVALID");
  const pageSize = parsePositiveIntegerQuery(
    req.query.pageSize,
    "Query param 'pageSize' must be a positive integer.",
    "PAGE_SIZE_INVALID"
  );
  const dictionaryVersionKey = String(req.query.dictionaryVersionKey || "").trim();
  const checkoutDictionaryLocation = String(req.query.checkoutDictionaryLocation || "").trim();
  const filters = parseFiltersQuery(req.query.filters);
  const sortColumn = String(req.query.sortColumn || "").trim();
  const sortDirection = parseSortDirectionQuery(req.query.sortDirection);

  return {
    page,
    pageSize,
    dictionaryVersionKey,
    checkoutDictionaryLocation,
    filters,
    sortColumn,
    sortDirection
  };
}

router.get("/meta", withApiErrorHandling("Could not load Dictionaries for user.", "META_LOAD_FAILED", async (req, res) => {
  const context = await getDynamicUserContext(req);
  res.json({
    user: context.user,
    dictionaries: context.dictionaries || []
  });
}));

router.get(
  "/user-context",
  withApiErrorHandling("Could not load user roles.", "USER_CONTEXT_LOAD_FAILED", async (req, res) => {
    const context = await getDynamicUserContext(req);
    res.json({
      user: context.user,
      roles: context.roles,
      dictionaryRoles: context.dictionaryRoles,
      dictionaries: context.dictionaries // list of dictionaries with labels
    });
  })
);

router.get(
  "/user-managers",
  withApiErrorHandling("Could not load users for role USER_MANAGER.", "ROLE_USERS_LOAD_FAILED", async (req, res) => {
    const users = await getUsersForRole("USER_MANAGER");
    res.json({ users });
  })
);

router.post(
  "/dictionaries/:name/rows/save",
  withApiErrorHandling("Could not save Dictionary row.", "ROW_SAVE_FAILED", async (req, res) => {
    const payload = await saveDictionaryRowForUser(
      getUserLogin(req.query.userKey),
      req.params.name,
      req.body || {}
    );
    res.json(payload);
  })
);

router.post(
  "/dictionaries/:name/check-out",
  withApiErrorHandling("Could not check out Dictionary for editing.", "CHECK_OUT_FAILED", async (req, res) => {
    const dictionaryVersionKey = String(req.body && req.body.dictionaryVersionKey ? req.body.dictionaryVersionKey : "").trim();
    const mode = String(req.body && req.body.mode ? req.body.mode : "").trim();
    if (!dictionaryVersionKey) {
      throw createAppError("Body field 'dictionaryVersionKey' is required.", 400, "DICTIONARY_VERSION_KEY_REQUIRED");
    }

    const payload = await ensureDictionaryCheckOutForUser(
      getUserLogin(req.query.userKey),
      req.params.name,
      dictionaryVersionKey,
      mode
    );
    res.json(payload);
  })
);

router.get(
  "/dictionaries/:name/rows",
  withApiErrorHandling("Snowflake query failed.", "ROWS_QUERY_FAILED", async (req, res) => {
    const {
      page,
      pageSize,
      dictionaryVersionKey,
      checkoutDictionaryLocation,
      filters,
      sortColumn,
      sortDirection
    } = validateRowsQuery(req);
    const payload = await getDictionaryRowsPageForUser(
      getUserLogin(req.query.userKey),
      req.params.name,
      page,
      pageSize,
      dictionaryVersionKey,
      checkoutDictionaryLocation,
      filters,
      sortColumn,
      sortDirection
    );
    res.json(payload);
  })
);

router.get(
  "/dictionaries/:name/versions",
  withApiErrorHandling("Could not load Dictionary versions.", "VERSIONS_LOAD_FAILED", async (req, res) => {
    const payload = await getDictionaryVersionsForUser(getUserLogin(req.query.userKey), req.params.name);
    res.json(payload);
  })
);

router.get(
  "/dictionaries/:name/version-history",
  withApiErrorHandling("Could not load Dictionary version details.", "VERSION_HISTORY_LOAD_FAILED", async (req, res) => {
    const payload = await getDictionaryVersionHistoryForUser(getUserLogin(req.query.userKey), req.params.name);
    res.json(payload);
  })
);

// New endpoint: fetch dictionary columns for a given version
router.get(
  "/dictionaries/:name/columns",
  withApiErrorHandling("Could not load Dictionary columns.", "COLUMNS_LOAD_FAILED", async (req, res) => {
    const dictionaryKey = req.params.name;
    const dictionaryVersionKey = String(req.query.dictionaryVersionKey || "").trim();
    if (!dictionaryVersionKey) {
      throw createAppError("Query param 'dictionaryVersionKey' is required.", 400, "DICTIONARY_VERSION_KEY_REQUIRED");
    }
    const columns = await getDictionaryColumns(dictionaryKey, dictionaryVersionKey);

    res.json({ columns });
  })
);

module.exports = router;
