export function applyStaticUiTexts(uiTexts) {
  const assignText = [
    ['accountToggle', 'accountButton'],
    ['signOutButton', 'signOutButton'],
    ['userNameLabel', 'userLabel'],
    ['rolesLabel', 'rolesLabel'],
    ['dictionaryLabel', 'dictionaryLabel'],
    ['versionLabel', 'dictionaryVersionLabel'],
    ['showVersionDetailsButton', 'showVersionDetails'],
    ['editButton', 'editDictionary'],
    ['saveButton', 'save'],
    ['publishButton', 'publish'],
    ['discardButton', 'discard'],
    ['openFiltersButton', 'filtersOpen'],
    ['prevPageButton', 'previous'],
    ['nextPageButton', 'next'],
    ['discardDialogTitle', 'discardDialogTitle'],
    ['discardDialogIntro', 'discardDialogIntro'],
    ['discardStayButton', 'discardDialogKeepEditing'],
    ['discardConfirmButton', 'discardDialogConfirm'],
    ['saveDialogTitle', 'saveDialogTitle'],
    ['saveDialogIntro', 'saveDialogIntro'],
    ['saveStayButton', 'saveDialogBack'],
    ['saveConfirmButton', 'saveDialogConfirm'],
    ['discardAllDialogTitle', 'discardAllDialogTitle'],
    ['discardAllDialogIntro', 'discardAllDialogIntro'],
    ['discardAllStayButton', 'discardAllDialogBack'],
    ['discardAllConfirmButton', 'discardAllDialogConfirm'],
    ['versionDetailsTitle', 'versionDetailsTitle'],
    ['versionDetailsCloseButton', 'versionDetailsClose'],
    ['errorDetailsTitle', 'errorDetailsTitle'],
    ['errorDetailsCopyButton', 'errorDetailsCopy'],
    ['errorDetailsCloseButton', 'errorDetailsClose'],
    ['checkOutConfirmTitle', 'checkOutConfirmTitle'],
    ['checkOutConfirmConfirmButton', 'checkOutConfirmButton'],
    ['checkOutConfirmCancelButton', 'checkOutCancelButton'],
    ['filtersDialogTitle', 'filtersDialogTitle'],
    ['filtersDialogIntro', 'filtersDialogIntro'],
    ['filtersAddRuleButton', 'filtersAddRule'],
    ['filtersApplyButton', 'filtersApply'],
    ['filtersApplyCloseButton', 'filtersApplyClose'],
    ['filtersClearButton', 'filtersClear'],
    ['filtersCloseButton', 'filtersClose'],
    ['recordDetailsCloseButton', 'closeButton'],
    ['showRecordCloseButton', 'closeButton'],
    ['editRecordCloseButton', 'closeButton'],
    ['notImplementedCloseButton', 'closeButton'],
    ['notImplementedTitle', 'notImplementedTitle']
  ];

  assignText.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (id === 'rolesLabel' && el) {
      el.textContent = uiTexts[key] || 'Dictionary Name - Role Name:';
    } else if (el && (key === 'dictionaryLabel' || key === 'dictionaryVersionLabel')) {
      el.textContent = uiTexts[key].replace(/:.*/, '') + ':';
    } else if (el && uiTexts[key]) {
      el.textContent = uiTexts[key];
    }
  });
}
