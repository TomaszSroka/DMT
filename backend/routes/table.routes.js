const express = require("express");
const { staticUser } = require("../config/env");
const {
  getDictionaryRowsPageForUser,
  getDictionaryVersionsForUser,
  getUserDictionaryContext
} = require("../services/table.service");

const router = express.Router();

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
    const message = error.message || error.code || "Could not load dictionaries for user.";
    res.status(400).json({ error: message });
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
    const message = error.message || error.code || "Could not load user roles.";
    res.status(400).json({ error: message });
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
    const message = error.message || error.code || "Snowflake query failed.";
    res.status(400).json({ error: message });
  }
});

router.get("/dictionaries/:name/versions", async (req, res) => {
  try {
    const payload = await getDictionaryVersionsForUser(staticUser, req.params.name);
    res.json(payload);
  } catch (error) {
    const message = error.message || error.code || "Could not load dictionary versions.";
    res.status(400).json({ error: message });
  }
});

module.exports = router;
