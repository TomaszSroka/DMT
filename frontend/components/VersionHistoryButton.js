export function setupVersionHistoryButton() {
  const versionSelect = document.getElementById('dictionaryVersionSelect');
  const versionHistoryBtn = document.getElementById('showVersionDetailsButton');
  const dictionarySelect = document.getElementById('dictionarySelect');
  if (!versionSelect || !versionHistoryBtn) return;
  // Change button text to 'Version History'
  versionHistoryBtn.textContent = 'Version History';
  versionHistoryBtn.disabled = true;
  versionSelect.addEventListener('change', () => {
    versionHistoryBtn.disabled = !versionSelect.value;
  });

  versionHistoryBtn.addEventListener('click', async () => {
    if (!versionSelect.value || !dictionarySelect.value) return;
    try {
      // Fetch version details from backend
      const url = `/api/dictionaries/${encodeURIComponent(dictionarySelect.value)}/version-history`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      if (!response.ok) throw new Error('API error: ' + response.status);
      const data = await response.json();
      // Show dialog with details
      const { showRecordDetailsDialog } = await import('./RecordDetailsDialog.js');
      // Find version row by selected version code
      const versionRow = (data.rows || []).find(row => String(row.DICTIONARY_VERSION_CODE) === String(versionSelect.value));
      if (!versionRow) throw new Error('Version details not found');
      // Prepare columns
      const columns = Object.keys(versionRow).map(col => ({
        DICTIONARY_COLUMN_TECHNICAL: col,
        DICTIONARY_COLUMN_BUSINESS: col.replace(/_/g, ' ')
      }));
      showRecordDetailsDialog(versionRow, columns);
    } catch (err) {
      alert('Failed to load version details: ' + err.message);
    }
  });
}
