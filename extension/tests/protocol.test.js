import { describe, it, expect, beforeEach } from 'vitest';
import { resetChromeStub } from './chrome-stub.js';
import '../lib/protocol.js';

const KB = globalThis.KB;

describe('protocol constants', () => {
  it('defines levels, labels and hints for all four modes', () => {
    expect(KB.LEVELS).toEqual(['eli5', 'eli12', 'eli15', 'meme']);
    for (const level of KB.LEVELS) {
      expect(KB.LEVEL_LABELS[level]).toBeTruthy();
      expect(KB.LEVEL_HINTS[level]).toBeTruthy();
    }
    expect(KB.MAX_TOPIC_CHARS).toBe(2000);
    expect(KB.CACHE_MAX_ENTRIES).toBe(50);
    expect(KB.APP_BASE).toBe('https://knowbear.sanjeevkumar.me/app');
  });

  it('builds /app deep links (not the landing page)', () => {
    expect(KB.appUrl('TCP & UDP?')).toBe('https://knowbear.sanjeevkumar.me/app?q=TCP%20%26%20UDP%3F');
    expect(KB.appUrl('TCP & UDP?', 'http://localhost:8000')).toBe('http://localhost:5173/app?q=TCP%20%26%20UDP%3F');
  });

  it('matches vision-unavailable messages from batch and stream', () => {
    expect(KB.VISION_UNAVAILABLE_RE.test('Vision unavailable: OpenRouter is not configured')).toBe(true);
    expect(KB.VISION_UNAVAILABLE_RE.test('OpenRouter is not configured for visual tasks.')).toBe(true);
    expect(KB.VISION_UNAVAILABLE_RE.test('OpenRouter is not configured for heavy/visual tasks.')).toBe(true);
    expect(KB.VISION_UNAVAILABLE_RE.test('Invalid characters in topic')).toBe(false);
  });
});

describe('settings', () => {
  beforeEach(() => resetChromeStub());

  it('returns defaults when nothing is stored', async () => {
    expect(await KB.getSettings()).toEqual({ level: 'eli12', fontSize: 15, showPill: true, apiBase: 'https://knowbear.sanjeevkumar.me' });
  });

  it('normalizes invalid stored values', () => {
    const s = KB.normalizeSettings({ level: 'phd', fontSize: 40, showPill: false, apiBase: 'http://127.0.0.1:9000///' });
    expect(s).toEqual({ level: 'eli12', fontSize: 18, showPill: false, apiBase: 'http://127.0.0.1:9000' });
  });

  it('saves a patch and apiBase reads it back', async () => {
    await KB.saveSettings({ apiBase: 'http://localhost:8001/', level: 'meme' });
    expect(await KB.apiBase()).toBe('http://localhost:8001');
    expect((await KB.getSettings()).level).toBe('meme');
  });
});

describe('cache key + stepping', () => {
  it('uses SHA-256 hex[:12] of topic \\x1f surrounding', async () => {
    const key = await KB.cacheKey('Cats', 'ctx', 'eli5');
    expect(key).toMatch(/^kb:cache:[0-9a-f]{12}:eli5$/);
    expect(await KB.cacheKey('Cats', 'ctx', 'eli5')).toBe(key);
    expect(await KB.cacheKey('Cats', 'other', 'eli5')).not.toBe(key);
    // known vector: sha256("abc") = ba7816bf8f01...
    expect(await KB.sha256Hex12('abc')).toBe('ba7816bf8f01');
  });

  it('steps through ELI5 → ELI12 → ELI15 only', () => {
    expect(KB.stepLevel('eli5', -1)).toBeNull();
    expect(KB.stepLevel('eli5', 1)).toBe('eli12');
    expect(KB.stepLevel('eli12', 1)).toBe('eli15');
    expect(KB.stepLevel('eli15', 1)).toBeNull();
    expect(KB.stepLevel('meme', -1)).toBe('eli5');
    expect(KB.stepLevel('meme', 1)).toBe('eli15');
  });
});
