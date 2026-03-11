const express = require("express");
const path = require("path");
const { port } = require("../config/env");
const { getErrorPayload } = require("../errors/app-error");
const { runQuery, shutdownPool, getPoolStats } = require("../config/snowflake");
const tableRoutes = require("../routes/table.routes");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.resolve(process.cwd(), "frontend")));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    pool: getPoolStats()
  });
});

app.get("/api/ready", async (req, res) => {
  try {
    await runQuery("SELECT 1 AS OK");
    res.json({
      status: "ready",
      timestamp: new Date().toISOString(),
      pool: getPoolStats()
    });
  } catch (error) {
    const payload = getErrorPayload(error, "Service is not ready.", "READINESS_FAILED");
    res.status(503).json({
      error: payload.message,
      errorCode: payload.errorCode,
      status: "not-ready"
    });
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

  try {
    await new Promise((resolve) => {
      server.close(() => resolve());
    });
    await shutdownPool();
  } catch (error) {
    console.error("Shutdown error:", error && error.message ? error.message : error);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => {
  gracefulShutdown("SIGINT");
});

process.on("SIGTERM", () => {
  gracefulShutdown("SIGTERM");
});
