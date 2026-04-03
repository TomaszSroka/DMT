/**
 * DictionaryList.js
 *
 * Renders the dropdown list of available dictionaries.
 * - Populates select options from API.
 * - Handles selection and visibility of dictionary options.
 * Usage: Call renderDictionaryList() after DOM is loaded.
 */

import { fetchJson } from '../services/ApiClient.js';
import { uiTexts } from '../config/ui-texts.js';
import { beginDbLoading } from '../utils/db-loading.js';

export async function renderDictionaryList() {
  const dictionarySelect = document.getElementById('dictionarySelect');
  const dictionarySelectWrap = dictionarySelect ? dictionarySelect.closest('.dictionary-select-wrap') : null;
  if (dictionarySelect) {
    dictionarySelect.disabled = true;
    dictionarySelect.innerHTML = '';
    const loadingOption = document.createElement('option');
    loadingOption.value = '';
    loadingOption.textContent = `--- ${uiTexts.selectDictionaryOption || 'Select dictionary'} ---`;
    dictionarySelect.appendChild(loadingOption);
  }
  const endDbLoading = beginDbLoading([dictionarySelect, dictionarySelectWrap]);

  try {
    const data = await fetchJson('/api/user-context');
    if (!dictionarySelect) return [];
    dictionarySelect.innerHTML = '';
    dictionarySelect.disabled = false;
    // Add empty start option
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = `--- ${uiTexts.selectDictionaryOption || 'Select dictionary'} ---`;
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
    if (dictionarySelect) {
      dictionarySelect.innerHTML = '';
      const errorOption = document.createElement('option');
      const message = error && error.message ? String(error.message) : String(error);
      errorOption.textContent = `${uiTexts.loadError || 'Error'}: ${message}`;
      dictionarySelect.appendChild(errorOption);
      dictionarySelect.disabled = true;
    }
    return [];
  } finally {
    endDbLoading();
  }
}
