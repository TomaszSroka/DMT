/**
 * VersionHistoryButton.js
 *
 * Handles the setup and behavior of the 'Version History' button in the UI.
 * - Enables/disables the button based on dictionary/version selection.
 * - Fetches version history details from the backend API.
 * - Displays version details in a dialog using VersionHistoryDialog.js.
 * Usage: Call setupVersionHistoryButton() after DOM is loaded.
 */

import { uiTexts } from '../config/ui-texts.js';

export function setupVersionHistoryButton() {
  const versionSelect = document.getElementById('dictionaryVersionSelect');
  const versionHistoryBtn = document.getElementById('showVersionDetailsButton');
  const dictionarySelect = document.getElementById('dictionarySelect');
  if (!versionSelect || !versionHistoryBtn) return;
  versionHistoryBtn.textContent = uiTexts.showVersionDetails;
  versionHistoryBtn.disabled = true;
  versionSelect.addEventListener('change', () => {
    versionHistoryBtn.disabled = !versionSelect.value;
  });

  versionHistoryBtn.addEventListener('click', async () => {
    if (!versionSelect.value || !dictionarySelect.value) return;
    try {
      // Fetch version details from backend
      const url = `/api/dictionaries/${encodeURIComponent(dictionarySelect.value)}/version-history`;
      const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!response.ok) throw new Error('API error: ' + response.status);
      const data = await response.json();

      const rows = Array.isArray(data.rows) ? data.rows : [];
      if (rows.length === 0) throw new Error('Version details not found');

      // Show dialog with details
      const { showVersionHistoryDialog } = await import('./VersionHistoryDialog.js');

      const columns = Object.keys(rows[0]).map(col => ({
        DICTIONARY_COLUMN_TECHNICAL: col,
        DICTIONARY_COLUMN_BUSINESS: col.replace(/_/g, ' ')
      }));

      showVersionHistoryDialog(rows, columns);
    } catch (err) {
      alert('Failed to load version details: ' + err.message);
    }
  });
}
