const fs = require("fs");
const path = require("path");
const snowflake = require("snowflake-sdk");
const snowflakeLogger = require("snowflake-sdk/lib/logger");
const { snowflake: snowflakeConfig } = require("./env");

const logsDir = path.resolve(process.cwd(), "logs");
const snowflakeLogPath = path.join(logsDir, "snowflake.log");
const snowflakeQueriesLogPath = path.join(logsDir, "snowflake-queries");

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function truncateLogFile(filePath) {
  try {
    fs.writeFileSync(filePath, "", "utf8");
  } catch (error) {
    console.error("Failed to truncate log file:", filePath, error.message);
  }
}

// Temporary safeguard: keep logs small by truncating both files on each app start.
truncateLogFile(snowflakeLogPath);
truncateLogFile(snowflakeQueriesLogPath);

// Pre-configure SDK logger before snowflake.configure() so no bootstrap log is written to project root.
snowflakeLogger.getInstance().configure({
  level: 2,
  filePath: snowflakeLogPath,
  additionalLogToConsole: true
});

snowflake.configure({
  logLevel: "INFO",
  logFilePath: snowflakeLogPath,
  additionalLogToConsole: true
});

const MIN_POOL_SIZE = 1;
const MAX_POOL_SIZE = 10;
const MIN_WAIT_TIMEOUT_MS = 1000;
const normalizedPoolSize = Number.isFinite(snowflakeConfig.poolSize) ? snowflakeConfig.poolSize : 2;
const poolSize = Math.min(Math.max(normalizedPoolSize, MIN_POOL_SIZE), MAX_POOL_SIZE);
const poolWaitTimeoutMs = Math.max(
  Number.isFinite(snowflakeConfig.poolWaitTimeoutMs) ? snowflakeConfig.poolWaitTimeoutMs : 15000,
  MIN_WAIT_TIMEOUT_MS
);
const poolDebug = Boolean(snowflakeConfig.poolDebug);

const pool = Array.from({ length: poolSize }, () => ({
  connection: null,
  connected: false,
  busy: false,
  connectPromise: null
}));

const waitQueue = [];
let isShuttingDown = false;
const poolMetrics = {
  executedQueries: 0,
  retriedQueries: 0,
  failedQueries: 0,
  totalWaitMs: 0,
  totalQueryMs: 0,
  maxObservedQueue: 0
};

function nowMs() {
  return Number(process.hrtime.bigint() / 1000000n);
}

function getPoolStats() {
  const busy = pool.filter((slot) => slot.busy).length;
  const connected = pool.filter((slot) => slot.connected).length;

  return {
    size: poolSize,
    busy,
    connected,
    available: poolSize - busy,
    waitQueue: waitQueue.length,
    shuttingDown: isShuttingDown,
    metrics: { ...poolMetrics }
  };
}

function logPoolDebug(event, extra = {}) {
  if (!poolDebug) {
    return;
  }

  const stats = getPoolStats();
  console.log(`[snowflake-pool] ${event}`, {
    ...extra,
    busy: stats.busy,
    available: stats.available,
    waitQueue: stats.waitQueue
  });
}

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

function nowIso() {
  return new Date().toISOString();
}

function normalizeMultilineText(value) {
  return String(value || "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return `"<json-serialize-error:${String(error && error.message ? error.message : error)}>"`;
  }
}

function appendSnowflakeQueryLog({ status, sqlText, binds, durationMs, errorMessage }) {
  const sql = normalizeMultilineText(sqlText);
  const bindsJson = safeJson(Array.isArray(binds) ? binds : []);
  const lineParts = [
    `[${nowIso()}]`,
    String(status || "UNKNOWN"),
    `durationMs=${Number.isFinite(durationMs) ? durationMs : -1}`,
    `sql="${sql.replace(/"/g, '\\"')}"`,
    `binds=${bindsJson}`
  ];

  if (errorMessage) {
    lineParts.push(`error="${normalizeMultilineText(errorMessage).replace(/"/g, '\\"')}"`);
  }

  const logLine = `${lineParts.join(" | ")}\n`;
  fs.appendFile(snowflakeQueriesLogPath, logLine, (appendError) => {
    if (appendError) {
      console.error("Snowflake query log append error:", appendError.message);
    }
  });
}

