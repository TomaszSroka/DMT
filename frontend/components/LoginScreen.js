/**
 * LoginScreen.js
 *
 * Manages the login screen shown before the main application.
 * - Renders a user selector and a login button.
 * - On submit, fetches the user context and checks for required roles.
 * - Calls onLoginSuccess(userKey) if the user has access.
 * Usage: Call setupLoginScreen(onLoginSuccess) after DOM is loaded.
 */

import { fetchJson, setCurrentUserKey } from '../services/ApiClient.js';

const ALLOWED_ROLES = ['DICTIONARY_READER', 'DICTIONARY_UPDATER'];

export function setupLoginScreen(onLoginSuccess) {
  const loginScreen = document.getElementById('loginScreen');
  if (!loginScreen) return;

  const select = document.getElementById('userKeySelect');
  const button = document.getElementById('loginButton');
  const errorEl = document.getElementById('loginError');

  if (!select || !button || !errorEl) return;

  button.addEventListener('click', async () => {
    const userKey = select.value;
    errorEl.textContent = '';
    button.disabled = true;

    try {
      setCurrentUserKey(userKey);
      const data = await fetchJson('/api/user-context');

      const flatRoles = Array.isArray(data.roles) ? data.roles : [];
      const dictionaryRoles = Array.isArray(data.dictionaryRoles) ? data.dictionaryRoles : [];
      const hasAccess =
        flatRoles.some(r => ALLOWED_ROLES.includes(r)) ||
        dictionaryRoles.some(r => ALLOWED_ROLES.includes(r.role));

      if (!hasAccess) {
        setCurrentUserKey('');
        errorEl.textContent = 'Brak uprawnień.\nUżytkownik nie posiada roli DICTIONARY_READER ani DICTIONARY_UPDATER.';
        button.disabled = false;
        return;
      }

      onLoginSuccess(userKey);
    } catch (err) {
      setCurrentUserKey('');
      errorEl.textContent = 'Błąd podczas sprawdzania uprawnień: ' + (err.message || 'Nieznany błąd');
      button.disabled = false;
    }
  });
}
