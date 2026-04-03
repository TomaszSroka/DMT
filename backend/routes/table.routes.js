const express = require("express");
const { asyncHandler } = require("../utils/async-handler");
const { createAppError } = require("../errors/app-error");
const { resolveAuthContext } = require("../middleware/auth-context");
const { validateRowsQuery } = require("./table.query");
const {
  getDictionaryRowsPageForUser,
  getDictionaryVersionHistoryForUser,
  getDictionaryVersionsForUser,
  getUserDictionaryContext,
  getUsersForRole,
  ensureDictionaryCheckOutForUser,
  saveDictionaryRowForUser,
  insertDictionaryRowForUser
} = require("../services/table.service");
const { getErrorPayload } = require("../errors/app-error");
const { getDictionaryColumns } = require("../services/table/dictionary-columns");

const router = express.Router();

router.use(resolveAuthContext);
router.use((error, req, res, next) => {
  sendApiError(res, error, "Authentication failed.", "AUTH_FAILED");
});

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
  return getUserDictionaryContext(req.user.login);
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
      req.user.login,
      req.params.name,
      req.body || {}
    );
    res.json(payload);
  })
);

router.post(
  "/dictionaries/:name/rows/insert",
  withApiErrorHandling("Could not insert Dictionary row.", "ROW_INSERT_FAILED", async (req, res) => {
    const payload = await insertDictionaryRowForUser(
      req.user.login,
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
      req.user.login,
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
      req.user.login,
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
    const payload = await getDictionaryVersionsForUser(req.user.login, req.params.name);
    res.json(payload);
  })
);

router.get(
  "/dictionaries/:name/version-history",
  withApiErrorHandling("Could not load Dictionary version details.", "VERSION_HISTORY_LOAD_FAILED", async (req, res) => {
    const payload = await getDictionaryVersionHistoryForUser(req.user.login, req.params.name);
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
