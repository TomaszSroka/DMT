const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const dotenv = require("dotenv");

const TEST_PORT = 3310;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

let serverProcess;

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function buildTestConfigJson() {
  const raw = process.env.DMT_CONFIG_JSON || "{}";
  const parsed = JSON.parse(raw);
  parsed.DMT_PORT = TEST_PORT;
  parsed.READINESS_CACHE_MS = 0;
  return JSON.stringify(parsed);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, attempts = 40, delayMs = 250) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch (error) {
      // Keep retrying until server boots.
    }

    await sleep(delayMs);
  }

  throw new Error("Server did not become ready for contract tests.");
}

test.before(async () => {
  serverProcess = spawn(process.execPath, ["backend/api/app.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DMT_CONFIG_JSON: buildTestConfigJson()
    },
    stdio: ["ignore", "ignore", "pipe"]
  });

  serverProcess.stderr.on("data", () => {
    // Keep stderr drained to avoid blocking child process.
  });

  await waitForServer(`${BASE_URL}/api/health`);
});

test.after(async () => {
  if (!serverProcess || serverProcess.killed) {
    return;
  }

  await new Promise((resolve) => {
    serverProcess.once("exit", () => resolve());
    serverProcess.kill("SIGTERM");
  });
});

test("health endpoint contract", async () => {
  const response = await fetch(`${BASE_URL}/api/health`);
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.equal(payload.status, "ok");
  assert.equal(typeof payload.uptimeSec, "number");
  assert.equal(typeof payload.timestamp, "string");
  assert.equal(typeof payload.pool, "object");
});

test("ready endpoint contract", async () => {
  const response = await fetch(`${BASE_URL}/api/ready`);
  const payload = await response.json();

  assert.ok(response.status === 200 || response.status === 503);

  if (response.status === 200) {
    assert.equal(payload.status, "ready");
    assert.equal(typeof payload.timestamp, "string");
    assert.equal(typeof payload.pool, "object");
  } else {
    assert.equal(payload.status, "not-ready");
    assert.equal(typeof payload.error, "string");
    assert.equal(typeof payload.errorCode, "string");
  }
});
