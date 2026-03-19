// Funkcje pomocnicze
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

export function formatRowsMeta(visibleRowsCount, allRowsCount, textValueFn) {
  return `${textValueFn("rowsLabel")}: ${visibleRowsCount}/${allRowsCount}`;
}

export function formatPagesMeta(page, pages, textValueFn) {
  return `${textValueFn("pageLabel")}: ${page}/${pages}`;
}

export function fillTemplate(template, values) {
  // Prosta zamiana {key} na values[key]
  return String(template || "").replace(/\{(\w+)\}/g, (_, k) => values[k] ?? "");
}

export async function fetchJson(url, API_CLIENT = {}) {
  if (typeof API_CLIENT.fetchJson === "function") {
    return API_CLIENT.fetchJson(url);
  }
  throw new Error("unknownApiError");
}
