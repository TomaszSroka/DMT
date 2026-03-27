function parseVariantObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      return null;
    }
  }

  return null;
}

function getFieldValueCaseInsensitive(source, fieldName) {
  if (!source || typeof source !== "object") {
    return "";
  }

  if (source[fieldName] !== undefined && source[fieldName] !== null) {
    return String(source[fieldName]).trim();
  }

  const key = Object.keys(source).find((item) => String(item).trim().toUpperCase() === fieldName);
  if (!key || source[key] === undefined || source[key] === null) {
    return "";
  }

  return String(source[key]).trim();
}

function resolveCheckOutResultFromProcedureResult(rows) {
  const firstRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!firstRow || typeof firstRow !== "object") {
    return {
      tableName: "",
      procedureResult: "",
      versionName: "",
      userLogin: ""
    };
  }

  let variantPayload = parseVariantObject(firstRow);
  if (!variantPayload || (!getFieldValueCaseInsensitive(variantPayload, "TABLE_NAME")
    && !getFieldValueCaseInsensitive(variantPayload, "PROCEDURE_RESULT"))) {
    const nestedVariant = Object.values(firstRow)
      .map((value) => parseVariantObject(value))
      .find((value) => Boolean(value));
    if (nestedVariant) {
      variantPayload = nestedVariant;
    }
  }

  const tableName = getFieldValueCaseInsensitive(variantPayload, "TABLE_NAME");
  const procedureResult = getFieldValueCaseInsensitive(variantPayload, "PROCEDURE_RESULT").toUpperCase();
  const versionName = getFieldValueCaseInsensitive(variantPayload, "VERSION_NAME");
  const userLogin = getFieldValueCaseInsensitive(variantPayload, "USER_LOGIN");

  return {
    tableName,
    procedureResult,
    versionName,
    userLogin
  };
}

module.exports = {
  resolveCheckOutResultFromProcedureResult
};
