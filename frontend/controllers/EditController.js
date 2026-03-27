/**
 * EditController.js
 *
 * Manages the Edit button workflow and Save/Publish/Discard actions.
 * - Handles checkout logic for UPDATER role.
 * - Shows permission info for READER role.
 * - Manages edit mode state and action button availability.
 */

import { uiTexts } from '../config/ui-texts.js';
import { fetchUserManagers } from '../services/UserManagers.js';
import { ensureDictionaryCheckOut } from '../services/CheckOutService.js';
import { getCurrentUserKey } from '../services/ApiClient.js';
import { beginDbLoading } from '../utils/db-loading.js';

export function createEditController({
  editButton,
  saveButton,
  publishButton,
  discardButton,
  notImplementedDialog,
  notImplementedCloseButton,
  notImplementedMessage,
  notImplementedManagersList,
  checkOutConfirmDialog,
  checkOutConfirmMessage,
  checkOutConfirmButton,
  checkOutCancelButton,
  tableController,
  dictionarySelect,
  dictionaryVersionSelect,
  renderDictionaryVersionList,
  showErrorDetailsDialog
} = {}) {
  let userManagersCache = null;
  let isUpdaterEditMode = false;
  let dictionaryAccessById = new Map();
  let currentVersionLabelOverride = '';

  function setEditorActionButtonsEnabled(enabled) {
    const isEnabled = Boolean(enabled);
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

  function setInfoDialogMessage(message, users = []) {
    if (notImplementedMessage) {
      notImplementedMessage.innerHTML = message;
    }

    if (notImplementedManagersList) {
      notImplementedManagersList.innerHTML = '';
      users.forEach((user) => {
        const userName = user && user.userName ? String(user.userName).trim() : '';
        if (!userName) {
          return;
        }

        const email = user && user.email ? String(user.email).trim() : '';
        const item = document.createElement('li');
        item.textContent = email ? `${userName} - ${email}` : userName;
        notImplementedManagersList.appendChild(item);
      });
    }
  }

  function showInfoDialogWithUsers(message, users = []) {
    setInfoDialogMessage(message, users);
    if (notImplementedDialog) {
      notImplementedDialog.showModal();
    }
  }

  function currentUserHasRole(roleName) {
    const expectedRole = String(roleName || '').trim().toUpperCase();
    const userContext = window.__DMT_USER_CONTEXT || {};
    const flatRoles = Array.isArray(userContext.roles) ? userContext.roles : [];
    return flatRoles.some((role) => String(role || '').trim().toUpperCase() === expectedRole);
  }

  async function showReaderNoPermissionDialog() {
    if (currentUserHasRole('USER_MANAGER')) {
      const intro = [
        "The DICTIONARY_READER role doesn't have permissions to edit the Dictionary.",
        "",
        "You have USER_MANAGER role, so you can change Your permissions."
      ].join('<br>');
      showInfoDialogWithUsers(intro, []);
      return;
    }

    if (!Array.isArray(userManagersCache)) {
      try {
        userManagersCache = await fetchUserManagers();
      } catch (error) {
        userManagersCache = [];
      }
    }

    const intro = [
      "The DICTIONARY_READER role doesn't have permissions to edit the Dictionary.",
      "",
      "Please contact someone with the USER_MANAGER role to change Your permissions:"
    ].join('<br>');
    const users = Array.isArray(userManagersCache) ? userManagersCache : [];

    if (users.length > 0) {
      showInfoDialogWithUsers(intro, users);
      return;
    }

    showInfoDialogWithUsers(`${intro}<br>- No USER_MANAGER users found.`, []);
  }

  function setupDialogs() {
    if (notImplementedDialog && notImplementedCloseButton) {
      notImplementedCloseButton.addEventListener('click', () => notImplementedDialog.close());
    }

    [saveButton, publishButton, discardButton].forEach((button) => {
      if (!button) {
        return;
      }

      button.addEventListener('click', () => {
        showInfoDialogWithUsers('This feature is not implemented yet.');
      });
    });

    setEditorActionButtonsEnabled(false);
  }

  function requestCheckOutConfirmation() {
    const message = uiTexts.checkOutConfirmMessage
      || 'Confirming the edit will generate a new table with a copy of the Dictionary only for you and the Dictionary will be locked for editing by other Users.';

    if (!checkOutConfirmDialog || !checkOutConfirmButton || !checkOutCancelButton) {
      return Promise.resolve(window.confirm(message));
    }

    if (checkOutConfirmMessage) {
      checkOutConfirmMessage.textContent = message;
    }

    return new Promise((resolve) => {
      let finished = false;
      let dialogResult = false;

      const finish = (result) => {
        if (finished) {
          return;
        }

        finished = true;
        cleanup();
        resolve(Boolean(result));
      };

      const onConfirm = () => {
        dialogResult = true;
        checkOutConfirmDialog.close();
      };

      const onCancel = () => {
        dialogResult = false;
        checkOutConfirmDialog.close();
      };

      const onClose = () => finish(dialogResult);

      const cleanup = () => {
        checkOutConfirmButton.removeEventListener('click', onConfirm);
        checkOutCancelButton.removeEventListener('click', onCancel);
        checkOutConfirmDialog.removeEventListener('close', onClose);
      };

      checkOutConfirmButton.addEventListener('click', onConfirm);
      checkOutCancelButton.addEventListener('click', onCancel);
      checkOutConfirmDialog.addEventListener('close', onClose);
      checkOutConfirmDialog.showModal();
    });
  }

  async function activateUpdaterEditMode(checkOutPayload) {
    if (!checkOutPayload || !checkOutPayload.checkOutDictionaryLocation) {
      throw new Error('Check-out dictionary location was not returned.');
    }

    currentVersionLabelOverride = String(checkOutPayload.versionName || '').trim();
    await tableController.setCheckoutDictionaryLocation(checkOutPayload.checkOutDictionaryLocation);
    tableController.setRowActionLabel(uiTexts.editDictionary || 'Edit');
    isUpdaterEditMode = true;
    setEditorActionButtonsEnabled(true);
  }

  function showCheckOutExistsInfo(checkOutPayload) {
    const currentUserLogin = String(getCurrentUserKey() || '').trim().toUpperCase();
    const ownerLogin = String(checkOutPayload && checkOutPayload.userLogin ? checkOutPayload.userLogin : '').trim();
    const ownerLoginUpper = ownerLogin.toUpperCase();
    const versionName = String(checkOutPayload && checkOutPayload.versionName ? checkOutPayload.versionName : '').trim();

    if (ownerLogin && ownerLoginUpper !== currentUserLogin) {
      const messageTemplate = uiTexts.checkOutExistsOtherUserMessage
        || 'Dictionary is currently in edit mode (check out) by user: {userLogin}.';
      showInfoDialogWithUsers(messageTemplate.replace('{userLogin}', ownerLogin));
      return;
    }

    const messageTemplate = uiTexts.checkOutExistsCurrentUserMessage
      || "You've already edited the Dictionary. You can access it by selecting the version: {versionName} from the list.";
    const resolvedVersion = versionName || '-';
    showInfoDialogWithUsers(messageTemplate.replace('{versionName}', resolvedVersion));
  }

  function setupDictionarySelects() {
    if (dictionarySelect) {
      dictionarySelect.addEventListener('change', async () => {
        const selectedDictionary = String(dictionarySelect.value || '').trim();
        tableController.setDictionary(selectedDictionary);
        isUpdaterEditMode = false;
        currentVersionLabelOverride = '';
        setEditorActionButtonsEnabled(false);
        tableController.setCheckoutDictionaryLocation('');
        tableController.setRowActionLabel(uiTexts.showRowButton || 'Show');
        if (typeof renderDictionaryVersionList === 'function') {
          await renderDictionaryVersionList(selectedDictionary);
        }
      });
    }

    if (dictionaryVersionSelect) {
      dictionaryVersionSelect.addEventListener('change', () => {
        isUpdaterEditMode = false;
        currentVersionLabelOverride = '';
        tableController.setCheckoutDictionaryLocation('');
        tableController.setRowActionLabel(uiTexts.showRowButton || 'Show');
        setEditorActionButtonsEnabled(false);
        tableController.setDictionaryVersion(dictionaryVersionSelect.value);
      });
    }
  }

  function setupEditButton() {
    if (!editButton) {
      return;
    }

    editButton.addEventListener('click', async () => {
      const selectedDictionary = dictionarySelect ? String(dictionarySelect.value || '').trim() : '';
      const selectedVersion = dictionaryVersionSelect ? String(dictionaryVersionSelect.value || '').trim() : '';
      if (!selectedDictionary || !selectedVersion) {
        return;
      }

      const dictionaryAccess = dictionaryAccessById.get(selectedDictionary);
      const canUpdate = dictionaryAccess ? Boolean(dictionaryAccess.canUpdate) : false;
      const roles = dictionaryAccess && Array.isArray(dictionaryAccess.roles) ? dictionaryAccess.roles : [];
      const isDictionaryReader = roles.includes('DICTIONARY_READER');

      if (!canUpdate) {
        isUpdaterEditMode = false;
        tableController.setCheckoutDictionaryLocation('');
        tableController.setRowActionLabel(uiTexts.showRowButton || 'Show');
        setEditorActionButtonsEnabled(false);
        if (isDictionaryReader) {
          showReaderNoPermissionDialog();
        } else {
          showInfoDialogWithUsers('This feature is not implemented yet.');
        }
        return;
      }

      if (isUpdaterEditMode) {
        return;
      }

      const globalLoadingInfo = document.getElementById('globalLoadingInfo');
      const previousLoadingInfoText = globalLoadingInfo ? String(globalLoadingInfo.textContent || '') : '';
      const endDbLoading = beginDbLoading(globalLoadingInfo);
      if (globalLoadingInfo) {
        globalLoadingInfo.textContent = uiTexts.loadingData || 'Loading data...';
      }

      editButton.disabled = true;
      try {
        const checkResult = await ensureDictionaryCheckOut(selectedDictionary, selectedVersion, 'CHECK');
        const procedureResult = String(checkResult && checkResult.procedureResult ? checkResult.procedureResult : '').toUpperCase();

        if (procedureResult === 'RECORD_EXISTS') {
          isUpdaterEditMode = false;
          currentVersionLabelOverride = '';
          tableController.setCheckoutDictionaryLocation('');
          tableController.setRowActionLabel(uiTexts.showRowButton || 'Show');
          setEditorActionButtonsEnabled(false);
          showCheckOutExistsInfo(checkResult);
          return;
        }

        if (procedureResult !== 'RECORD_NOT_EXISTS') {
          throw new Error(`Unexpected check-out CHECK result: ${procedureResult || 'EMPTY_RESULT'}`);
        }

        const confirmed = await requestCheckOutConfirmation();
        if (!confirmed) {
          isUpdaterEditMode = false;
          currentVersionLabelOverride = '';
          tableController.setCheckoutDictionaryLocation('');
          tableController.setRowActionLabel(uiTexts.showRowButton || 'Show');
          setEditorActionButtonsEnabled(false);
          return;
        }

        const addResult = await ensureDictionaryCheckOut(selectedDictionary, selectedVersion, 'ADD');
        await activateUpdaterEditMode(addResult);
      } catch (error) {
        isUpdaterEditMode = false;
        currentVersionLabelOverride = '';
        tableController.setCheckoutDictionaryLocation('');
        tableController.setRowActionLabel(uiTexts.showRowButton || 'Show');
        setEditorActionButtonsEnabled(false);

        const dbMessage = error && error.details ? String(error.details) : (error && error.message ? String(error.message) : String(error));
        showInfoDialogWithUsers(dbMessage);
      } finally {
        endDbLoading();

        if (!isUpdaterEditMode && globalLoadingInfo) {
          globalLoadingInfo.textContent = previousLoadingInfoText;
        }

        if (isUpdaterEditMode) {
          editButton.disabled = true;
        } else {
          const currentState = tableController.getState();
          editButton.disabled = !currentState.hasLoadedTableData || !currentState.activeDictionary || !currentState.selectedDictionaryVersionKey;
        }
      }
    });
  }

  function setDictionaryAccess(dictionaries) {
    dictionaryAccessById.clear();
    (Array.isArray(dictionaries) ? dictionaries : []).forEach((dict) => {
      if (!dict || typeof dict.id !== 'string') {
        return;
      }

      dictionaryAccessById.set(dict.id, {
        canUpdate: Boolean(dict.canUpdate),
        roles: Array.isArray(dict.roles) ? dict.roles : []
      });
    });
  }

  function initialize() {
    setupDialogs();
    setupDictionarySelects();
    setupEditButton();
  }

  return {
    initialize,
    setDictionaryAccess,
    getIsUpdaterEditMode: () => isUpdaterEditMode,
    getCurrentVersionLabelOverride: () => currentVersionLabelOverride
  };
}
