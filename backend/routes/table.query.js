const { createAppError } = require("../errors/app-error");

function hasQueryValue(value) {
  return value !== undefined && value !== null && String(value).trim().length > 0;
}

function parsePositiveIntegerQuery(value, message, errorCode) {
  if (!hasQueryValue(value)) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw createAppError(message, 400, errorCode);
  }

  return parsed;
}

function parseFiltersQuery(value) {
  if (!hasQueryValue(value)) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw createAppError("Query param 'filters' must be a JSON string.", 400, "FILTERS_QUERY_INVALID");
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      throw new Error("not-array");
    }
    return parsed;
  } catch (error) {
    throw createAppError("Query param 'filters' must be a JSON array.", 400, "FILTERS_QUERY_INVALID");
  }
}

function parseSortDirectionQuery(value) {
  if (!hasQueryValue(value)) {
    return "";
  }

  const direction = String(value).trim().toUpperCase();
  if (direction !== "ASC" && direction !== "DESC") {
    throw createAppError("Query param 'sortDirection' must be ASC or DESC.", 400, "SORT_DIRECTION_INVALID");
  }

  return direction;
}

function validateRowsQuery(req) {
  const page = parsePositiveIntegerQuery(req.query.page, "Query param 'page' must be a positive integer.", "PAGE_INVALID");
  const pageSize = parsePositiveIntegerQuery(
    req.query.pageSize,
    "Query param 'pageSize' must be a positive integer.",
    "PAGE_SIZE_INVALID"
  );
  const dictionaryVersionKey = String(req.query.dictionaryVersionKey || "").trim();
  const checkoutDictionaryLocation = String(req.query.checkoutDictionaryLocation || "").trim();
  const filters = parseFiltersQuery(req.query.filters);
  const sortColumn = String(req.query.sortColumn || "").trim();
  const sortDirection = parseSortDirectionQuery(req.query.sortDirection);

  return {
    page,
    pageSize,
    dictionaryVersionKey,
    checkoutDictionaryLocation,
    filters,
    sortColumn,
    sortDirection
  };
}

module.exports = {
  validateRowsQuery
};
