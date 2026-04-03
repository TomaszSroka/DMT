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
import { uiTexts } from '../config/ui-texts.js';

const ALLOWED_ROLES = ['DICTIONARY_READER', 'DICTIONARY_UPDATER'];

export function setupLoginScreen(onLoginSuccess) {
  const loginScreen = document.getElementById('loginScreen');
  if (!loginScreen) return;

  const select = document.getElementById('userKeySelect');
  const button = document.getElementById('loginButton');
  const errorEl = document.getElementById('loginError');

  if (!select || !button || !errorEl) return;

  const loginTitle = loginScreen.querySelector('.login-title');
  const loginSubtitle = loginScreen.querySelector('.login-subtitle');
  const loginLabel = loginScreen.querySelector('.login-label');
  if (loginTitle) loginTitle.textContent = uiTexts.loginTitle || 'DMT';
  if (loginSubtitle) loginSubtitle.textContent = uiTexts.loginSubtitle || 'Dictionary Management Tool';
  if (loginLabel) loginLabel.textContent = uiTexts.loginLabel || 'Login:';
  if (button) button.textContent = uiTexts.loginButton || 'Login';

  button.addEventListener('click', async () => {
    const userKey = String(select.value || '').trim();
    errorEl.textContent = '';
    button.disabled = true;

    try {
      setCurrentUserKey(userKey);
      const data = await fetchJson('/api/user-context');

      const flatRoles = Array.isArray(data.roles) ? data.roles : [];
      const dictionaryRoles = Array.isArray(data.dictionaryRoles) ? data.dictionaryRoles : [];
      const hasAnyRoleInDb = flatRoles.length > 0 || dictionaryRoles.length > 0;
      const hasAccess =
        flatRoles.some(r => ALLOWED_ROLES.includes(r)) ||
        dictionaryRoles.some(r => ALLOWED_ROLES.includes(r.role));

      if (!hasAccess) {
        setCurrentUserKey('');
        if (!hasAnyRoleInDb) {
          errorEl.textContent = uiTexts.loginErrorNotFound || 'Access Denied.\nLogin is not existing.';
        } else {
          errorEl.textContent = uiTexts.loginErrorNoRole || 'Access denied.\nUser does not have DICTIONARY_READER or DICTIONARY_UPDATER role.';
        }
        button.disabled = false;
        return;
      }

      onLoginSuccess(userKey);
    } catch (err) {
      setCurrentUserKey('');
      errorEl.textContent = uiTexts.loginErrorGeneral || 'Could not validate login. Please try again.';
      button.disabled = false;
    }
  });
}
