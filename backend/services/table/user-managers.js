const { runQuery } = require("../../config/snowflake");
const { accessConfigTable } = require("./constants");

function normalizeRoleName(roleName) {
  return String(roleName || "").trim().toUpperCase();
}

function resolveUserName(row) {
  const candidates = [
    row && row.USER_LOGIN,
    row && row.USER_NAME,
    row && row.USER,
    row && row.LOGIN
  ];

  const value = candidates.find((item) => item !== undefined && item !== null && String(item).trim().length > 0);
  return value ? String(value).trim() : "";
}

function resolveEmail(row) {
  const candidates = [
    row && row.USER_EMAIL,
    row && row.EMAIL,
    row && row.E_MAIL,
    row && row.MAIL
  ];

  const value = candidates.find((item) => item !== undefined && item !== null && String(item).trim().length > 0);
  return value ? String(value).trim() : "";
}

async function getUsersForRole(roleName) {
  const normalizedRoleName = normalizeRoleName(roleName);
  if (!normalizedRoleName) {
    return [];
  }

  const sqlText = `
    SELECT USER_LOGIN, USER_EMAIL
    FROM ${accessConfigTable}
    WHERE UPPER(TRIM(ROLE_NAME)) = ?
  `;
  const rows = await runQuery(sqlText, [normalizedRoleName]);

  const seen = new Set();
  const users = [];

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const userName = resolveUserName(row);
    const email = resolveEmail(row);
    const dedupeKey = `${userName}::${email}`.toUpperCase();

    if (!userName || seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);
    users.push({ userName, email });
  });

  return users.sort((a, b) => {
    const userCmp = a.userName.localeCompare(b.userName);
    if (userCmp !== 0) {
      return userCmp;
    }

    return a.email.localeCompare(b.email);
  });
}

module.exports = {
  getUsersForRole
};