export function setEditorActionButtonsEnabled({
  tableController,
  saveButton,
  publishButton,
  discardButton
}, enabled) {
  const isEnabled = Boolean(enabled);
  if (tableController && typeof tableController.setInlineCreateRowEnabled === 'function') {
    tableController.setInlineCreateRowEnabled(isEnabled);
  }

  if (saveButton) {
    saveButton.disabled = !isEnabled;
  }
  if (publishButton) {
    publishButton.disabled = !isEnabled;
  }
  if (discardButton) {
    discardButton.disabled = !isEnabled;
  }
}

export function switchToReadOnlyMode({
  tableController,
  setIsUpdaterEditMode,
  setCurrentVersionLabelOverride,
  setEditorActionButtonsEnabled,
  showLabel
}) {
  setIsUpdaterEditMode(false);
  setCurrentVersionLabelOverride('');
  tableController.setCheckoutDictionaryLocation('');
  tableController.setRowActionLabel(showLabel);
  setEditorActionButtonsEnabled(false);
}

export function updateEditButtonDisabledState({
  editButton,
  tableController,
  isUpdaterEditMode
}) {
  if (!editButton) {
    return;
  }

  if (isUpdaterEditMode) {
    editButton.disabled = true;
    return;
  }

  const currentState = tableController.getState();
  editButton.disabled = !currentState.hasLoadedTableData || !currentState.activeDictionary || !currentState.selectedDictionaryVersionKey;
}