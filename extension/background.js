/* KnowBear extension — background service worker. */
importScripts('lib/protocol.js', 'lib/context.js', 'lib/api.js');

const KB = globalThis.KB;
const CONTENT_FILES = ['lib/protocol.js', 'lib/context.js', 'lib/meme.js', 'lib/styles.js', 'lib/api.js', 'content.js'];
const MENU_ID = 'kb-explain-selection';
const OFFSCREEN_URL = 'offscreen/offscreen.html';

/* ---------------- Session cache (text only, TTL + LRU cap) ---------------- */

async function cacheGet(key) {
  const got = await chrome.storage.session.get(key);
  const entry = got[key];
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    await chrome.storage.session.remove(key);
    return null;
  }
  await touchIndex(key);
  return entry.text;
}

async function touchIndex(key, { evict = false } = {}) {
  const got = await chrome.storage.session.get(KB.CACHE_INDEX_KEY);
  let index = (got[KB.CACHE_INDEX_KEY] || []).filter((k) => k !== key);
  index.push(key);
  if (evict && index.length > KB.CACHE_MAX_ENTRIES) {
    const dropped = index.slice(0, index.length - KB.CACHE_MAX_ENTRIES);
    index = index.slice(-KB.CACHE_MAX_ENTRIES);
    await chrome.storage.session.remove(dropped);
  }
  await chrome.storage.session.set({ [KB.CACHE_INDEX_KEY]: index });
}

async function cacheSet(key, text) {
  if (!text) return;
  try {
    await chrome.storage.session.set({ [key]: { expiresAt: Date.now() + KB.CACHE_TTL_MS, text } });
    await touchIndex(key, { evict: true });
  } catch {
    // Quota exceeded — caching is best-effort.
  }
}

/* ---------------- Render port: one in-flight request per (tabId, frameId) ---------------- */

const inflight = new Map();

function portKey(port) {
  const tabId = port.sender && port.sender.tab ? port.sender.tab.id : 'x';
  const frameId = port.sender && typeof port.sender.frameId === 'number' ? port.sender.frameId : 0;
  return `${tabId}:${frameId}`;
}

function safePost(port, msg) {
  try {
    port.postMessage(msg);
  } catch {
    // Port closed.
  }
}

async function handleStart(port, key, msg) {
  const prev = inflight.get(key);
  if (prev) prev.abort();
  const controller = new AbortController();
  inflight.set(key, controller);
  const { requestId, request } = msg;
  const level = KB.LEVELS.includes(request.level) ? request.level : 'eli12';

  const body = { topic: request.topic, levels: [level] };
  for (const field of ['selected_text', 'surrounding_text', 'page_title', 'page_url']) {
    if (request[field]) body[field] = request[field];
  }
  if (request.regenerate) body.regenerate = true;

  try {
    const cacheKey = await KB.cacheKey(request.topic, request.surrounding_text, level);
    if (!request.regenerate) {
      const cached = await cacheGet(cacheKey);
      if (cached) {
        safePost(port, { type: KB.MSG.META, requestId, level, topic: request.topic });
        safePost(port, { type: KB.MSG.CHUNK, requestId, level, chunk: cached, full: cached });
        safePost(port, { type: KB.MSG.DONE, requestId, level, text: cached, cached: true });
        return;
      }
    }
    const base = await KB.apiBase();
    let hadWarning = false;
    const text = await KB.explain({
      base,
      body,
      signal: controller.signal,
      onMeta: (meta) => safePost(port, { type: KB.MSG.META, requestId, level, topic: meta.topic }),
      onChunk: (chunk, full) => safePost(port, { type: KB.MSG.CHUNK, requestId, level, chunk, full }),
      onWarning: (warning) => {
        hadWarning = true;
        safePost(port, { type: KB.MSG.WARNING, requestId, level, warning });
      },
    });
    if (!hadWarning) {
      await cacheSet(cacheKey, text);
    }
    safePost(port, { type: KB.MSG.DONE, requestId, level, text });
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    safePost(port, {
      type: KB.MSG.ERROR,
      requestId,
      level,
      error: { code: e.code || 'server', message: e.message, retryAfter: e.retryAfter || null, partial: e.partial || '' },
    });
  } finally {
    if (inflight.get(key) === controller) inflight.delete(key);
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== KB.PORT_NAME) return;
  const key = portKey(port);
  port.onMessage.addListener((msg) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === KB.MSG.START) handleStart(port, key, msg);
    if (msg.type === KB.MSG.ABORT) {
      const c = inflight.get(key);
      if (c) c.abort();
    }
  });
  port.onDisconnect.addListener(() => {
    const c = inflight.get(key);
    if (c) c.abort();
    inflight.delete(key);
  });
});

/* ---------------- Offscreen clipboard ---------------- */

let creatingOffscreen = null;

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
  });
  if (contexts.length) return;
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_URL,
        reasons: ['CLIPBOARD'],
        justification: 'Read clipboard for Alt+K fallback when no text is selected.',
      })
      .finally(() => {
        creatingOffscreen = null;
      });
  }
  await creatingOffscreen;
}

async function readClipboard() {
  try {
    await ensureOffscreen();
    const res = await chrome.runtime.sendMessage({ type: KB.MSG.CLIPBOARD_READ, target: 'offscreen' });
    return (res && typeof res.text === 'string' && res.text) || '';
  } catch {
    return '';
  }
}

