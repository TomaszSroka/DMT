const express = require("express");
const path = require("path");
const { port, readinessCacheMs } = require("../config/env");
const { getErrorPayload } = require("../errors/app-error");
const { runQuery, shutdownPool, getPoolStats } = require("../config/snowflake");
const tableRoutes = require("../routes/table.routes");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.resolve(process.cwd(), "frontend")));

const readinessTtlMs = Number.isFinite(readinessCacheMs) ? Math.max(readinessCacheMs, 0) : 5000;
let readinessCache = {
  expiresAt: 0,
  statusCode: 200,
  payload: null
};

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    pool: getPoolStats()
  });
});

app.get("/api/ready", async (req, res) => {
  const now = Date.now();
  if (readinessCache.payload && now < readinessCache.expiresAt) {
    res.status(readinessCache.statusCode).json(readinessCache.payload);
    return;
  }

  try {
    await runQuery("SELECT 1 AS OK");
    const payload = {
      status: "ready",
      timestamp: new Date().toISOString(),
      pool: getPoolStats()
    };
    readinessCache = {
      statusCode: 200,
      payload,
      expiresAt: now + readinessTtlMs
    };
    res.json(payload);
  } catch (error) {
    const payload = getErrorPayload(error, "Service is not ready.", "READINESS_FAILED");
    const responsePayload = {
      error: payload.message,
      errorCode: payload.errorCode,
      status: "not-ready"
    };
    readinessCache = {
      statusCode: 503,
      payload: responsePayload,
      expiresAt: now + readinessTtlMs
    };
    res.status(503).json(responsePayload);
  }
});

app.use("/api", tableRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error", errorCode: "INTERNAL_SERVER_ERROR" });
});

const server = app.listen(port, () => {
  console.log(`DMT app started on http://localhost:${port}`);
});

let shutdownStarted = false;
async function gracefulShutdown(signal) {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  console.log(`Received ${signal}, shutting down gracefully...`);

  const forceExitTimer = setTimeout(() => {
    console.error("Graceful shutdown timeout exceeded. Forcing exit.");
    process.exit(1);
  }, 15000);

  if (typeof forceExitTimer.unref === "function") {
    forceExitTimer.unref();
  }

  let exitCode = 0;

  try {
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
    await shutdownPool();
  } catch (error) {
    exitCode = 1;
    console.error("Shutdown error:", error && error.message ? error.message : error);
  } finally {
    clearTimeout(forceExitTimer);
    process.exit(exitCode);
  }
}

process.on("SIGINT", () => {
  gracefulShutdown("SIGINT");
});

process.on("SIGTERM", () => {
  gracefulShutdown("SIGTERM");
});
