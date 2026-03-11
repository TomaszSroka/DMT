const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function readJsonConfig() {
  const raw = process.env.DMT_CONFIG_JSON;
  if (!raw) {
    throw new Error("Missing required environment variable: DMT_CONFIG_JSON");
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("DMT_CONFIG_JSON must be a JSON object.");
    }
    return parsed;
  } catch (error) {
    throw new Error(`Invalid DMT_CONFIG_JSON: ${error.message}`);
  }
}

const jsonConfig = readJsonConfig();

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function resolveJsonRef(value) {
  if (typeof value !== "string") {
    return value;
  }

  const match = value.match(/^\$\{([A-Z0-9_]+)\}$/);
  if (!match) {
    return value;
  }

  const envKey = match[1];
  if (hasOwn(process.env, envKey) && process.env[envKey] !== undefined) {
    return process.env[envKey];
  }

  return "";
}

function getRawValue(key, fallbackValue) {
  if (hasOwn(jsonConfig, key) && jsonConfig[key] !== undefined) {
    return resolveJsonRef(jsonConfig[key]);
  }
  return fallbackValue;
}

function toNumber(value, fallbackValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
}

function toInteger(value, fallbackValue) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
}

function toBoolean(value, fallbackValue) {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === undefined || value === null) {
    return fallbackValue;
  }
  return String(value).toLowerCase() === "true";
}

const required = [
  "SNOWFLAKE_ACCOUNT",
  "SNOWFLAKE_USER",
  "SNOWFLAKE_ROLE",
  "SNOWFLAKE_WAREHOUSE",
  "SNOWFLAKE_DATABASE",
  "SNOWFLAKE_SCHEMA",
  "SNOWFLAKE_PRIVATE_KEY_PATH",
  "SNOWFLAKE_PRIVATE_KEY_PASSPHRASE"
];

const missing = required.filter((key) => !getRawValue(key));
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

module.exports = {
  port: toNumber(getRawValue("DMT_PORT", 3000), 3000),
  readinessCacheMs: toInteger(getRawValue("READINESS_CACHE_MS", 5000), 5000),
  snowflake: {
    account: getRawValue("SNOWFLAKE_ACCOUNT"),
    username: getRawValue("SNOWFLAKE_USER"),
    role: getRawValue("SNOWFLAKE_ROLE"),
    warehouse: getRawValue("SNOWFLAKE_WAREHOUSE"),
    database: getRawValue("SNOWFLAKE_DATABASE"),
    schema: getRawValue("SNOWFLAKE_SCHEMA"),
    privateKeyPath: getRawValue("SNOWFLAKE_PRIVATE_KEY_PATH"),
    privateKeyPassphrase: getRawValue("SNOWFLAKE_PRIVATE_KEY_PASSPHRASE"),
    poolSize: toInteger(getRawValue("SNOWFLAKE_POOL_SIZE", 2), 2),
    poolWaitTimeoutMs: toInteger(getRawValue("SNOWFLAKE_POOL_WAIT_TIMEOUT_MS", 15000), 15000),
    poolDebug: toBoolean(getRawValue("SNOWFLAKE_POOL_DEBUG", false), false),
    clientSessionKeepAlive: toBoolean(getRawValue("SNOWFLAKE_CLIENT_SESSION_KEEP_ALIVE", false), false),
    queryTag: String(getRawValue("SNOWFLAKE_QUERY_TAG", ""))
  },
  staticUser: String(getRawValue("APP_STATIC_USER", "SUPTOSR@flsmidth.com"))
};
