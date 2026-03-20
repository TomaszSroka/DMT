/**
 * DictionaryVersionList.js
 *
 * Renders the dropdown list of dictionary versions for a selected dictionary.
 * - Populates select options from API.
 * - Handles selection events and enables/disables the dropdown.
 * Usage: Call renderDictionaryVersionList(dictionaryId) after DOM is loaded.
 */

import { fetchJson } from '../services/ApiClient.js';

export async function renderDictionaryVersionList(dictionaryId) {
  const dictionaryVersionSelect = document.getElementById('dictionaryVersionSelect');
  if (!dictionaryVersionSelect) return;
  dictionaryVersionSelect.innerHTML = '';
  // Add empty start option
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = '--- Select Version ---';
  dictionaryVersionSelect.appendChild(emptyOption);
  if (!dictionaryId) {
    dictionaryVersionSelect.disabled = true;
    return;
  }
  try {
    const data = await fetchJson(`/api/dictionaries/${encodeURIComponent(dictionaryId)}/version-history`);
    (data.rows || []).forEach(row => {
      const option = document.createElement('option');
      option.value = row.DICTIONARY_VERSION_CODE;
      option.textContent = row.DICTIONARY_VERSION_NAME;
      dictionaryVersionSelect.appendChild(option);
    });
    dictionaryVersionSelect.disabled = false;
    // Hide empty option after selection
    dictionaryVersionSelect.addEventListener('change', () => {
      if (dictionaryVersionSelect.value) {
        emptyOption.style.display = 'none';
      } else {
        emptyOption.style.display = '';
      }
    });
  } catch (error) {
    dictionaryVersionSelect.innerHTML = `<option>Error: ${error.message}</option>`;
    dictionaryVersionSelect.disabled = true;
  }
}
