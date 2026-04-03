const { authMode, staticUser, userReader, userUpdater, userCreator } = require("../config/env");
const { createAppError } = require("../errors/app-error");

const USER_KEY_TO_LOGIN = new Map([
  ["READER", userReader || "READER@FLSMIDTH.COM"],
  ["UPDATER", userUpdater || "UPDATER_1@FLSMIDTH.COM"],
  ["CREATOR", userCreator || "CREATOR@FLSMIDTH.COM"]
]);

const ALLOWED_MOCK_LOGINS = new Map(
  [
    staticUser,
    userReader,
    userUpdater,
    userCreator,
    "READER@FLSMIDTH.COM",
    "UPDATER_1@FLSMIDTH.COM",
    "UPDATER_2@FLSMIDTH.COM",
    "CREATOR@FLSMIDTH.COM"
  ]
    .map((value) => String(value || "").trim())
    .filter((value) => value.length > 0)
    .map((value) => [value.toUpperCase(), value])
);

function resolveMockLoginFromUserKey(userKey) {
  const rawValue = String(userKey || "").trim();
  if (!rawValue) {
    throw createAppError("Query param 'userKey' is required in mock auth mode.", 401, "AUTH_USER_KEY_REQUIRED");
  }

  const mapped = USER_KEY_TO_LOGIN.get(rawValue.toUpperCase());
  if (mapped) {
    return {
      login: mapped,
      source: "mock-user-key"
    };
  }

  const allowedLogin = ALLOWED_MOCK_LOGINS.get(rawValue.toUpperCase());
  if (allowedLogin) {
    return {
      login: allowedLogin,
      source: "mock-login"
    };
  }

  throw createAppError(
    "Query param 'userKey' must be one of: READER, UPDATER, CREATOR, or an allowed mock login.",
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