function isRecoverableConnectionError(error) {
  const message = String((error && error.message) || "").toLowerCase();
  if (!message) {
    return false;
  }

  return (
    message.includes("not connected") ||
    message.includes("connection is closed") ||
    message.includes("connection not established") ||
    message.includes("network error")
  );
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

function destroyConnection(connection) {
  return new Promise((resolve) => {
    if (!connection) {
      resolve();
      return;
    }

    connection.destroy((error) => {
      if (error) {
        const message = String(error && error.message ? error.message : "").toLowerCase();
        const isAlreadyDisconnected = message.includes("already disconnected") || message.includes("not connected");
        if (!isAlreadyDisconnected) {
          console.error("Snowflake connection destroy error:", error.message);
        }
      }
      resolve();
    });
  });
}

async function resetSlot(slot) {
  const existing = slot.connection;
  slot.connection = null;
  slot.connected = false;
  slot.connectPromise = null;
  await destroyConnection(existing);
}

async function ensureSlotConnected(slot) {
  if (slot.connected && slot.connection) {
    return slot.connection;
  }

  if (!slot.connectPromise) {
    const connection = createConnection();
    slot.connection = connection;
    slot.connectPromise = connect(connection)
      .then(() => {
        slot.connected = true;
        return connection;
      })
      .catch(async (error) => {
        await resetSlot(slot);
        throw error;
      })
      .finally(() => {
        slot.connectPromise = null;
      });
  }

  await slot.connectPromise;
  return slot.connection;
}

function resolveQueuedWaiter(waiter, slot) {
  if (!waiter) {
    return;
  }

  poolMetrics.totalWaitMs += nowMs() - waiter.waitStart;
  waiter.resolve(slot);
}

function rejectQueuedWaiter(waiter, error) {
  if (!waiter) {
    return;
  }

  poolMetrics.totalWaitMs += nowMs() - waiter.waitStart;
  waiter.reject(error);
}

function createPoolError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function acquireSlot() {
  if (isShuttingDown) {
    return Promise.reject(new Error("Snowflake pool is shutting down."));
  }

  const waitStart = nowMs();
  const freeSlot = pool.find((slot) => !slot.busy);
  if (freeSlot) {
    freeSlot.busy = true;
    poolMetrics.totalWaitMs += nowMs() - waitStart;
    return Promise.resolve(freeSlot);
  }

  return new Promise((resolve, reject) => {
    const waiter = {
      resolve,
      reject,
      waitStart,
      timeoutId: null
    };

    waiter.timeoutId = setTimeout(() => {
      const index = waitQueue.indexOf(waiter);
      if (index >= 0) {
        waitQueue.splice(index, 1);
      }

      rejectQueuedWaiter(
        waiter,
        createPoolError("Snowflake query queue timeout.", 503, "SNOWFLAKE_POOL_QUEUE_TIMEOUT")
      );
    }, poolWaitTimeoutMs);

    waitQueue.push(waiter);
    poolMetrics.maxObservedQueue = Math.max(poolMetrics.maxObservedQueue, waitQueue.length);
    logPoolDebug("queue-wait", { queued: waitQueue.length });
  });
}

function releaseSlot(slot) {
  const nextWaiter = waitQueue.shift();
  if (nextWaiter) {
    if (nextWaiter.timeoutId) {
      clearTimeout(nextWaiter.timeoutId);
      nextWaiter.timeoutId = null;
    }
    slot.busy = true;
    resolveQueuedWaiter(nextWaiter, slot);
    return;
  }

  slot.busy = false;
}

async function runQuery(sqlText, binds = []) {
  const queryStart = nowMs();
  const slot = await acquireSlot();

  try {
    const connection = await ensureSlotConnected(slot);
    const result = await execute(connection, sqlText, binds);
    appendSnowflakeQueryLog({
      status: "SUCCESS",
      sqlText,
      binds,
      durationMs: nowMs() - queryStart
    });
    poolMetrics.executedQueries += 1;
    poolMetrics.totalQueryMs += nowMs() - queryStart;
    return result.rows;
  } catch (error) {
    if (isRecoverableConnectionError(error)) {
      await resetSlot(slot);
      const connection = await ensureSlotConnected(slot);
      const result = await execute(connection, sqlText, binds);
      appendSnowflakeQueryLog({
        status: "SUCCESS",
        sqlText,
        binds,
        durationMs: nowMs() - queryStart
      });
      poolMetrics.retriedQueries += 1;
      poolMetrics.executedQueries += 1;
      poolMetrics.totalQueryMs += nowMs() - queryStart;
      return result.rows;
    }

    appendSnowflakeQueryLog({
      status: "ERROR",
      sqlText,
      binds,
      durationMs: nowMs() - queryStart,
      errorMessage: error && error.message ? error.message : String(error)
    });

    poolMetrics.failedQueries += 1;
    throw error;
  } finally {
    releaseSlot(slot);
  }
}

async function shutdownPool() {
  isShuttingDown = true;

  const shutdownError = new Error("Snowflake pool is shutting down.");
  while (waitQueue.length > 0) {
    const waiter = waitQueue.shift();
    if (waiter && waiter.timeoutId) {
      clearTimeout(waiter.timeoutId);
      waiter.timeoutId = null;
    }
    rejectQueuedWaiter(waiter, shutdownError);
  }

  await Promise.all(
    pool.map(async (slot) => {
      await resetSlot(slot);
      slot.busy = false;
    })
  );

  logPoolDebug("shutdown-complete");
}

module.exports = {
  runQuery,
  shutdownPool,
  getPoolStats
};
