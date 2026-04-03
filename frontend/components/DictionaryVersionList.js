/**
 * DictionaryVersionList.js
 *
 * Renders the dropdown list of dictionary versions for a selected dictionary.
 * - Populates select options from API.
 * - Handles selection events and enables/disables the dropdown.
 * Usage: Call renderDictionaryVersionList(dictionaryId) after DOM is loaded.
 */

import { fetchJson } from '../services/ApiClient.js';
import { uiTexts } from '../config/ui-texts.js';
import { beginDbLoading } from '../utils/db-loading.js';

export async function renderDictionaryVersionList(dictionaryId) {
  const dictionaryVersionSelect = document.getElementById('dictionaryVersionSelect');
  if (!dictionaryVersionSelect) return [];
  const dictionaryVersionWrap = dictionaryVersionSelect.closest('.dictionary-select-wrap');
  dictionaryVersionSelect.innerHTML = '';
  // Add empty start option
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = `--- ${uiTexts.selectDictionaryVersionOption || 'Select version'} ---`;
  dictionaryVersionSelect.appendChild(emptyOption);
  if (!dictionaryId) {
    dictionaryVersionSelect.disabled = true;
    return [];
  }

  dictionaryVersionSelect.disabled = true;
  dictionaryVersionSelect.innerHTML = '';
  dictionaryVersionSelect.appendChild(emptyOption);
  const endDbLoading = beginDbLoading([dictionaryVersionSelect, dictionaryVersionWrap]);

  try {
    const data = await fetchJson(`/api/dictionaries/${encodeURIComponent(dictionaryId)}/versions`);
    const versions = Array.isArray(data.versions) ? data.versions : [];

    dictionaryVersionSelect.innerHTML = '';
    dictionaryVersionSelect.appendChild(emptyOption);

    versions.forEach((version) => {
      const option = document.createElement('option');
      option.value = version.id;
      option.textContent = version.label;
      option.dataset.location = version.location || '';
      option.dataset.isCheckedOut = version.isCheckedOut ? '1' : '0';
      dictionaryVersionSelect.appendChild(option);
    });

    dictionaryVersionSelect.disabled = false;
    return versions;
  } catch (error) {
    dictionaryVersionSelect.innerHTML = `<option>${uiTexts.loadError || 'Error'}: ${error.message}</option>`;
    dictionaryVersionSelect.disabled = true;
    return [];
  } finally {
    endDbLoading();
  }
}
