/**
 * ApiClient.js
 *
 * Provides unified API client functions for the frontend.
 * - Defines ApiRequestError for standardized error handling.
 * - Exposes fetchJson() for fetching JSON from backend APIs with error handling.
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

export async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json'
    }
  });
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
