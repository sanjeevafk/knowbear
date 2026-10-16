/* KnowBear extension — shared protocol + constants (classic script, defines globalThis.KB). */
(function (KB) {
  'use strict';

  KB.VERSION = 1;
  KB.LEVELS = ['eli5', 'eli12', 'eli15', 'meme'];
  KB.LEVEL_ORDER = ['eli5', 'eli12', 'eli15']; // stepper order; meme is a mode, not a depth
  KB.LEVEL_LABELS = { eli5: 'ELI5', eli12: 'ELI12', eli15: 'ELI15', meme: 'Meme' };
  KB.LEVEL_HINTS = {
    eli5: 'Very simple, easy to understand',
    eli12: 'Balanced, with key concepts',
    eli15: 'More technical and detailed',
    meme: 'Explain with humor and analogies',
  };
  KB.MAX_TOPIC_CHARS = 2000; // mirrors api/utils.py MAX_TOPIC_LENGTH
  KB.MAX_SURROUNDING_CHARS = 2400; // server caps at 2500
  KB.SELECTION_CONTEXT_CHARS = 600; // ± chars around selection
  KB.MAX_QUESTION_CHARS = 500;
  KB.MAX_FOLLOWUP_TURNS = 6;
  KB.MAX_IMAGE_DATA_URL_CHARS = 4 * 1024 * 1024; // client guard; server has no cap yet
  KB.CACHE_TTL_MS = 300000; // matches RESPONSE_CACHE_TTL_SECONDS
  KB.CACHE_MAX_ENTRIES = 50; // storage.session quota guard (~10MB)
  KB.CACHE_PREFIX = 'kb:cache:';
  KB.CACHE_INDEX_KEY = 'kb:cache-index';
  KB.PREFILL_KEY = 'kb:prefill';
  KB.SETTINGS_KEY = 'kb:settings';
  KB.PORT_NAME = 'kb-render';
  KB.APP_BASE = 'https://knowbear.sanjeevkumar.me/app'; // route split: '/' is LandingPage
  KB.LOCAL_APP_BASE = 'http://localhost:5173/app';
  KB.DEFAULT_API_BASE = 'https://knowbear.sanjeevkumar.me';
  KB.COMMAND_NAME = 'explain-selection';
  KB.MSG = {
    START: 'kb:start',
    META: 'kb:meta',
    CHUNK: 'kb:chunk',
    WARNING: 'kb:warning',
    DONE: 'kb:done',
    ABORT: 'kb:abort',
    ERROR: 'kb:error',
    ANSWER: 'kb:answer',
    FOLLOWUP: 'kb:followup',
    COMMAND_EXPLAIN: 'kb:command-explain',
    CONTEXT_MENU_EXPLAIN: 'kb:context-menu-explain',
    GET_SETTINGS: 'kb:get-settings',
    OPEN_APP: 'kb:open-app',
    CLIPBOARD_READ: 'kb:clipboard-read',
    TOAST: 'kb:toast',
    PING: 'kb:ping',
  };
  KB.defaultSettings = { level: 'eli12', fontSize: 15, showPill: true, apiBase: 'https://knowbear.sanjeevkumar.me' };
  KB.VISION_UNAVAILABLE_RE = /vision unavailable|not configured for visual|not configured for heavy\/visual/i;

  KB.clampFontSize = function (value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return KB.defaultSettings.fontSize;
    return Math.min(18, Math.max(13, Math.round(n)));
  };

  /** Merge stored values over defaults, discarding anything invalid. */
  KB.normalizeSettings = function (stored) {
    const s = Object.assign({}, KB.defaultSettings, stored || {});
    if (!KB.LEVELS.includes(s.level)) s.level = KB.defaultSettings.level;
    s.fontSize = KB.clampFontSize(s.fontSize);
    s.showPill = s.showPill !== false;
    s.apiBase = KB.normalizeApiBase(s.apiBase);
    return s;
  };

  KB.normalizeApiBase = function (value) {
    const raw = typeof value === 'string' ? value.trim() : '';
    return (raw || KB.DEFAULT_API_BASE).replace(/\/+$/, '');
  };

  KB.getSettings = async function () {
    const stored = await chrome.storage.sync.get(KB.SETTINGS_KEY);
    return KB.normalizeSettings(stored[KB.SETTINGS_KEY]);
  };

  KB.saveSettings = async function (patch) {
    const next = KB.normalizeSettings(Object.assign({}, await KB.getSettings(), patch));
    await chrome.storage.sync.set({ [KB.SETTINGS_KEY]: next });
    return next;
  };

  KB.apiBase = async function () {
    return (await KB.getSettings()).apiBase;
  };

  KB.appUrl = function (topic, apiBase) {
    let base = KB.APP_BASE;
    if (typeof apiBase === 'string') {
      if (/^http:\/\/(localhost|127\.0\.0\.1)\b/i.test(apiBase)) base = KB.LOCAL_APP_BASE;
      else if (/^https:\/\//i.test(apiBase)) base = apiBase.replace(/\/+$/, '') + '/app';
    }
    return base + '?q=' + encodeURIComponent(topic || '');
  };

  /** SHA-256 hex digest truncated to 12 chars (SubtleCrypto, async). */
  KB.sha256Hex12 = async function (text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 12);
  };

  KB.cacheKey = async function (topic, surroundingText, level) {
    const hash = await KB.sha256Hex12((topic || '') + '\x1f' + (surroundingText || ''));
    return KB.CACHE_PREFIX + hash + ':' + level;
  };

  KB.stepLevel = function (level, direction) {
    const from = level === 'meme' ? 'eli12' : level;
    const idx = KB.LEVEL_ORDER.indexOf(from);
    if (idx < 0) return null;
    if (level === 'meme') return direction < 0 ? 'eli5' : 'eli15';
    return KB.LEVEL_ORDER[idx + direction] || null;
  };
})((globalThis.KB = globalThis.KB || {}));
