const express = require("express");
const { staticUser } = require("../config/env");
const { asyncHandler } = require("../utils/async-handler");
const { createAppError } = require("../errors/app-error");
const {
  getDictionaryRowsPageForUser,
  getDictionaryVersionHistoryForUser,
  getDictionaryVersionsForUser,
  getUserDictionaryContext
} = require("../services/table.service");
const { getErrorPayload } = require("../errors/app-error");

const router = express.Router();

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

function mapDictionarySummary(item) {
  return {
    id: item.id,
    label: item.label,
    canUpdate: Boolean(item.canUpdate)
  };
}

async function getStaticUserContext() {
  return getUserDictionaryContext(staticUser);
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
  const dictionaryInstanceKey = String(req.query.dictionaryInstanceKey || "").trim();
  const filters = parseFiltersQuery(req.query.filters);
  const sortColumn = String(req.query.sortColumn || "").trim();
  const sortDirection = parseSortDirectionQuery(req.query.sortDirection);

  return {
    page,
    pageSize,
    dictionaryInstanceKey,
    filters,
    sortColumn,
    sortDirection
  };
}

router.get("/meta", withApiErrorHandling("Could not load Dictionaries for user.", "META_LOAD_FAILED", async (req, res) => {
  const context = await getStaticUserContext();
  res.json({
    user: context.user,
    dictionaries: (context.dictionaries || []).map(mapDictionarySummary)
  });
}));

router.get(
  "/user-context",
  withApiErrorHandling("Could not load user roles.", "USER_CONTEXT_LOAD_FAILED", async (req, res) => {
    const context = await getStaticUserContext();
    res.json({
      user: context.user,
      roles: context.roles,
      dictionaryRoles: context.dictionaryRoles
    });
  })
);

router.get(
  "/dictionaries/:name/rows",
  withApiErrorHandling("Snowflake query failed.", "ROWS_QUERY_FAILED", async (req, res) => {
    const { page, pageSize, dictionaryInstanceKey, filters, sortColumn, sortDirection } = validateRowsQuery(req);
    const payload = await getDictionaryRowsPageForUser(
      staticUser,
      req.params.name,
      page,
      pageSize,
      dictionaryInstanceKey,
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
    const payload = await getDictionaryVersionsForUser(staticUser, req.params.name);
    res.json(payload);
  })
);

router.get(
  "/dictionaries/:name/version-history",
  withApiErrorHandling("Could not load Dictionary version details.", "VERSION_HISTORY_LOAD_FAILED", async (req, res) => {
    const payload = await getDictionaryVersionHistoryForUser(staticUser, req.params.name);
    res.json(payload);
  })
);

module.exports = router;
