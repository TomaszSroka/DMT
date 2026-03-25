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
  if (!dictionaryVersionSelect) return [];
  dictionaryVersionSelect.innerHTML = '';
  // Add empty start option
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = '--- Select Version ---';
  dictionaryVersionSelect.appendChild(emptyOption);
  if (!dictionaryId) {
    dictionaryVersionSelect.disabled = true;
    return [];
  }
  try {
    const data = await fetchJson(`/api/dictionaries/${encodeURIComponent(dictionaryId)}/versions`);
    const versions = Array.isArray(data.versions) ? data.versions : [];

    versions.forEach((version) => {
      const option = document.createElement('option');
      option.value = version.id;
      option.textContent = version.label;
      dictionaryVersionSelect.appendChild(option);
    });

    dictionaryVersionSelect.disabled = false;
    return versions;
  } catch (error) {
    dictionaryVersionSelect.innerHTML = `<option>Error: ${error.message}</option>`;
    dictionaryVersionSelect.disabled = true;
    return [];
  }
}
