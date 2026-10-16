/* KnowBear extension — offscreen clipboard reader (local only, no network, no persistence). */
(function () {
  'use strict';
  const KB = globalThis.KB;

  // Offscreen documents never have focus, so navigator.clipboard.readText() throws.
  // execCommand('paste') into a textarea is permitted with reason CLIPBOARD + clipboardRead.
  function readClipboardText() {
    const el = document.createElement('textarea');
    document.body.appendChild(el);
    try {
      el.focus();
      document.execCommand('paste');
      return el.value || '';
    } finally {
      el.remove();
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.target !== 'offscreen' || msg.type !== KB.MSG.CLIPBOARD_READ) return false;
    try {
      sendResponse({ text: readClipboardText() });
    } catch {
      sendResponse({ text: '' });
    }
    return false;
  });
})();
