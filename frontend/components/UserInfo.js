/**
 * UserInfo.js
 *
 * Loads and displays user information and dictionary-role pairs in the account panel.
 * - Fetches user context from API.
 * - Handles error display for user info and roles.
 * Usage: Call loadUserInfo() after DOM is loaded.
 */

import { fetchJson } from '../services/ApiClient.js';

const ROLES_SCROLL_THRESHOLD = (() => {
  const cfg = window.FRONTEND_CONFIG;
  return (cfg && cfg.defaults && cfg.defaults.userDetailsDropdownThreshold) || 10;
})();

export async function loadUserInfo() {
  try {
    const data = await fetchJson('/api/user-context');
    const userNameField = document.getElementById('userNameField');
    const rolesList = document.getElementById('rolesList');
    if (userNameField) userNameField.textContent = data.user || '';
    if (rolesList) {
      rolesList.innerHTML = '';
      const dictionaryLabelMap = {};
      if (Array.isArray(data.dictionaries)) {
        data.dictionaries.forEach(dict => {
          if (dict && typeof dict.id === 'string' && typeof dict.label === 'string') {
            dictionaryLabelMap[dict.id] = dict.label;
          }
        });
      }
      (data.dictionaryRoles || []).forEach(role => {
        const li = document.createElement('li');
        const dictLabel = role.dictionaryLabel || dictionaryLabelMap[role.dictionary] || role.dictionary;
        li.textContent = `${dictLabel} - ${role.role}`;
        rolesList.appendChild(li);
      });

      if (rolesList.children.length > ROLES_SCROLL_THRESHOLD) {
        rolesList.classList.add('roles-list-scrollable');
      } else {
        rolesList.classList.remove('roles-list-scrollable');
      }
    }
  } catch (error) {
    const userNameField = document.getElementById('userNameField');
    const rolesList = document.getElementById('rolesList');
    if (userNameField) userNameField.textContent = 'Error';
    if (rolesList) rolesList.innerHTML = `<li>${error.message}</li>`;
  }
}
