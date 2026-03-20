/**
 * ui-helpers.js
 *
 * Provides utility functions for UI components.
 * - Escapes HTML, formats text, truncates values, fills templates, and formats meta info.
 * - Used throughout the frontend for safe rendering and consistent formatting.
 * Usage: Import functions as needed in UI scripts and components.
 */

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function textValue(key, UI_TEXT = {}, SHARED_UI = {}) {
  if (typeof SHARED_UI.textValue === "function") {
    return SHARED_UI.textValue(key);
  }
  return UI_TEXT[key] || `[${key}]`;
}

export function truncateValue(value, maxLength = 120) {
  const text = value == null ? "" : String(value);
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}...`;
}

export function fillTemplate(template, values) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, k) => values[k] ?? "");
}

export function formatRowsMeta(visibleRowsCount, allRowsCount, textValueFn) {
  return `${textValueFn("rowsLabel")}: ${visibleRowsCount}/${allRowsCount}`;
}

export function formatPagesMeta(page, pages, textValueFn) {
  return `${textValueFn("pageLabel")}: ${page}/${pages}`;
}

export const uiFormats = {
  filtersSummaryTemplate: '{column} IN "{value}"',
  filtersSummaryJoiner: ' AND ',
  rolePairSeparator: ' - ',
  changeArrow: ' -> ',
  filterDraftRowTemplate: 'Filter rule: Column - Value: {column} - {value}'
};
