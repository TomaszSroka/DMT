export function setInfoDialogContent({ messageElement, managersListElement, message, users = [] }) {
  if (messageElement) {
    messageElement.innerHTML = message;
  }

  if (!managersListElement) {
    return;
  }

  managersListElement.innerHTML = '';
  users.forEach((user) => {
    const userName = user && user.userName ? String(user.userName).trim() : '';
    if (!userName) {
      return;
    }

    const email = user && user.email ? String(user.email).trim() : '';
    const item = document.createElement('li');
    item.textContent = email ? `${userName} - ${email}` : userName;
    managersListElement.appendChild(item);
  });
}

export function openDecisionDialog({ dialog, messageElement, confirmButton, cancelButton, message }) {
  if (!dialog || !confirmButton || !cancelButton) {
    return Promise.resolve(window.confirm(message));
  }

  if (messageElement) {
    messageElement.textContent = message;
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
      dialog.close();
    };

    const onCancel = () => {
      dialogResult = false;
      dialog.close();
    };

    const onClose = () => finish(dialogResult);

    const cleanup = () => {
      confirmButton.removeEventListener('click', onConfirm);
      cancelButton.removeEventListener('click', onCancel);
      dialog.removeEventListener('close', onClose);
    };

    confirmButton.addEventListener('click', onConfirm);
    cancelButton.addEventListener('click', onCancel);
    dialog.addEventListener('close', onClose);
    dialog.showModal();
  });
}
