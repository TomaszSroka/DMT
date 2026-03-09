const fs = require("fs");
const snowflake = require("snowflake-sdk");
const { snowflake: snowflakeConfig } = require("./env");

function assertPrivateKeyFileExists() {
  if (!fs.existsSync(snowflakeConfig.privateKeyPath)) {
    throw new Error(`Private key file does not exist: ${snowflakeConfig.privateKeyPath}`);
  }
}

function createConnection() {
  assertPrivateKeyFileExists();

  return snowflake.createConnection({
    account: snowflakeConfig.account,
    username: snowflakeConfig.username,
    role: snowflakeConfig.role,
    warehouse: snowflakeConfig.warehouse,
    database: snowflakeConfig.database,
    schema: snowflakeConfig.schema,
    clientSessionKeepAlive: snowflakeConfig.clientSessionKeepAlive,
    sessionParameters: {
      QUERY_TAG: snowflakeConfig.queryTag
    },
    authenticator: "SNOWFLAKE_JWT",
    privateKeyPath: snowflakeConfig.privateKeyPath,
    privateKeyPass: snowflakeConfig.privateKeyPassphrase
  });
}

function connect(connection) {
  return new Promise((resolve, reject) => {
    connection.connect((error, conn) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(conn);
    });
  });
}

function execute(connection, sqlText, binds = []) {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      binds,
      complete: (error, statement, rows) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ statement, rows });
      }
    });
  });
}

async function runQuery(sqlText, binds = []) {
  const connection = createConnection();
  await connect(connection);

  try {
    const result = await execute(connection, sqlText, binds);
    return result.rows;
  } finally {
    connection.destroy((error) => {
      if (error) {
        console.error("Snowflake connection destroy error:", error.message);
      }
    });
  }
}

module.exports = {
  runQuery
};
