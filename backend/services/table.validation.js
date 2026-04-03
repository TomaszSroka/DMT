const { createAppError } = require("../errors/app-error");

function isSafeColumnIdentifier(identifier) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(identifier || "").trim());
}

function parseFilterRulesInput(filtersInput) {
  if (!filtersInput) {
    return [];
  }

  if (Array.isArray(filtersInput)) {
    return filtersInput;
  }

  if (typeof filtersInput === "string") {
    const trimmed = filtersInput.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      throw createAppError("Filters payload is invalid.", 400, "FILTERS_INVALID");
    }
  }

  return [];
}

function toSqlLikePattern(value) {
  const text = String(value || "").trim();
  const escaped = text
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_")
    .replaceAll("*", "%");

  if (!text.includes("*")) {
    return `%${escaped}%`;
  }

  return escaped;
}

function normalizeFilterRules(filtersInput) {
  const rawRules = parseFilterRulesInput(filtersInput);
  const normalized = [];

  rawRules.forEach((rule) => {
    const column = String(rule && rule.column != null ? rule.column : "").trim().toUpperCase();
    const value = String(rule && rule.value != null ? rule.value : "").trim();
    if (!column || !value) {
      return;
    }

    if (!isSafeColumnIdentifier(column)) {
      throw createAppError("Filter column is invalid.", 400, "FILTER_COLUMN_INVALID");
    }

    normalized.push({
      column,
      pattern: toSqlLikePattern(value)
    });
  });

  return normalized;
}

function normalizeSortDirection(direction) {
  const value = String(direction || "").trim().toUpperCase();
  return value === "DESC" ? "DESC" : "ASC";
}

function isSafeOrderByPhrase(orderByPhrase) {
  const phrase = String(orderByPhrase || "").trim();
  if (!phrase) {
    return false;
  }

  const parts = phrase.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
  if (parts.length === 0) {
    return false;
  }

  const identifier = '(?:"[A-Za-z_][A-Za-z0-9_]*"|[A-Za-z_][A-Za-z0-9_]*)';
  const qualifiedIdentifier = `(?:${identifier})(?:\\.${identifier})*`;
  const pattern = new RegExp(`^${qualifiedIdentifier}(?:\\s+(?:ASC|DESC))?(?:\\s+NULLS\\s+(?:FIRST|LAST))?$`, 'i');
  return parts.every((part) => pattern.test(part));
}

module.exports = {
  parseFilterRulesInput,
  toSqlLikePattern,
  normalizeFilterRules,
  normalizeSortDirection,
  isSafeOrderByPhrase
};
