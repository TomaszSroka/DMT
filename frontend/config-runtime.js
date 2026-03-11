(function buildFrontendRuntimeConfig() {
  const frontendConfig = window.FRONTEND_CONFIG || {};
  const rawDefaults = frontendConfig.defaults || {};

  const fallbackDefaults = {
    maxCellChars: 120,
    pageSize: 100,
    longTextThreshold: 90,
    userDetailsDropdownThreshold: 15,
    hiddenColumns: ["DICTIONARY_INSTANCE_KEY"]
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

  window.FRONTEND_RUNTIME_CONFIG = {
    text: frontendConfig.text || {},
    typography: frontendConfig.typography || {},
    defaults: {
      maxCellChars: normalizePositiveInteger(rawDefaults.maxCellChars, fallbackDefaults.maxCellChars),
      pageSize: normalizePositiveInteger(rawDefaults.pageSize, fallbackDefaults.pageSize),
      longTextThreshold: normalizePositiveInteger(rawDefaults.longTextThreshold, fallbackDefaults.longTextThreshold),
      userDetailsDropdownThreshold: normalizePositiveInteger(
        rawDefaults.userDetailsDropdownThreshold,
        fallbackDefaults.userDetailsDropdownThreshold
      ),
      hiddenColumns: normalizeHiddenColumns(rawDefaults.hiddenColumns, fallbackDefaults.hiddenColumns)
    }
  };
})();
