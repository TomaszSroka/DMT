/**
 * ApiClient.js
 *
 * Provides unified API client functions for the frontend.
 * - Defines ApiRequestError for standardized error handling.
 * - Exposes fetchJson() for fetching JSON from backend APIs with error handling.
 * - Exposes setCurrentUserKey() to configure the active user for all requests.
 * Usage: Import fetchJson() to make API requests and handle errors.
 */

// Unified API client for fetching JSON with error handling
export class ApiRequestError extends Error {
  constructor(message, details = "") {
    super(message);
    this.name = "ApiRequestError";
    this.details = String(details || "").trim();
  }
}

let _currentUserKey = '';

export function setCurrentUserKey(key) {
  _currentUserKey = String(key || '').trim();
}

export function getCurrentUserKey() {
  return _currentUserKey;
}

function appendUserKey(url) {
  let finalUrl = url;
  if (_currentUserKey) {
    const separator = url.includes('?') ? '&' : '?';
    finalUrl = url + separator + 'userKey=' + encodeURIComponent(_currentUserKey);
  }

  return finalUrl;
}

async function parseJsonResponse(response) {
  const raw = await response.text();

  let payload;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch (error) {
    throw new Error('nonJsonApiError');
  }

  if (!response.ok) {
    const baseMessage = payload.error || 'unknownApiError';
    const details = typeof payload.details === "string" ? payload.details.trim() : "";
    throw new ApiRequestError(baseMessage, details);
  }

  return payload;
}

export async function fetchJson(url) {
  const finalUrl = appendUserKey(url);

  const response = await fetch(finalUrl, {
    headers: {
      'Accept': 'application/json'
    }
  });
  return parseJsonResponse(response);
}

export async function postJson(url, body) {
  const finalUrl = appendUserKey(url);
  const response = await fetch(finalUrl, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body || {})
  });

  return parseJsonResponse(response);
}
