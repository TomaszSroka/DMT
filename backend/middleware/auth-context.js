const { authMode, staticUser, userReader, userUpdater, userCreator } = require("../config/env");
const { createAppError } = require("../errors/app-error");

const USER_KEY_TO_LOGIN = new Map([
  ["READER", userReader || staticUser],
  ["UPDATER", userUpdater || staticUser],
  ["CREATOR", userCreator || staticUser]
]);

function isEmailLikeUserKey(value) {
  const raw = String(value || "").trim();
  return raw.includes("@") && raw.includes(".");
}

function resolveMockLoginFromUserKey(userKey) {
  const rawValue = String(userKey || "").trim();
  if (!rawValue) {
    return {
      login: staticUser,
      source: "mock-default"
    };
  }

  const mapped = USER_KEY_TO_LOGIN.get(rawValue.toUpperCase());
  if (mapped) {
    return {
      login: mapped,
      source: "mock-user-key"
    };
  }

  if (isEmailLikeUserKey(rawValue)) {
    return {
      login: rawValue,
      source: "mock-email"
    };
  }

  throw createAppError(
    "Query param 'userKey' must be one of: READER, UPDATER, CREATOR, or an email-like login.",
    401,
    "AUTH_USER_KEY_INVALID"
  );
}

function resolveSsoUser(req) {
  const bearer = String(req.headers.authorization || "").trim();
  if (!bearer.toLowerCase().startsWith("bearer ")) {
    throw createAppError("Missing bearer token for SSO authentication.", 401, "AUTH_TOKEN_REQUIRED");
  }

  throw createAppError("SSO mode is enabled but token validation is not configured yet.", 501, "AUTH_SSO_NOT_CONFIGURED");
}

function resolveAuthContext(req, res, next) {
  try {
    if (authMode === "sso") {
      req.user = resolveSsoUser(req);
      next();
      return;
    }

    req.user = resolveMockLoginFromUserKey(req.query && req.query.userKey);
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  resolveAuthContext
};
