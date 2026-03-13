const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeFilterRules,
  normalizeSortDirection,
  isSafeOrderByPhrase
} = require("./table.validation");

test("normalizeFilterRules builds LIKE patterns with escaping", () => {
  const rules = normalizeFilterRules([
    { column: "project_id", value: "abc" },
    { column: "name", value: "*A_B%" }
  ]);

  assert.deepEqual(rules, [
    { column: "PROJECT_ID", pattern: "%abc%" },
    { column: "NAME", pattern: "%A\\_B\\%" }
  ]);
});

test("normalizeFilterRules throws for invalid JSON string", () => {
  assert.throws(
    () => normalizeFilterRules("{invalid"),
    (error) => error && error.code === "FILTERS_INVALID" && error.status === 400
  );
});

test("normalizeFilterRules throws for unsafe column identifier", () => {
  assert.throws(
    () => normalizeFilterRules([{ column: "ID;DROP", value: "123" }]),
    (error) => error && error.code === "FILTER_COLUMN_INVALID" && error.status === 400
  );
});

test("normalizeSortDirection supports DESC and defaults to ASC", () => {
  assert.equal(normalizeSortDirection("DESC"), "DESC");
  assert.equal(normalizeSortDirection("desc"), "DESC");
  assert.equal(normalizeSortDirection("anything"), "ASC");
});

test("isSafeOrderByPhrase accepts safe clauses and rejects suspicious input", () => {
  assert.equal(isSafeOrderByPhrase('"COL_A" DESC, "COL_B" ASC NULLS LAST'), true);
  assert.equal(isSafeOrderByPhrase("COL_A; DROP TABLE X"), false);
  assert.equal(isSafeOrderByPhrase(""), false);
});
