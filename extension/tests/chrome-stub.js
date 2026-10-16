/* Minimal chrome.* stub for vitest (jsdom). Import before any extension lib script. */
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

function createArea() {
  let data = {};
  return {
    async get(keys) {
      if (keys == null) return { ...data };
      const list = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys);
      const out = {};
      for (const k of list) if (k in data) out[k] = data[k];
      return out;
    },
    async set(items) {
      data = { ...data, ...items };
    },
    async remove(keys) {
      for (const k of [].concat(keys)) delete data[k];
    },
    async clear() {
      data = {};
    },
    _dump: () => ({ ...data }),
  };
}

function createEvent() {
  const listeners = [];
  return {
    addListener: (fn) => listeners.push(fn),
    removeListener: (fn) => listeners.splice(listeners.indexOf(fn), 1),
    _emit: (...args) => listeners.forEach((fn) => fn(...args)),
    _listeners: listeners,
  };
}

export function resetChromeStub() {
  globalThis.chrome = {
    storage: {
      session: createArea(),
      sync: createArea(),
      local: createArea(),
      onChanged: createEvent(),
    },
    runtime: {
      getURL: (p) => `chrome-extension://test-id/${p}`,
      sendMessage: async () => undefined,
      connect: () => ({ postMessage() {}, onMessage: createEvent(), onDisconnect: createEvent() }),
      onMessage: createEvent(),
      onConnect: createEvent(),
      onInstalled: createEvent(),
      getContexts: async () => [],
    },
    tabs: { create: async () => ({}), query: async () => [], sendMessage: async () => undefined, captureVisibleTab: async () => '' },
    commands: { getAll: async () => [{ name: 'explain-selection', shortcut: 'Alt+K' }], onCommand: createEvent() },
    contextMenus: { create() {}, removeAll: (cb) => cb && cb(), onClicked: createEvent() },
    offscreen: { createDocument: async () => {} },
    scripting: { executeScript: async () => [] },
    action: { openPopup: async () => {} },
  };
  return globalThis.chrome;
}

resetChromeStub();