/* ---------------- Tab messaging helpers ---------------- */

function isInjectableUrl(url) {
  return /^(https?|file):/i.test(url || '');
}

async function sendToTab(tabId, message, frameId) {
  const opts = typeof frameId === 'number' ? { frameId } : undefined;
  try {
    return await chrome.tabs.sendMessage(tabId, message, opts);
  } catch {
    return undefined;
  }
}

async function injectContent(tabId, frameId) {
  const target = typeof frameId === 'number' ? { tabId, frameIds: [frameId] } : { tabId };
  await chrome.scripting.executeScript({ target, files: CONTENT_FILES });
}

/** Make sure the top frame has the content script (tabs opened before install lack it). */
async function ensureContent(tab) {
  const alive = await sendToTab(tab.id, { type: KB.MSG.PING }, 0);
  if (alive && alive.alive) return true;
  try {
    await injectContent(tab.id, 0);
    return true;
  } catch {
    return false;
  }
}

/** Send to a tab, lazily injecting the content script if nobody is listening. */
async function sendWithInjection(tab, message, frameId) {
  const first = await sendToTab(tab.id, message, frameId);
  if (first !== undefined) return first;
  if (!isInjectableUrl(tab.url)) return undefined;
  try {
    await injectContent(tab.id, frameId);
  } catch {
    return undefined;
  }
  return sendToTab(tab.id, message, frameId);
}

function isPdfUrl(url) {
  return /\.pdf($|[?#])/i.test(url || '');
}

/* ---------------- Context menu ---------------- */

function registerContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Explain selection with KnowBear',
      contexts: ['selection'],
    });
  });
}

chrome.runtime.onInstalled.addListener(registerContextMenu);
chrome.runtime.onStartup.addListener(registerContextMenu);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab || tab.id === undefined) return;
  const text = info.selectionText || '';
  const frameId = typeof info.frameId === 'number' ? info.frameId : 0;
  const payload = { type: KB.MSG.CONTEXT_MENU_EXPLAIN, text };

  let res = await sendWithInjection(tab, payload, frameId);
  // In Chrome's OOPIF PDF viewer, info.frameId is the internal PDF extension frame;
  // fall back to the top frame (frameId 0) where content.js is running.
  if ((!res || !res.handled) && frameId !== 0) {
    res = await sendWithInjection(tab, payload, 0);
  }
  if ((!res || !res.handled) && text) {
    const normalized = KB.normalizeSelectionText(text).text;
    if (normalized) await openPopupWithPrefill(normalized);
  }
});

/* ---------------- Keyboard command (suggested Alt+K, user-rebindable) ---------------- */

async function openPopupWithPrefill(text) {
  await chrome.storage.session.set({ [KB.PREFILL_KEY]: text });
  try {
    await chrome.action.openPopup();
  } catch {
    // openPopup unavailable (older Chrome / no focused window); prefill waits for the next popup open.
  }
}

chrome.commands.onCommand.addListener(async (command, commandTab) => {
  if (command !== KB.COMMAND_NAME) return;
  const tab = commandTab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!tab || tab.id === undefined) return;
  const injectable = isInjectableUrl(tab.url);

  // 1) A frame with a live selection answers {handled: true}; frames without one stay silent.
  if (injectable) {
    await ensureContent(tab);
    const res = await sendToTab(tab.id, { type: KB.MSG.COMMAND_EXPLAIN });
    if (res && res.handled) return;
  }

  // 2) Clipboard fallback via the offscreen document.
  const { text } = KB.normalizeSelectionText(await readClipboard());
  if (!text || text.length < 2) {
    if (injectable) {
      const hint = isPdfUrl(tab.url)
        ? 'In PDFs: right-click selection → Explain with KnowBear, or press Ctrl+C then Alt+K'
        : 'Select some text first';
      await sendToTab(tab.id, { type: KB.MSG.TOAST, text: hint }, 0);
    }
    return;
  }
  if (injectable) {
    const res = await sendToTab(tab.id, { type: KB.MSG.COMMAND_EXPLAIN, text, fromClipboard: true }, 0);
    if (res && res.handled) return;
  }
  await openPopupWithPrefill(text);
});

/* ---------------- Runtime messages ---------------- */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object' || msg.target === 'offscreen') return false;

  if (msg.type === KB.MSG.CLIPBOARD_READ) {
    readClipboard().then((text) => sendResponse({ text }));
    return true;
  }

  if (msg.type === KB.MSG.OPEN_APP) {
    KB.apiBase().then((base) => {
      chrome.tabs.create({ url: KB.appUrl(String(msg.topic || ''), base) });
    });
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === KB.MSG.GET_SETTINGS) {
    KB.getSettings().then((s) => sendResponse(s));
    return true;
  }

  if (msg.type === KB.MSG.FOLLOWUP) {
    (async () => {
      try {
        const base = await KB.apiBase();
        const payload = await KB.askFollowup({ base, body: msg.body });
        sendResponse({ ok: true, answer: payload.answer, level: payload.level });
      } catch (e) {
        sendResponse({ ok: false, error: { code: e.code || 'server', message: e.message, retryAfter: e.retryAfter || null } });
      }
    })();
    return true;
  }

  return false;
});
