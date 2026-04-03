export function openConfirmDialog(dialog, confirmButton, cancelButton) {
  return new Promise((resolve) => {
    let finished = false;
    let confirmed = false;

    const finish = (result) => {
      if (finished) {
        return;
      }

      finished = true;
      cleanup();
      resolve(Boolean(result));
    };

    const onConfirm = () => {
      confirmed = true;
      dialog.close();
    };

    const onCancel = () => {
      confirmed = false;
      dialog.close();
    };

    const onClose = () => finish(confirmed);

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
