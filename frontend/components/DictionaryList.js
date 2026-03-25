/**
 * DictionaryList.js
 *
 * Renders the dropdown list of available dictionaries.
 * - Populates select options from API.
 * - Handles selection and visibility of dictionary options.
 * Usage: Call renderDictionaryList() after DOM is loaded.
 */

import { fetchJson } from '../services/ApiClient.js';

export async function renderDictionaryList() {
  try {
    const data = await fetchJson('/api/user-context');
    const dictionarySelect = document.getElementById('dictionarySelect');
    if (!dictionarySelect) return [];
    dictionarySelect.innerHTML = '';
    // Add empty start option
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '--- Select Dictionary ---';
    dictionarySelect.appendChild(emptyOption);
    // Add dictionary options, hidden by default
    (data.dictionaries || []).forEach(dict => {
      const option = document.createElement('option');
      option.value = dict.id;
      option.textContent = dict.label;
      option.style.display = 'none';
      dictionarySelect.appendChild(option);
    });
    // Show options after click
    dictionarySelect.addEventListener('focus', () => {
      Array.from(dictionarySelect.options).forEach((opt, idx) => {
        if (idx > 0) opt.style.display = '';
      });
    });
    dictionarySelect.addEventListener('blur', () => {
      Array.from(dictionarySelect.options).forEach((opt, idx) => {
        if (idx > 0) opt.style.display = 'none';
      });
    });
    // Hide empty option after selection
    dictionarySelect.addEventListener('change', () => {
      if (dictionarySelect.value) {
        emptyOption.style.display = 'none';
      } else {
        emptyOption.style.display = '';
      }
    });
    return Array.isArray(data.dictionaries) ? data.dictionaries : [];
  } catch (error) {
    const dictionarySelect = document.getElementById('dictionarySelect');
    if (dictionarySelect) {
      dictionarySelect.innerHTML = `<option>Error: ${error.message}</option>`;
    }
    return [];
  }
}
