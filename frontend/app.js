// Import UI texts
import { uiTexts } from './config/ui-texts.js';
import { setupAccountPanel } from './components/AccountPanel.js';
import { loadUserInfo } from './components/UserInfo.js';
import { renderDictionaryList } from './components/DictionaryList.js';
import { renderDictionaryVersionList } from './components/DictionaryVersionList.js';
import { logUserContext } from './services/DebugApi.js';

document.addEventListener("DOMContentLoaded", () => {
  // Set page title
  document.title = uiTexts.appTitle;
  const appTitle = document.getElementById("appTitle");
  if (appTitle) appTitle.textContent = uiTexts.appTitle;

  // Assign texts to UI elements
  const assignText = [
    ["accountToggle", "accountButton"],
    ["userNameLabel", "userLabel"],
    ["rolesLabel", "rolesLabel"],
    ["dictionaryLabel", "dictionaryLabel"],
    ["dictionaryVersionLabel", "dictionaryVersionLabel"],
    ["showVersionDetailsButton", "showVersionDetails"],
    ["editButton", "editDictionary"],
    ["saveButton", "save"],
    ["publishButton", "publish"],
    ["discardButton", "discard"],
    ["openFiltersButton", "filtersOpen"],
    ["prevPageButton", "previous"],
    ["nextPageButton", "next"],
    ["discardDialogTitle", "discardDialogTitle"],
    ["discardDialogIntro", "discardDialogIntro"],
    ["discardStayButton", "discardDialogKeepEditing"],
    ["discardConfirmButton", "discardDialogConfirm"],
    ["saveDialogTitle", "saveDialogTitle"],
    ["saveDialogIntro", "saveDialogIntro"],
    ["saveStayButton", "saveDialogBack"],
    ["saveConfirmButton", "saveDialogConfirm"],
    ["discardAllDialogTitle", "discardAllDialogTitle"],
    ["discardAllDialogIntro", "discardAllDialogIntro"],
    ["discardAllStayButton", "discardAllDialogBack"],
    ["discardAllConfirmButton", "discardAllDialogConfirm"],
    ["versionDetailsTitle", "versionDetailsTitle"],
    ["versionDetailsCloseButton", "versionDetailsClose"],
    ["errorDetailsTitle", "errorDetailsTitle"],
    ["errorDetailsCopyButton", "errorDetailsCopy"],
    ["errorDetailsCloseButton", "errorDetailsClose"],
    ["filtersDialogTitle", "filtersDialogTitle"],
    ["filtersDialogIntro", "filtersDialogIntro"],
    ["filtersAddRuleButton", "filtersAddRule"],
    ["filtersApplyButton", "filtersApply"],
    ["filtersApplyCloseButton", "filtersApplyClose"],
    ["filtersClearButton", "filtersClear"],
    ["filtersCloseButton", "filtersClose"]
  ];

  assignText.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el && (key === "dictionaryLabel" || key === "dictionaryVersionLabel")) {
      el.textContent = uiTexts[key].replace(/:.*/, "") + ":";
    } else if (el && uiTexts[key]) {
      el.textContent = uiTexts[key];
    }
  });

  // Setup Account panel logic
  setupAccountPanel();

  // Load user info from API
  loadUserInfo();

  // Render dictionary list
  renderDictionaryList();

  // Render dictionary version list on dictionary change
  const dictionarySelect = document.getElementById('dictionarySelect');
  if (dictionarySelect) {
    dictionarySelect.addEventListener('change', () => {
      renderDictionaryVersionList(dictionarySelect.value);
    });
  }

  // Debug: log API response
  logUserContext();
});
