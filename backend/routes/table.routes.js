const express = require("express");
const { staticUser } = require("../config/env");
const { dictionaryDefinitions, getDictionaryRowsPage, getUserRoles } = require("../services/table.service");

const router = express.Router();

router.get("/meta", (req, res) => {
  res.json({
    user: staticUser,
    dictionaries: dictionaryDefinitions
  });
});

router.get("/user-context", async (req, res) => {
  try {
    const roles = await getUserRoles(200);
    res.json({
      user: staticUser,
      roles
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
    const payload = await getDictionaryRowsPage(req.params.name, page, pageSize);
    res.json(payload);
  } catch (error) {
    const message = error.message || error.code || "Snowflake query failed.";
    res.status(400).json({ error: message });
  }
});

module.exports = router;
