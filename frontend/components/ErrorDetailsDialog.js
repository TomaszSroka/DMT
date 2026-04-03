/**
 * ErrorDetailsDialog.js
 *
 * Manages the error details dialog.
 * - Wires close and copy-to-clipboard buttons.
 * - Exposes showErrorDetailsDialog(message, details) to open it programmatically.
 * Usage: Call setupErrorDetailsDialog() after DOM is loaded.
 */

import { uiTexts } from '../config/ui-texts.js';

let _dialog = null;
let _messageEl = null;
let _textEl = null;
let _copyButton = null;

export function setupErrorDetailsDialog() {
  _dialog = document.getElementById('errorDetailsDialog');
  _messageEl = document.getElementById('errorDetailsMessage');
  _textEl = document.getElementById('errorDetailsText');
  _copyButton = document.getElementById('errorDetailsCopyButton');

  const closeButton = document.getElementById('errorDetailsCloseButton');
  if (closeButton && _dialog) {
    closeButton.addEventListener('click', () => _dialog.close());
  }

  if (_dialog) {
    _dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      _dialog.close();
    });
  }

  if (_copyButton) {
    _copyButton.addEventListener('click', () => {
      const textToCopy = buildCopyText();
      navigator.clipboard.writeText(textToCopy).then(() => {
        const original = _copyButton.textContent;
        _copyButton.textContent = uiTexts.copied || '✓ Copied';
        setTimeout(() => {
          _copyButton.textContent = original;
        }, 1800);
      }).catch(() => {
        fallbackCopy(textToCopy);
      });
    });
  }
}

function buildCopyText() {
  const parts = [];
  if (_messageEl && _messageEl.textContent.trim()) {
    parts.push(_messageEl.textContent.trim());
  }
  if (_textEl && _textEl.textContent.trim()) {
    parts.push(_textEl.textContent.trim());
  }
  return parts.join('\n\n');
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (_) { /* ignore */ }
  document.body.removeChild(ta);
}

/**
 * Opens the error dialog.
 * @param {string} message – short user-facing message
 * @param {string} [details] – optional technical details shown in <pre>
 */
export function showErrorDetailsDialog(message, details) {
  if (!_dialog) {
    // fallback if setup wasn't called yet
    // eslint-disable-next-line no-alert
    window.alert(message || uiTexts.errorDetailsTitle);
    return;
  }

  if (_messageEl) _messageEl.textContent = message || '';
  if (_textEl) _textEl.textContent = details || '';

  // hide <pre> when there are no details
  if (_textEl) {
    _textEl.style.display = details ? '' : 'none';
  }

  _dialog.showModal();
}
