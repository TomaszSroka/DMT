(function initDmtSharedUiModule() {
  const runtimeConfig = window.FRONTEND_RUNTIME_CONFIG || {};
  const uiText = runtimeConfig.text || {};
  const uiDefaults = runtimeConfig.defaults || {};
  const uiBehavior = runtimeConfig.uiBehavior || {};

  function textValue(key) {
    return uiText[key] || `[${key}]`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function truncateValue(value, maxLength = uiDefaults.maxCellChars || 120) {
    const text = value == null ? "" : String(value);
    if (text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, maxLength - 1)}...`;
  }

  function fillTemplate(template, values) {
    return Object.keys(values || {}).reduce((result, key) => {
      const token = `{${key}}`;
      const tokenValue = values[key] == null ? "" : String(values[key]);
      return result.replaceAll(token, tokenValue);
    }, String(template || ""));
  }

  function formatRowsMeta(visibleRowsCount, allRowsCount) {
    return `${textValue("rowsLabel")}: ${visibleRowsCount}/${allRowsCount}`;
  }

  function formatPagesMeta(page, pages) {
    return `${textValue("pageLabel")}: ${page}/${pages}`;
  }

  const uiFormats = {
    filtersSummaryTemplate: String(uiBehavior.filtersSummaryTemplate || '{column} IN "{value}"'),
    filtersSummaryJoiner: String(uiBehavior.filtersSummaryJoiner || " AND "),
    rolePairSeparator: String(uiBehavior.rolePairSeparator || " - "),
    changeArrow: String(uiBehavior.changeArrow || " -> "),
    filterDraftRowTemplate: String(uiBehavior.filterDraftRowTemplate || "Filter rule: Column - Value: {column} - {value}")
  };

  window.DMT = window.DMT || {};
  window.DMT.sharedUi = {
    textValue,
    escapeHtml,
    truncateValue,
    fillTemplate,
    formatRowsMeta,
    formatPagesMeta,
    uiFormats
  };
})();
