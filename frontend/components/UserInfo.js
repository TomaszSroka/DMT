import { fetchJson } from '../services/ApiClient.js';

export async function loadUserInfo() {
  try {
    const data = await fetchJson('/api/user-context');
    const userNameField = document.getElementById('userNameField');
    const rolesList = document.getElementById('rolesList');
    if (userNameField) userNameField.textContent = data.user || '';
    if (rolesList) {
      rolesList.innerHTML = '';
      // Map dictionary id to label (DICTIONARY_NAME)
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
        const dictLabel = dictionaryLabelMap[role.dictionary] || role.dictionary;
        li.textContent = `${dictLabel} - ${role.role}`;
        rolesList.appendChild(li);
      });
    }
  } catch (error) {
    const userNameField = document.getElementById('userNameField');
    const rolesList = document.getElementById('rolesList');
    if (userNameField) userNameField.textContent = 'Error';
    if (rolesList) rolesList.innerHTML = `<li>${error.message}</li>`;
  }
}
