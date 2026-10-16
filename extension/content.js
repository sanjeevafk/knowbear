/* KnowBear extension — content script: pill → level picker → side panel (mock panels 1–7). */
(function () {
  'use strict';
  if (globalThis.__kbContentLoaded) return; // guard against lazy re-injection
  globalThis.__kbContentLoaded = true;

  const KB = globalThis.KB;
  const IS_TOP = window === window.top;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const LONG_TOPIC_CHARS = 80; // same collapse rule as AppPage
  const ICONS = {
    chevron: 'M6 9l6 6 6-6',
    check: 'M5 12l5 5L20 7',
    close: 'M6 6l12 12M18 6L6 18',
    copy: 'M9 9h10v10H9zM5 15V5h10',
    external: 'M14 4h6v6M20 4l-9 9M18 14v5H5V6h5',
    refresh: 'M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6',
    send: 'M4 12l16-8-6 16-2-6z',
  };

  let settings = KB.normalizeSettings();
  let host = null;
  let shadow = null;
  let layer = null;
  let pill = null;
  let picker = null;
  let panel = null;
  let toastTimer = null;
  let port = null;
  let requestSeq = 0;
  let pointerDown = false;
  let selTimer = null;
  let pending = null; // { ctx, rect } snapshot taken when the pill is shown

  /* ---------------- Settings ---------------- */

  KB.getSettings().then((s) => {
    settings = s;
    applyFontSize();
  }).catch(() => {});

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes[KB.SETTINGS_KEY]) return;
    settings = KB.normalizeSettings(changes[KB.SETTINGS_KEY].newValue);
    applyFontSize();
    if (!settings.showPill) hidePill();
  });

  function applyFontSize() {
    if (shadow) KB.applyStyles(shadow, settings.fontSize);
  }

  /* ---------------- DOM helpers (textContent only, never innerHTML) ---------------- */

  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'text') el.textContent = v;
      else if (k === 'class') el.className = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (const child of [].concat(children || [])) {
      if (child === null || child === undefined || child === false) continue;
      el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return el;
  }

  function setChildren(el, ...children) {
    el.replaceChildren(...children.filter((c) => c !== null && c !== undefined && c !== false));
  }

  function icon(name, cls) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    if (cls) svg.setAttribute('class', cls);
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', ICONS[name]);
    svg.appendChild(path);
    return svg;
  }

  function ensureRoot() {
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.id = 'knowbear-root';
    shadow = host.attachShadow({ mode: 'closed' });
    KB.applyStyles(shadow, settings.fontSize);
    KB.loadFonts();
    layer = h('div', { class: 'kb-layer' });
    shadow.appendChild(layer);
    (document.body || document.documentElement).appendChild(host);
  }

  function isInsideRoot(node) {
    return !!(host && node && (node === host || host.contains(node)));
  }

  function eventInsideRoot(e) {
    return !!(host && e.composedPath && e.composedPath().includes(host));
  }

  function uiAllowed() {
    if (!/^(https?|file|about):$/.test(location.protocol)) return false;
    // Suppress UI in tiny/invisible iframes (ads, trackers, widgets).
    return IS_TOP || (window.innerWidth >= 300 && window.innerHeight >= 200);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function placeNear(el, rect) {
    const box = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = rect.bottom + 8;
    if (top + box.height > vh - 8) top = rect.top - box.height - 8;
    const left = clamp(rect.right - box.width, 8, Math.max(8, vw - box.width - 8));
    el.style.top = `${clamp(top, 8, Math.max(8, vh - box.height - 8))}px`;
    el.style.left = `${left}px`;
  }

  function centerRect() {
    const x = window.innerWidth / 2;
    const y = window.innerHeight / 3;
    return { top: y, bottom: y, left: x, right: x + 150 };
  }

  async function copyText(text) {
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Clipboard API needs a secure, focused context; fall back to execCommand.
      const ta = h('textarea', { 'aria-hidden': 'true' });
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
      layer.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      ta.remove();
      return ok;
    }
  }

  async function copyWithToast(text) {
    showToast((await copyText(text)) ? 'Copied' : "Couldn't copy");
  }

  function showToast(text) {
    if (!uiAllowed()) return;
    ensureRoot();
    const old = layer.querySelector('.kb-toast');
    if (old) old.remove();
    const toast = h('div', { class: 'kb-toast', role: 'status', 'aria-live': 'polite', text });
    layer.appendChild(toast);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.remove(), 2500);
  }

  function sendRuntime(message) {
    try {
      return chrome.runtime.sendMessage(message);
    } catch {
      return Promise.reject(KB.makeError('server', 'Extension was updated — reload this page'));
    }
  }

  /* ---------------- Selection → pill ---------------- */

  function selectionUsable(sel, { ignorePillSetting = false } = {}) {
    if (!ignorePillSetting && !settings.showPill) return false;
    if (!uiAllowed() || !sel || sel.isCollapsed || sel.rangeCount === 0) return false;
    if (sel.toString().trim().length < 2) return false;
    if (isInsideRoot(sel.anchorNode) || isInsideRoot(sel.focusNode)) return false; // self-selection guard
    if (KB.isEditableTarget(sel.anchorNode) || KB.isEditableTarget(document.activeElement)) return false;
    return true;
  }

  function selectionRect(sel) {
    const range = sel.getRangeAt(0);
    let rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      const rects = range.getClientRects();
      if (rects.length) rect = rects[rects.length - 1];
    }
    return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
  }

  function onSelectionSettled() {
    if (picker) return;
    const sel = document.getSelection();
    if (!selectionUsable(sel)) {
      hidePill();
      return;
    }
    const ctx = KB.collectContext(sel);
    if (!ctx.topic || ctx.topic.length < 2) {
      hidePill();
      return;
    }
    showPill(ctx, selectionRect(sel));
  }

  document.addEventListener('selectionchange', () => {
    clearTimeout(selTimer);
    if (pointerDown) return;
    selTimer = setTimeout(onSelectionSettled, 200);
  });
  document.addEventListener('pointerdown', (e) => {
    if (eventInsideRoot(e)) return;
    pointerDown = true;
    if (picker) closePicker();
  }, true);
  document.addEventListener('pointerup', (e) => {
    if (!pointerDown) return;
    pointerDown = false;
    if (eventInsideRoot(e)) return;
    clearTimeout(selTimer);
    selTimer = setTimeout(onSelectionSettled, 200);
  }, true);
  window.addEventListener('scroll', () => {
    if (!picker) hidePill();
  }, { passive: true, capture: true });

  function showPill(ctx, rect) {
    ensureRoot();
    pending = { ctx, rect };
    if (!pill) {
      pill = h('button', {
        class: 'kb-pill',
        type: 'button',
        'aria-haspopup': 'menu',
        onmousedown: (e) => e.preventDefault(), // keep the page selection alive
        onclick: () => pending && openPicker(pending.ctx, pending.rect),
      });
      layer.appendChild(pill);
    }
    pill.setAttribute('aria-label', `Explain selection with KnowBear (${KB.LEVEL_LABELS[settings.level]})`);
    setChildren(
      pill,
      h('span', { class: 'kb-pill-badge' }, [
        h('img', { class: 'kb-pill-mascot', src: chrome.runtime.getURL('icons/icon48.png'), alt: '' }),
        'KnowBear',
      ]),
      h('span', { class: 'kb-pill-level', text: KB.LEVEL_LABELS[settings.level] }),
      ctx.truncated ? h('span', { class: 'kb-pill-hint', text: 'first 2,000 chars' }) : null,
      icon('chevron', 'kb-chev'),
    );
    pill.hidden = false;
    placeNear(pill, rect);
  }

  function hidePill() {
    if (pill) {
      pill.remove();
      pill = null;
    }
  }

  /* ---------------- Level picker (mock panel 2) ---------------- */

  function openPicker(ctx, rect) {
    ensureRoot();
    closePicker();
    hidePill();
    pending = { ctx, rect };
    const rows = KB.LEVELS.map((level) =>
      h('button', {
        class: 'kb-row',
        type: 'button',
        role: 'menuitemradio',
        'aria-checked': String(level === settings.level),
        'data-level': level,
        onmousedown: (e) => e.preventDefault(),
        onclick: () => chooseLevel(level),
      }, [
        h('span', { class: `kb-dot kb-dot--${level}` }),
        h('span', {}, [
          h('span', { class: 'kb-row-label', text: KB.LEVEL_LABELS[level] }),
          h('span', { class: 'kb-row-hint', text: KB.LEVEL_HINTS[level] }),
        ]),
        icon('check', 'kb-check'),
      ]),
    );
    picker = h('div', { class: 'kb-picker', role: 'menu', 'aria-label': 'Explain this text as…' }, [
      h('div', { class: 'kb-picker-title', text: 'Explain this text as…' }),
      ...rows,
    ]);
    picker.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const idx = rows.indexOf(shadow.activeElement);
      const next = (idx + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
      rows[next].focus();
    });
    layer.appendChild(picker);
    placeNear(picker, rect);
    (rows.find((r) => r.getAttribute('aria-checked') === 'true') || rows[0]).focus({ preventScroll: true });
  }

  function closePicker() {
    if (picker) {
      picker.remove();
      picker = null;
    }
  }

  function chooseLevel(level) {
    const ctx = pending && pending.ctx;
    closePicker();
    if (!ctx) return;
    settings.level = level;
    KB.saveSettings({ level }).catch(() => {});
    openPanel(ctx, level);
  }

  /* ---------------- Port to background ---------------- */

  function getPort() {
    if (port) return port;
    port = chrome.runtime.connect({ name: KB.PORT_NAME });
    port.onMessage.addListener(onPortMessage);
    port.onDisconnect.addListener(() => {
      port = null;
      if (panel && panel.active) {
        const r = panel.results[panel.active.level];
        if (r && (r.status === 'loading' || r.status === 'streaming')) {
          r.status = 'error';
          r.error = { code: 'server', message: 'Connection to the extension was lost', partial: r.text };
          panel.active = null;
          renderContent();
        }
      }
    });
    return port;
  }

  function onPortMessage(msg) {
    if (!panel || !panel.active || msg.requestId !== panel.active.id) return;
    const r = panel.results[msg.level];
    if (!r) return;
    if (msg.type === KB.MSG.CHUNK) {
      r.status = 'streaming';
      r.text = msg.full;
    } else if (msg.type === KB.MSG.WARNING) {
      r.warning = msg.warning;
    } else if (msg.type === KB.MSG.DONE) {
      r.status = 'done';
      r.text = msg.text;
      panel.active = null;
    } else if (msg.type === KB.MSG.ERROR) {
      r.status = 'error';
      r.error = msg.error;
      r.text = msg.error.partial || r.text;
      panel.active = null;
    } else {
      return;
    }
    if (msg.level === panel.level) renderContent();
  }

  /* ---------------- Side panel (mock panels 3–7) ---------------- */

  function openPanel(ctx, level) {
    if (!uiAllowed()) return;
    ensureRoot();
    hidePill();
    closePicker();
    const restoreFocus = panel ? panel.restoreFocus : document.activeElement;
    if (panel) destroyPanel();

    const refs = {};
    refs.tabs = KB.LEVELS.map((lvl) =>
      h('button', {
        class: 'kb-tab',
        type: 'button',
        role: 'tab',
        'data-level': lvl,
        'aria-selected': 'false',
        text: KB.LEVEL_LABELS[lvl].toUpperCase(),
        onclick: () => selectLevel(lvl),
      }),
    );
    refs.topic = h('p', { class: 'kb-topic' });
    refs.source = h('div', { class: 'kb-source', hidden: true });
    refs.hint = h('p', { class: 'kb-hint', hidden: true });
    refs.text = h('div', { class: 'kb-text', 'aria-live': 'polite' });
    refs.meme = h('div', { class: 'kb-meme', hidden: true });
    refs.insight = h('div', { class: 'kb-insight', hidden: true });
    refs.error = h('div', { class: 'kb-error', role: 'alert', hidden: true });
    refs.steppers = h('div', { class: 'kb-steppers' });
    refs.thread = h('div', { class: 'kb-thread', 'aria-live': 'polite' });
    refs.input = h('input', {
      class: 'kb-input',
      type: 'text',
      maxlength: KB.MAX_QUESTION_CHARS,
      placeholder: 'Ask a follow-up…',
      'aria-label': 'Ask a follow-up question',
    });
    refs.send = h('button', { class: 'kb-send', type: 'submit', 'aria-label': 'Send follow-up' }, [icon('send')]);
    refs.body = h('div', { class: 'kb-body' }, [
      refs.topic, refs.source, refs.hint, refs.text, refs.meme, refs.insight, refs.error, refs.steppers, refs.thread,
    ]);

    const el = h('section', { class: 'kb-panel', role: 'dialog', 'aria-label': 'KnowBear explanation', tabindex: '-1' }, [
      h('header', { class: 'kb-header' }, [
        h('span', { class: 'kb-brand' }, [
          h('img', { class: 'kb-brand-mark', src: chrome.runtime.getURL('icons/icon48.png'), alt: '' }),
          'KnowBear',
        ]),
        h('button', {
          class: 'kb-icon-btn', type: 'button', title: 'Open in KnowBear app', 'aria-label': 'Open in KnowBear app',
          onclick: () => openInApp(),
        }, [icon('external')]),
        h('button', {
          class: 'kb-icon-btn', type: 'button', title: 'Close (Esc)', 'aria-label': 'Close',
          onclick: () => closePanel(),
        }, [icon('close')]),
      ]),
      h('div', { class: 'kb-tabs', role: 'tablist', 'aria-label': 'Explanation level' }, refs.tabs),
      refs.body,
      h('form', { class: 'kb-form', onsubmit: onFollowupSubmit }, [refs.input, refs.send]),
    ]);

    panel = { el, refs, ctx, level, results: {}, active: null, thread: [], restoreFocus };
    renderTopic();
    layer.appendChild(el);
    el.focus({ preventScroll: true });
    selectLevel(level);
  }

  function destroyPanel() {
    if (!panel) return;
    if (panel.active && port) {
      try {
        port.postMessage({ type: KB.MSG.ABORT });
      } catch {
        // Port already closed.
      }
    }
    panel.el.remove();
    panel = null;
  }

  function closePanel() {
    if (!panel) return;
    const restore = panel.restoreFocus;
    destroyPanel();
    if (restore && typeof restore.focus === 'function' && restore.isConnected) {
      try {
        restore.focus({ preventScroll: true });
      } catch {
        // Ignore focus failures.
      }
    }
  }

  function renderTopic() {
    const { topic, truncated } = panel.ctx;
    const { refs } = panel;
    if (topic.length > LONG_TOPIC_CHARS) {
      refs.topic.replaceChildren(h('strong', { text: 'Explanation for your selection' }));
      refs.source.hidden = false;
      refs.source.replaceChildren(h('span', { class: 'kb-source-title', text: 'Source Passage' }), topic);
    } else {
      refs.topic.replaceChildren('Explaining ', h('strong', { text: topic }));
      refs.source.hidden = true;
    }
    refs.truncated = truncated;
  }

  function selectLevel(level) {
    if (!panel) return;
    panel.level = level;
    for (const tab of panel.refs.tabs) {
      tab.setAttribute('aria-selected', String(tab.dataset.level === level));
    }
    const r = panel.results[level];
    if (!r || r.status === 'idle') startLevel(level);
    else renderContent();
  }

  function startLevel(level, { regenerate = false } = {}) {
    if (!panel) return;
    // Background allows one in-flight request per frame; a superseded partial is discarded.
    if (panel.active && panel.active.level !== level) delete panel.results[panel.active.level];
    const id = ++requestSeq;
    panel.active = { id, level };
    panel.results[level] = { status: 'loading', text: '', error: null, warning: null };
    renderContent();
    const { ctx } = panel;
    try {
      getPort().postMessage({
        type: KB.MSG.START,
        requestId: id,
        request: {
          topic: ctx.topic,
          level,
          regenerate: Boolean(regenerate),
          selected_text: ctx.selected_text,
          surrounding_text: ctx.surrounding_text,
          page_title: ctx.page_title,
          page_url: ctx.page_url,
        },
      });
    } catch {
      const r = panel.results[level];
      r.status = 'error';
      r.error = { code: 'server', message: 'Extension was updated — reload this page' };
      panel.active = null;
      renderContent();
    }
  }

  function paragraphs(text) {
    return String(text || '').split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  }

  function sentences(text) {
    const flat = String(text || '').replace(/\s+/g, ' ').trim();
    return (flat.match(/[^.!?]+[.!?]+["')\]]*(?=\s|$)|[^.!?]+$/g) || []).map((s) => s.trim()).filter(Boolean);
  }

  /** Client-side insight box per level (no extra request). */
  function buildInsight(level, text) {
    const sents = sentences(text);
    if (level === 'eli12' && sents.length >= 3) {
      return { title: 'In simpler terms', body: sents[0], copy: true };
    }
    if (level === 'eli5') {
      const analogy = sents.find((s) => /\b(like|imagine|as if|think of|pretend)\b/i.test(s));
      if (analogy) return { title: 'Think of it like…', body: analogy };
    }
    if (level === 'eli15') {
      const paras = paragraphs(text);
      const bullets = paras.length >= 2 ? paras.map((p) => sentences(p)[0]).filter(Boolean) : sents.slice(0, 3);
      if (bullets.length >= 2) return { title: 'Key concepts', bullets: bullets.slice(0, 4) };
    }
    return null;
  }

  function renderContent() {
    if (!panel) return;
    const { refs, level } = panel;
    const r = panel.results[level] || { status: 'loading', text: '' };
    const isMeme = level === 'meme';

    // Hint line (truncation / stream warning)
    const hints = [];
    if (refs.truncated) hints.push('Explaining the first 2,000 characters of your selection.');
    if (r.warning) hints.push(r.warning);
    refs.hint.hidden = hints.length === 0;
    setChildren(
      refs.hint,
      hints.join(' '),
      r.warning
        ? h('button', {
          class: 'kb-link-btn',
          type: 'button',
          style: 'margin-left:6px;text-decoration:underline;',
          text: 'Regenerate',
          onclick: () => startLevel(level, { regenerate: true }),
        })
        : null,
    );

    // Main text
    refs.text.classList.toggle('is-streaming', r.status === 'streaming');
    refs.meme.hidden = true;
    if (r.status === 'loading' && !r.text) {
      refs.text.hidden = false;
      refs.text.setAttribute('aria-busy', 'true');
      refs.text.replaceChildren(h('div', { class: 'kb-skeleton' }), h('div', { class: 'kb-skeleton' }), h('div', { class: 'kb-skeleton' }));
    } else {
      const displayText = isMeme && r.text
        ? (KB.parseMemeContent(r.text, panel.ctx.topic).cleanText || r.text)
        : r.text;
      refs.text.hidden = false;
      refs.text.removeAttribute('aria-busy');
      refs.text.replaceChildren(...paragraphs(displayText).map((p) => h('p', { text: p })));
    }

    // Insight box
    const insight = r.status === 'done' && !isMeme ? buildInsight(level, r.text) : null;
    refs.insight.hidden = !insight;
    if (insight) {
      setChildren(
        refs.insight,
        h('span', { class: 'kb-insight-title', text: insight.title }),
        insight.bullets
          ? h('ul', {}, insight.bullets.map((b) => h('li', { text: b })))
          : h('div', { text: insight.body }),
        insight.copy
          ? h('button', {
            class: 'kb-icon-btn', type: 'button', title: 'Copy', 'aria-label': 'Copy summary',
            onclick: () => copyWithToast(insight.body),
          }, [icon('copy')])
          : null,
      );
    }

    // Error box
    refs.error.hidden = !r.error;
    if (r.error) {
      refs.error.classList.toggle('is-offline', r.error.code === 'offline');
      setChildren(
        refs.error,
        h('span', { class: 'kb-error-msg', text: (r.text ? 'Stopped early: ' : '') + KB.errorMessage(r.error) }),
        r.error.code !== 'invalid'
          ? h('button', { class: 'kb-link-btn', type: 'button', text: 'Retry', onclick: () => startLevel(level, { regenerate: true }) })
          : null,
        h('button', {
          class: 'kb-icon-btn', type: 'button', 'aria-label': 'Dismiss error',
          onclick: () => {
            r.error = null;
            if (!r.text) r.status = 'idle';
            renderContent();
          },
        }, [icon('close')]),
      );
    }

    // Steppers + regenerate + copy
    const simpler = KB.stepLevel(level, -1);
    const deeper = KB.stepLevel(level, 1);
    const copyable = isMeme && r.text ? (KB.parseMemeContent(r.text, panel.ctx.topic).cleanText || r.text) : r.text;
    setChildren(
      refs.steppers,
      simpler ? h('button', { class: 'kb-step', type: 'button', text: 'Explain simpler ↓', onclick: () => selectLevel(simpler) }) : null,
      deeper ? h('button', { class: 'kb-step', type: 'button', text: 'Go deeper ↑', onclick: () => selectLevel(deeper) }) : null,
      h('span', { class: 'kb-spacer' }),
      r.status === 'done'
        ? h('button', {
          class: 'kb-icon-btn', type: 'button', title: 'Regenerate', 'aria-label': 'Regenerate',
          onclick: () => startLevel(level, { regenerate: true }),
        }, [icon('refresh')])
        : null,
      copyable
        ? h('button', {
          class: 'kb-icon-btn', type: 'button', title: 'Copy explanation', 'aria-label': 'Copy explanation',
          onclick: () => copyWithToast(copyable),
        }, [icon('copy')])
        : null,
    );
  }

  function openInApp() {
    if (!panel) return;
    const { topic } = panel.ctx;
    sendRuntime({ type: KB.MSG.OPEN_APP, topic }).catch(() => showToast('Extension was updated — reload this page'));
    if (topic.length > 1500) {
      copyText(topic).then((ok) => ok && showToast('Long passage — also copied to clipboard'));
    }
  }

  /* ---------------- Follow-up thread (mock panel 7) ---------------- */

  function chipSubject() {
    const { topic } = panel.ctx;
    if (topic.length <= 40) return topic;
    const stop = new Set(['about', 'their', 'there', 'these', 'those', 'which', 'would', 'could', 'should', 'where', 'while', 'other', 'being', 'because', 'through', 'without', 'within']);
    const counts = new Map();
    for (const word of topic.toLowerCase().match(/[\p{L}\p{N}-]{5,}/gu) || []) {
      if (!stop.has(word)) counts.set(word, (counts.get(word) || 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w]) => w);
    return top.length ? top.join(' ') : 'this';
  }

  function onFollowupSubmit(e) {
    e.preventDefault();
    if (!panel) return;
    const { input } = panel.refs;
    const question = KB.normalizeContextText(input.value).slice(0, KB.MAX_QUESTION_CHARS);
    if (!question) {
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    input.value = '';
    const owner = panel;
    const turn = { question, answer: '', status: 'loading', error: null };
    const history = owner.thread
      .filter((t) => t.status === 'done')
      .slice(-KB.MAX_FOLLOWUP_TURNS)
      .map((t) => ({ question: t.question, answer: t.answer.slice(0, 4000) }));
    owner.thread.push(turn);
    renderThread();

    const { ctx } = owner;
    const body = { topic: ctx.topic, question, level: owner.level, history };
    for (const field of ['selected_text', 'surrounding_text', 'page_title', 'page_url']) {
      if (ctx[field]) body[field] = ctx[field];
    }
    sendRuntime({ type: KB.MSG.FOLLOWUP, body })
      .then((res) => {
        if (res && res.ok) {
          turn.status = 'done';
          turn.answer = res.answer || '';
        } else {
          turn.status = 'error';
          turn.error = (res && res.error) || { code: 'server', message: 'No response' };
        }
      })
      .catch((err) => {
        turn.status = 'error';
        turn.error = { code: 'server', message: (err && err.message) || 'Follow-up failed' };
      })
      .finally(() => {
        if (panel === owner) renderThread();
      });
  }

  function answerBullets(answer) {
    const paras = paragraphs(answer);
    if (paras.length > 1) return paras;
    const sents = sentences(answer);
    return sents.length > 2 ? sents.slice(0, 8) : paras;
  }

  function renderThread() {
    if (!panel) return;
    const { refs, thread } = panel;
    const nodes = [];
    thread.forEach((turn, i) => {
      nodes.push(h('div', { class: 'kb-q', text: turn.question }));
      if (turn.status === 'loading') {
        nodes.push(h('div', { class: 'kb-a', 'aria-busy': 'true' }, [h('div', { class: 'kb-skeleton' }), h('div', { class: 'kb-skeleton' })]));
      } else if (turn.status === 'error') {
        nodes.push(h('div', { class: 'kb-error', role: 'alert' }, [h('span', { class: 'kb-error-msg', text: KB.errorMessage(turn.error) })]));
      } else {
        nodes.push(h('div', { class: 'kb-a' }, [h('ul', {}, answerBullets(turn.answer).map((b) => h('li', { text: b })))]));
        if (i === thread.length - 1) {
          const suggestion = `Tell me more about ${chipSubject()}`;
          nodes.push(h('button', {
            class: 'kb-chip', type: 'button', text: `${suggestion} →`,
            onclick: () => {
              refs.input.value = suggestion;
              refs.input.focus();
            },
          }));
        }
      }
    });
    refs.thread.replaceChildren(...nodes);
    const last = refs.thread.lastElementChild;
    if (last) last.scrollIntoView({ block: 'nearest' });
  }

  /* ---------------- Keyboard ---------------- */

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (picker) {
      closePicker();
      e.stopPropagation();
    } else if (pill) {
      hidePill();
    } else if (panel) {
      closePanel();
      e.stopPropagation();
    }
  }, true);

  /* ---------------- Messages from background ---------------- */

  function contextFromText(raw) {
    const { text, truncated } = KB.normalizeSelectionText(raw);
    return {
      topic: text,
      truncated,
      selected_text: text,
      surrounding_text: '',
      page_title: (document.title || '').slice(0, 300),
      page_url: location.href.slice(0, 2048),
    };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg !== 'object') return false;
    switch (msg.type) {
      case KB.MSG.PING:
        sendResponse({ alive: true });
        return false;

      case KB.MSG.COMMAND_EXPLAIN: {
        if (msg.text) {
          // Clipboard fallback: only the top frame opens the panel.
          if (!IS_TOP) return false;
          const ctx = contextFromText(msg.text);
          if (!ctx.topic) return false;
          openPanel(ctx, settings.level);
          sendResponse({ handled: true });
          return false;
        }
        const sel = document.getSelection();
        if (!selectionUsable(sel, { ignorePillSetting: true })) return false; // stay silent
        openPanel(KB.collectContext(sel), settings.level);
        sendResponse({ handled: true });
        return false;
      }

      case KB.MSG.CONTEXT_MENU_EXPLAIN: {
        if (!uiAllowed()) {
          sendResponse({ handled: false });
          return false;
        }
        const sel = document.getSelection();
        if (selectionUsable(sel, { ignorePillSetting: true })) {
          openPicker(KB.collectContext(sel), selectionRect(sel));
        } else {
          const ctx = contextFromText(msg.text || '');
          if (!ctx.topic) {
            sendResponse({ handled: false });
            return false;
          }
          openPicker(ctx, centerRect());
        }
        sendResponse({ handled: true });
        return false;
      }

      case KB.MSG.TOAST:
        showToast(String(msg.text || ''));
        sendResponse({ ok: true });
        return false;

      default:
        return false;
    }
  });

  /* ---------------- Native PDF viewer launcher ---------------- */

  if (IS_TOP && document.contentType === 'application/pdf') {
    const showPdfLauncher = () => {
      if (!settings.showPill || !uiAllowed()) return;
      ensureRoot();
      if (layer.querySelector('.kb-pdf-fab')) return;
      const fab = h('button', {
        class: 'kb-pill kb-pdf-fab',
        type: 'button',
        title: 'Right-click selected PDF text → Explain selection with KnowBear, or copy (Ctrl+C) and click here',
        'aria-label': 'Explain copied PDF text with KnowBear',
        onclick: async () => {
          const res = await sendRuntime({ type: KB.MSG.CLIPBOARD_READ }).catch(() => null);
          const ctx = contextFromText((res && res.text) || '');
          if (!ctx.topic || ctx.topic.length < 2) {
            showToast('In PDFs: right-click selected text → Explain with KnowBear, or press Ctrl+C first');
            return;
          }
          const r = fab.getBoundingClientRect();
          openPicker(ctx, { top: r.top, bottom: r.bottom, left: r.left, right: r.right });
        },
      }, [
        h('span', { class: 'kb-pill-badge' }, [
          h('img', { class: 'kb-pill-mascot', src: chrome.runtime.getURL('icons/icon48.png'), alt: '' }),
          'KnowBear',
        ]),
        h('span', { class: 'kb-pill-level', text: 'Explain copied text' }),
        icon('chevron', 'kb-chev'),
      ]);
      fab.style.cssText = 'bottom: 20px; right: 20px; top: auto; left: auto;';
      layer.appendChild(fab);
    };
    KB.getSettings().then((s) => {
      settings = s;
      showPdfLauncher();
    }).catch(showPdfLauncher);
  }
})();
