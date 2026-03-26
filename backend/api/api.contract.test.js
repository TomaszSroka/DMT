const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const dotenv = require("dotenv");

const TEST_PORT = 3310;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

let serverProcess;

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

function tryParseJsonObject(raw) {
  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
}

function readDmtConfigJsonFromEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return "";
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  const startIdx = lines.findIndex((line) => /^\s*DMT_CONFIG_JSON\s*=\s*/.test(line));
  if (startIdx < 0) {
    return "";
  }

  const jsonLines = [];
  let foundStart = false;

  for (let i = startIdx; i < lines.length; i += 1) {
    const line = lines[i];
    if (!foundStart) {
      const afterPrefix = line.replace(/^\s*DMT_CONFIG_JSON\s*=\s*/, "");
      if (/^\s*\{/.test(afterPrefix)) {
        jsonLines.push(afterPrefix);
        foundStart = true;
        if (/\}\s*$/.test(afterPrefix)) {
          break;
        }
      }
      continue;
    }

    jsonLines.push(line);
    if (/^\s*\}/.test(line)) {
      break;
    }
  }

  return jsonLines.join("\n");
}

function buildTestConfigJson() {
  const parsedFromEnv = tryParseJsonObject(process.env.DMT_CONFIG_JSON);
  const parsedFromFile = parsedFromEnv ? null : tryParseJsonObject(readDmtConfigJsonFromEnvFile());
  const parsed = parsedFromEnv || parsedFromFile;

  if (!parsed) {
    throw new Error("Unable to parse DMT_CONFIG_JSON from environment or .env file.");
  }

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

test("rows filtering ignores leading and trailing source whitespace", async (t) => {
  const metaResponse = await fetch(`${BASE_URL}/api/meta`);
  assert.equal(metaResponse.status, 200);
  const metaPayload = await metaResponse.json();

  const dictionaries = Array.isArray(metaPayload && metaPayload.dictionaries) ? metaPayload.dictionaries : [];
  if (dictionaries.length === 0) {
    t.skip("No dictionaries available for contract test.");
    return;
  }

  const dictionaryId = String(dictionaries[0].id);

  const versionsResponse = await fetch(`${BASE_URL}/api/dictionaries/${encodeURIComponent(dictionaryId)}/versions`);
  assert.equal(versionsResponse.status, 200);
  const versionsPayload = await versionsResponse.json();
  const versions = Array.isArray(versionsPayload && versionsPayload.versions) ? versionsPayload.versions : [];
  if (versions.length === 0) {
    t.skip("No dictionary versions available for contract test.");
    return;
  }

  const dictionaryVersionKey = String(versions[0].id);
  const rowsUrl = new URL(`${BASE_URL}/api/dictionaries/${encodeURIComponent(dictionaryId)}/rows`);
  rowsUrl.searchParams.set("page", "1");
  rowsUrl.searchParams.set("pageSize", "100");
  rowsUrl.searchParams.set("dictionaryVersionKey", dictionaryVersionKey);

  const rowsResponse = await fetch(rowsUrl);
  assert.equal(rowsResponse.status, 200);
  const rowsPayload = await rowsResponse.json();
  const rows = Array.isArray(rowsPayload && rowsPayload.rows) ? rowsPayload.rows : [];
  if (rows.length === 0) {
    t.skip("No rows available for contract test.");
    return;
  }

  let candidate = null;
  for (const row of rows) {
    for (const [column, rawValue] of Object.entries(row || {})) {
      if (typeof rawValue !== "string") {
        continue;
      }

      const trimmed = rawValue.trim();
      if (!trimmed || trimmed === rawValue) {
        continue;
      }

      candidate = {
        column,
        sourceValue: rawValue,
        filterValue: trimmed
      };
      break;
    }

    if (candidate) {
      break;
    }
  }

  if (!candidate) {
    t.skip("No row with leading/trailing whitespace found on first page.");
    return;
  }

  const filteredUrl = new URL(`${BASE_URL}/api/dictionaries/${encodeURIComponent(dictionaryId)}/rows`);
  filteredUrl.searchParams.set("page", "1");
  filteredUrl.searchParams.set("pageSize", "100");
  filteredUrl.searchParams.set("dictionaryVersionKey", dictionaryVersionKey);
  filteredUrl.searchParams.set("filters", JSON.stringify([{ column: candidate.column, value: candidate.filterValue }]));

  const filteredResponse = await fetch(filteredUrl);
  assert.equal(filteredResponse.status, 200);
  const filteredPayload = await filteredResponse.json();
  const filteredRows = Array.isArray(filteredPayload && filteredPayload.rows) ? filteredPayload.rows : [];

  assert.ok(filteredRows.length > 0, "Expected at least one row after filtering by trimmed value.");
  assert.ok(
    filteredRows.some((row) => {
      const value = row && row[candidate.column];
      return typeof value === "string" && value.trim() === candidate.filterValue;
    }),
    `Expected at least one filtered row with ${candidate.column} trimming to ${candidate.filterValue}.`
  );
});

test("snowflake connectivity check via ready endpoint", async () => {
  const response = await fetch(`${BASE_URL}/api/ready`);
  const payload = await response.json();

  assert.equal(response.status, 200, `Expected Snowflake-ready status 200, got ${response.status}.`);
  assert.equal(payload.status, "ready");
  assert.equal(typeof payload.timestamp, "string");
  assert.equal(typeof payload.pool, "object");
});

test("user, dictionary and version query payload structure contract", async (t) => {
  const userContextResponse = await fetch(`${BASE_URL}/api/user-context`);
  assert.equal(userContextResponse.status, 200);
  const userContextPayload = await userContextResponse.json();

  assert.equal(typeof userContextPayload.user, "string");
  assert.ok(userContextPayload.user.length > 0);
  assert.ok(Array.isArray(userContextPayload.roles));
  assert.ok(Array.isArray(userContextPayload.dictionaryRoles));

  const metaResponse = await fetch(`${BASE_URL}/api/meta`);
  assert.equal(metaResponse.status, 200);
  const metaPayload = await metaResponse.json();

  assert.equal(typeof metaPayload.user, "string");
  assert.ok(metaPayload.user.length > 0);
  assert.ok(Array.isArray(metaPayload.dictionaries));

  if (metaPayload.dictionaries.length === 0) {
    t.skip("No dictionaries available for structure contract test.");
    return;
  }

  const dictionary = metaPayload.dictionaries[0];
  assert.equal(typeof dictionary.id, "string");
  assert.ok(dictionary.id.length > 0);
  assert.equal(typeof dictionary.label, "string");
  assert.ok(dictionary.label.length > 0);
  assert.equal(typeof dictionary.canUpdate, "boolean");

  const versionsResponse = await fetch(
    `${BASE_URL}/api/dictionaries/${encodeURIComponent(dictionary.id)}/versions`
  );
  assert.equal(versionsResponse.status, 200);
  const versionsPayload = await versionsResponse.json();

  assert.ok(Array.isArray(versionsPayload.versions));
  assert.equal(typeof versionsPayload.canUpdate, "boolean");

  if (versionsPayload.versions.length === 0) {
    t.skip("No dictionary versions available for structure contract test.");
    return;
  }

  const version = versionsPayload.versions[0];
  assert.equal(typeof version.id, "string");
  assert.ok(version.id.length > 0);
  assert.equal(typeof version.label, "string");
  assert.ok(version.label.length > 0);

  const rowsUrl = new URL(`${BASE_URL}/api/dictionaries/${encodeURIComponent(dictionary.id)}/rows`);
  rowsUrl.searchParams.set("page", "1");
  rowsUrl.searchParams.set("pageSize", "1");
  rowsUrl.searchParams.set("dictionaryVersionKey", version.id);

  const rowsResponse = await fetch(rowsUrl);
  assert.equal(rowsResponse.status, 200);
  const rowsPayload = await rowsResponse.json();

  assert.ok(Array.isArray(rowsPayload.rows));
  assert.equal(typeof rowsPayload.page, "number");
  assert.equal(typeof rowsPayload.pageSize, "number");
  assert.equal(typeof rowsPayload.totalRows, "number");
  assert.equal(typeof rowsPayload.totalPages, "number");
  assert.equal(typeof rowsPayload.canUpdate, "boolean");
  assert.ok(Array.isArray(rowsPayload.roles));
  assert.equal(typeof rowsPayload.dictionaryVersionKey, "string");
  assert.equal(typeof rowsPayload.snapshotToken, "string");
  assert.ok(Array.isArray(rowsPayload.lockColumns));
});

test("user managers endpoint contract", async () => {
  const response = await fetch(`${BASE_URL}/api/user-managers`);
  assert.equal(response.status, 200);

  const payload = await response.json();
  assert.ok(Array.isArray(payload.users));

  if (payload.users.length > 0) {
    const first = payload.users[0];
    assert.equal(typeof first.userName, "string");
    assert.equal(typeof first.email, "string");
  }
});

test("dictionary check-out endpoint contract", async (t) => {
  const metaResponse = await fetch(`${BASE_URL}/api/meta`);
  assert.equal(metaResponse.status, 200);
  const metaPayload = await metaResponse.json();
  const dictionaries = Array.isArray(metaPayload && metaPayload.dictionaries) ? metaPayload.dictionaries : [];

  const updatableDictionary = dictionaries.find((item) => item && item.canUpdate === true);
  if (!updatableDictionary || !updatableDictionary.id) {
    t.skip("No updatable dictionary available for check-out contract test.");
    return;
  }

  const versionsResponse = await fetch(
    `${BASE_URL}/api/dictionaries/${encodeURIComponent(updatableDictionary.id)}/versions`
  );
  assert.equal(versionsResponse.status, 200);
  const versionsPayload = await versionsResponse.json();
  const versions = Array.isArray(versionsPayload && versionsPayload.versions) ? versionsPayload.versions : [];

  if (versions.length === 0 || !versions[0].id) {
    t.skip("No dictionary versions available for check-out contract test.");
    return;
  }

  const checkoutResponse = await fetch(
    `${BASE_URL}/api/dictionaries/${encodeURIComponent(updatableDictionary.id)}/check-out`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ dictionaryVersionKey: versions[0].id })
    }
  );

  assert.equal(checkoutResponse.status, 200);
  const checkoutPayload = await checkoutResponse.json();
  assert.equal(typeof checkoutPayload.checkOutDictionaryLocation, "string");
  assert.equal(typeof checkoutPayload.created, "boolean");
});
