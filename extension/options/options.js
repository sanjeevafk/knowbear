/* KnowBear extension — options page. */
(function () {
  'use strict';
  const KB = globalThis.KB;
  const $ = (id) => document.getElementById(id);
  const els = {
    level: $('level'), fontSize: $('fontSize'), fontSizeValue: $('fontSizeValue'), showPill: $('showPill'),
    apiBase: $('apiBase'), test: $('test'), apiStatus: $('apiStatus'),
    shortcut: $('shortcut'), rebind: $('rebind'), saved: $('saved'),
  };
  const LOCAL_HOST_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
  let savedTimer = null;

  function setStatus(text, kind) {
    els.apiStatus.textContent = text;
    els.apiStatus.className = `status${kind ? ` ${kind}` : ''}`;
  }

  function flashSaved() {
    els.saved.textContent = 'Saved';
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => (els.saved.textContent = ''), 1500);
  }

  async function save(patch) {
    await KB.saveSettings(patch);
    flashSaved();
  }

  function render(settings) {
    els.level.value = settings.level;
    els.fontSize.value = String(settings.fontSize);
    els.fontSizeValue.textContent = `${settings.fontSize}px`;
    els.showPill.checked = settings.showPill;
    els.apiBase.value = settings.apiBase;
  }

  async function renderShortcut() {
    try {
      const commands = await chrome.commands.getAll();
      const cmd = commands.find((c) => c.name === KB.COMMAND_NAME);
      els.shortcut.textContent = (cmd && cmd.shortcut) || 'Not set';
    } catch {
      els.shortcut.textContent = 'Unavailable';
    }
  }

  els.level.addEventListener('change', () => save({ level: els.level.value }));
  els.fontSize.addEventListener('input', () => {
    els.fontSizeValue.textContent = `${els.fontSize.value}px`;
  });
  els.fontSize.addEventListener('change', () => save({ fontSize: Number(els.fontSize.value) }));
  els.showPill.addEventListener('change', () => save({ showPill: els.showPill.checked }));
  els.apiBase.addEventListener('change', async () => {
    const value = KB.normalizeApiBase(els.apiBase.value);
    els.apiBase.value = value;
    if (!LOCAL_HOST_RE.test(value)) {
      setStatus('Only http://localhost or http://127.0.0.1 is allowed (host permissions are local-only).', 'bad');
      return;
    }
    setStatus('');
    await save({ apiBase: value });
  });

  els.test.addEventListener('click', async () => {
    const base = KB.normalizeApiBase(els.apiBase.value);
    setStatus('Checking…');
    const res = await KB.checkHealth(base);
    if (res.ok) {
      const vision = res.payload && res.payload.openrouter_vision ? ` · vision ${res.payload.openrouter_vision}` : '';
      setStatus(`Connected to ${base}${vision}`, 'ok');
    } else {
      setStatus(`${res.message || 'Not reachable'} — is the backend running at ${base}?`, 'bad');
    }
  });

  els.rebind.addEventListener('click', () => {
    // Extensions cannot rebind commands programmatically; send the user to Chrome's page.
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  });

  // Re-read the live binding when the user comes back from chrome://extensions/shortcuts.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') renderShortcut();
  });

  KB.getSettings().then(render);
  renderShortcut();
})();
