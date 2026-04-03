/**
 * runtime-config.js
 *
 * Provides a single source of truth for frontend runtime configuration.
 */

export function getRuntimeConfig() {
  return window.FRONTEND_RUNTIME_CONFIG || window.FRONTEND_CONFIG || {};
}
