const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: true });

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

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

module.exports = {
  port: Number(process.env.PORT || 3000),
  snowflake: {
    account: process.env.SNOWFLAKE_ACCOUNT,
    username: process.env.SNOWFLAKE_USER,
    role: process.env.SNOWFLAKE_ROLE,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE,
    database: process.env.SNOWFLAKE_DATABASE,
    schema: process.env.SNOWFLAKE_SCHEMA,
    privateKeyPath: process.env.SNOWFLAKE_PRIVATE_KEY_PATH,
    privateKeyPassphrase: process.env.SNOWFLAKE_PRIVATE_KEY_PASSPHRASE,
    clientSessionKeepAlive: String(process.env.SNOWFLAKE_CLIENT_SESSION_KEEP_ALIVE || "false").toLowerCase() === "true",
    queryTag: process.env.SNOWFLAKE_QUERY_TAG || ""
  },
  staticUser: process.env.APP_STATIC_USER || "SUPTOSR@flsmidth.com"
};
