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

export function createEditController({
  editButton,
  saveButton,
  publishButton,
  discardButton,
  notImplementedDialog,
  notImplementedCloseButton,
  notImplementedMessage,
  notImplementedManagersList,
  tableController,
  dictionarySelect,
  dictionaryVersionSelect,
  renderDictionaryVersionList,
  showErrorDetailsDialog
} = {}) {
  let userManagersCache = null;
  let isUpdaterEditMode = false;
  let dictionaryAccessById = new Map();

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

  async function showReaderNoPermissionDialog() {
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

  function setupDictionarySelects() {
    if (dictionarySelect) {
      dictionarySelect.addEventListener('change', async () => {
        const selectedDictionary = String(dictionarySelect.value || '').trim();
        tableController.setDictionary(selectedDictionary);
        isUpdaterEditMode = false;
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

      editButton.disabled = true;
      try {
        const checkOut = await ensureDictionaryCheckOut(selectedDictionary, selectedVersion);
        if (!checkOut.checkOutDictionaryLocation) {
          throw new Error('Check-out dictionary location was not returned.');
        }

        await tableController.setCheckoutDictionaryLocation(checkOut.checkOutDictionaryLocation);
        tableController.setRowActionLabel(uiTexts.editDictionary || 'Edit');
        isUpdaterEditMode = true;
        setEditorActionButtonsEnabled(true);
      } catch (error) {
        isUpdaterEditMode = false;
        tableController.setCheckoutDictionaryLocation('');
        tableController.setRowActionLabel(uiTexts.showRowButton || 'Show');
        setEditorActionButtonsEnabled(false);

        const dbMessage = error && error.details ? String(error.details) : (error && error.message ? String(error.message) : String(error));
        showInfoDialogWithUsers(dbMessage);
      } finally {
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
    getIsUpdaterEditMode: () => isUpdaterEditMode
  };
}
