/**
 * config-runtime.js
 *
 * Builds and normalizes the runtime configuration for the frontend (window.FRONTEND_RUNTIME_CONFIG).
 * - Normalizes values from FRONTEND_CONFIG for use at runtime.
 * - Ensures fallback values for missing or invalid config entries.
 * Usage: Loaded after config-frontend.js to provide runtime config for the app.
 */

(function buildFrontendRuntimeConfig() {
  const frontendConfig = window.FRONTEND_CONFIG || {};
  const rawDefaults = frontendConfig.defaults || {};
  const rawUiBehavior = frontendConfig.uiBehavior || {};

  const fallbackDefaults = {
    maxCellChars: 120,
    pageSize: 100,
    longTextThreshold: 90,
    userDetailsDropdownThreshold: 15,
    hiddenColumns: ["DICTIONARY_VERSION_KEY"]
  };

  function normalizePositiveInteger(value, fallbackValue) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return fallbackValue;
    }
    return parsed;
  }

  function normalizeHiddenColumns(columns, fallbackColumns) {
    if (!Array.isArray(columns) || columns.length === 0) {
      return fallbackColumns;
    }

    return columns
      .map((column) => String(column || "").trim().toUpperCase())
      .filter((column) => column.length > 0);
  }

  function normalizeSortDirection(value, fallbackValue) {
    const direction = String(value || "").trim().toUpperCase();
    if (direction === "DESC") {
      return "DESC";
    }
    if (direction === "ASC") {
      return "ASC";
    }
    return fallbackValue;
  }

  function normalizeString(value, fallbackValue) {
    const normalized = String(value == null ? "" : value).trim();
    return normalized.length > 0 ? normalized : fallbackValue;
  }

  window.FRONTEND_RUNTIME_CONFIG = {
    text: frontendConfig.text || {},
    typography: {
      ...(frontendConfig.typography || {}),
      columnHeaderFont: normalizeString(
        frontendConfig.typography && frontendConfig.typography.columnHeaderFont,
        normalizeString(
          frontendConfig.typography && frontendConfig.typography.primaryFont,
          'sans-serif'
        )
      )
    },
    defaults: {
      maxCellChars: normalizePositiveInteger(rawDefaults.maxCellChars, fallbackDefaults.maxCellChars),
      pageSize: normalizePositiveInteger(rawDefaults.pageSize, fallbackDefaults.pageSize),
      longTextThreshold: normalizePositiveInteger(rawDefaults.longTextThreshold, fallbackDefaults.longTextThreshold),
      userDetailsDropdownThreshold: normalizePositiveInteger(
        rawDefaults.userDetailsDropdownThreshold,
        fallbackDefaults.userDetailsDropdownThreshold
      ),
      hiddenColumns: normalizeHiddenColumns(rawDefaults.hiddenColumns, fallbackDefaults.hiddenColumns)
    },
    uiBehavior: {
      defaultSortDirection: normalizeSortDirection(rawUiBehavior.defaultSortDirection, "ASC"),
      versionDetailsHiddenColumns: normalizeHiddenColumns(rawUiBehavior.versionDetailsHiddenColumns, ["DICTIONARY_LOCATION", "DICTIONARY_VERSION_CODE", "DICTIONARY_VERSION_KEY"]),
      filtersSummaryTemplate: normalizeString(rawUiBehavior.filtersSummaryTemplate, '{column} IN "{value}"'),
      filtersSummaryJoiner: normalizeString(rawUiBehavior.filtersSummaryJoiner, " AND "),
      rolePairSeparator: normalizeString(rawUiBehavior.rolePairSeparator, " - "),
      changeArrow: normalizeString(rawUiBehavior.changeArrow, " -> "),
      filterDraftRowTemplate: normalizeString(
        rawUiBehavior.filterDraftRowTemplate,
        "Filter rule: Column - Value: {column} - {value}"
      )
    }
  };
})();
