/* KnowBear extension — popup: text + image (paste/upload/capture) modes, batch explain. */
(function () {
  'use strict';
  const KB = globalThis.KB;
  const $ = (id) => document.getElementById(id);

  const els = {
    modeText: $('mode-text'), modeImage: $('mode-image'),
    paneText: $('pane-text'), paneImage: $('pane-image'),
    form: $('form'), topic: $('topic'), topicHint: $('topic-hint'),
    drop: $('drop'), preview: $('preview'), dropEmpty: $('drop-empty'),
    file: $('file'), capture: $('capture'), clearImage: $('clear-image'), imageTopic: $('image-topic'),
    level: $('level'), submit: $('submit'), notice: $('notice'),
    result: $('result'), resultBody: $('result-body'), openApp: $('open-app'), copy: $('copy'),
  };

  const state = { mode: 'text', image: null, objectUrl: null, lastTopic: '', lastCopy: '', controller: null };

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function showNotice(message, { info = false } = {}) {
    els.notice.hidden = !message;
    els.notice.textContent = message || '';
    els.notice.classList.toggle('is-info', info);
  }

  function setMode(mode) {
    state.mode = mode;
    els.modeText.setAttribute('aria-selected', String(mode === 'text'));
    els.modeImage.setAttribute('aria-selected', String(mode === 'image'));
    els.paneText.hidden = mode !== 'text';
    els.paneImage.hidden = mode !== 'image';
    showNotice('');
    if (mode === 'image') els.drop.focus();
    else els.topic.focus();
  }

  /** Normalize typed/pasted text and surface the truncation hint. */
  function prepareText(raw) {
    const { text, truncated } = KB.normalizeSelectionText(raw);
    els.topicHint.hidden = !truncated;
    els.topicHint.textContent = truncated ? 'Only the first 2,000 characters will be explained.' : '';
    return text;
  }

  /* ---------------- Image handling ---------------- */

  function revokePreview() {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }

  function clearImage() {
    revokePreview();
    state.image = null;
    els.preview.hidden = true;
    els.preview.removeAttribute('src');
    els.dropEmpty.hidden = false;
    els.clearImage.hidden = true;
  }

  function setImage(dataUrl, previewSrc) {
    if (dataUrl.length > KB.MAX_IMAGE_DATA_URL_CHARS) {
      showNotice('Image is too large (max ~4MB). Try a smaller screenshot.');
      return;
    }
    revokePreview();
    state.image = dataUrl;
    if (previewSrc && previewSrc.startsWith('blob:')) state.objectUrl = previewSrc;
    els.preview.src = previewSrc || dataUrl;
    els.preview.hidden = false;
    els.dropEmpty.hidden = true;
    els.clearImage.hidden = false;
    showNotice('');
  }

  function readFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showNotice('That file is not an image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result), URL.createObjectURL(file));
    reader.onerror = () => showNotice("Couldn't read that image.");
    reader.readAsDataURL(file);
  }

  document.addEventListener('paste', (e) => {
    const items = Array.from((e.clipboardData && e.clipboardData.items) || []);
    const imageItem = items.find((i) => i.kind === 'file' && i.type.startsWith('image/'));
    if (imageItem) {
      e.preventDefault();
      setMode('image');
      readFile(imageItem.getAsFile());
      return;
    }
    if (document.activeElement === els.topic) {
      // Let the paste land, then normalize/truncate oversize text.
      setTimeout(() => {
        if (els.topic.value.length >= 2000) prepareText(els.topic.value);
      }, 0);
    }
  });

  els.file.addEventListener('change', () => {
    if (els.file.files && els.file.files[0]) readFile(els.file.files[0]);
    els.file.value = '';
  });

  els.capture.addEventListener('click', async () => {
    try {
      // Popup open = action click, so the activeTab grant is present.
      let dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      if (dataUrl.length > KB.MAX_IMAGE_DATA_URL_CHARS) {
        dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 80 });
      }
      setImage(dataUrl);
    } catch {
      showNotice("Can't capture this page. Paste or upload a screenshot instead.");
    }
  });

  els.clearImage.addEventListener('click', clearImage);

  /* ---------------- Result rendering (textContent only) ---------------- */

  function renderResult(text, level, topic) {
    els.resultBody.replaceChildren();
    const displayText = level === 'meme'
      ? (KB.parseMemeContent(text, topic.length > 80 ? 'This passage' : topic).cleanText || text)
      : text;
    for (const para of displayText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)) {
      els.resultBody.append(el('p', '', para));
    }
    state.lastCopy = displayText;
    state.lastTopic = topic;
    els.result.hidden = false;
  }

  /* ---------------- Submit ---------------- */

  els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showNotice('');
    const level = els.level.value;
    const body = { levels: [level] };
    const imageFlow = state.mode === 'image';

    if (imageFlow) {
      if (!state.image) {
        showNotice('Add an image first: paste, upload, or capture.');
        return;
      }
      body.image = state.image;
      const extra = prepareText(els.imageTopic.value);
      if (extra) body.topic = extra;
    } else {
      const topic = prepareText(els.topic.value);
      if (!topic || topic.length < 2) {
        showNotice('Type or paste something to explain.');
        els.topic.focus();
        return;
      }
      body.topic = topic;
    }

    if (state.controller) state.controller.abort();
    state.controller = new AbortController();
    els.submit.disabled = true;
    els.submit.textContent = 'Explaining…';
    try {
      const base = await KB.apiBase();
      const { topic, text } = await KB.askBatch({ base, body, signal: state.controller.signal });
      renderResult(text, level, topic || body.topic || '');
      KB.saveSettings({ level }).catch(() => {});
      if (imageFlow) revokePreview(); // object URL no longer needed once sent
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      showNotice(KB.errorMessage(err, { imageFlow }));
    } finally {
      els.submit.disabled = false;
      els.submit.textContent = 'Explain';
    }
  });

  els.openApp.addEventListener('click', async () => {
    if (!state.lastTopic) return;
    const base = await KB.apiBase();
    chrome.tabs.create({ url: KB.appUrl(state.lastTopic, base) });
  });

  els.copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(state.lastCopy);
      els.copy.textContent = 'Copied';
      setTimeout(() => (els.copy.textContent = 'Copy'), 1500);
    } catch {
      showNotice("Couldn't copy to clipboard.");
    }
  });

  els.modeText.addEventListener('click', () => setMode('text'));
  els.modeImage.addEventListener('click', () => setMode('image'));

  /* ---------------- Init: settings + prefill ---------------- */

  (async function init() {
    const settings = await KB.getSettings().catch(() => KB.normalizeSettings());
    els.level.value = settings.level;

    // Alt+K clipboard fallback stores a one-shot prefill in session storage.
    const stored = await chrome.storage.session.get(KB.PREFILL_KEY).catch(() => ({}));
    let prefill = stored[KB.PREFILL_KEY] || '';
    if (prefill) await chrome.storage.session.remove(KB.PREFILL_KEY).catch(() => {});

    if (!prefill) {
      try {
        prefill = await navigator.clipboard.readText();
      } catch {
        prefill = '';
      }
    }
    const text = prefill ? prepareText(prefill) : '';
    if (text && text.length >= 2) {
      els.topic.value = text;
      els.topic.select();
    }
    els.topic.focus();
  })();
})();
