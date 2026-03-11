const express = require("express");
const { staticUser } = require("../config/env");
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

router.get("/meta", async (req, res) => {
  try {
    const context = await getUserDictionaryContext(staticUser);
    res.json({
      user: context.user,
      dictionaries: (context.dictionaries || []).map((item) => ({
        id: item.id,
        label: item.label,
        canUpdate: Boolean(item.canUpdate)
      }))
    });
  } catch (error) {
    sendApiError(res, error, "Could not load Dictionaries for user.", "META_LOAD_FAILED");
  }
});

router.get("/user-context", async (req, res) => {
  try {
    const context = await getUserDictionaryContext(staticUser);
    res.json({
      user: context.user,
      roles: context.roles,
      dictionaryRoles: context.dictionaryRoles
    });
  } catch (error) {
    sendApiError(res, error, "Could not load user roles.", "USER_CONTEXT_LOAD_FAILED");
  }
});

router.get("/dictionaries/:name/rows", async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page, 10);
    const pageSize = Number.parseInt(req.query.pageSize, 10);
    const dictionaryInstanceKey = String(req.query.dictionaryInstanceKey || "").trim();
    const payload = await getDictionaryRowsPageForUser(
      staticUser,
      req.params.name,
      page,
      pageSize,
      dictionaryInstanceKey
    );
    res.json(payload);
  } catch (error) {
    sendApiError(res, error, "Snowflake query failed.", "ROWS_QUERY_FAILED");
  }
});

router.get("/dictionaries/:name/versions", async (req, res) => {
  try {
    const payload = await getDictionaryVersionsForUser(staticUser, req.params.name);
    res.json(payload);
  } catch (error) {
    sendApiError(res, error, "Could not load Dictionary versions.", "VERSIONS_LOAD_FAILED");
  }
});

router.get("/dictionaries/:name/version-history", async (req, res) => {
  try {
    const payload = await getDictionaryVersionHistoryForUser(staticUser, req.params.name);
    res.json(payload);
  } catch (error) {
    sendApiError(res, error, "Could not load Dictionary version details.", "VERSION_HISTORY_LOAD_FAILED");
  }
});

module.exports = router;
