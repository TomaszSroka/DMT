const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveCheckOutResultFromProcedureResult } = require("./check-out-result-parser");

test("resolveCheckOutResultFromProcedureResult reads TABLE_NAME and PROCEDURE_RESULT from nested VARIANT", () => {
  const rows = [
    {
      MET_CHECK_OUT_EDIT: {
        PROCEDURE_RESULT: "RECORD_EXISTS",
        VERSION_NAME: "0.0.1.1",
        USER_LOGIN: "UPDATER@FLSMIDTH.COM",
        TABLE_NAME: "FLS_DEV_DB_SUPTOSR.DMT.DIC_GLOBAL_PROJECT_NUMBER_1"
      }
    }
  ];

  const result = resolveCheckOutResultFromProcedureResult(rows);

  assert.equal(result.procedureResult, "RECORD_EXISTS");
  assert.equal(result.tableName, "FLS_DEV_DB_SUPTOSR.DMT.DIC_GLOBAL_PROJECT_NUMBER_1");
  assert.equal(result.versionName, "0.0.1.1");
  assert.equal(result.userLogin, "UPDATER@FLSMIDTH.COM");
});

test("resolveCheckOutResultFromProcedureResult reads TABLE_NAME and PROCEDURE_RESULT from direct VARIANT row", () => {
  const rows = [
    {
      PROCEDURE_RESULT: "RECORD_INSERTED",
      TABLE_NAME: "DB.SCHEMA.DIC_X"
    }
  ];

  const result = resolveCheckOutResultFromProcedureResult(rows);

  assert.equal(result.procedureResult, "RECORD_INSERTED");
  assert.equal(result.tableName, "DB.SCHEMA.DIC_X");
  assert.equal(result.versionName, "");
  assert.equal(result.userLogin, "");
});
