import { describe, it, expect, beforeEach } from 'vitest';
import './chrome-stub.js';
import '../lib/protocol.js';
import '../lib/context.js';

const KB = globalThis.KB;

describe('normalizeSelectionText', () => {
  it('collapses multiline passages to single spaces', () => {
    expect(KB.normalizeSelectionText('line one\nline two\ttabbed\r\n\r\nend').text).toBe('line one line two tabbed end');
  });

  it('strips emoji and zero-width characters', () => {
    expect(KB.normalizeSelectionText('rocket 🚀 sci\u200bence\ufeff').text).toBe('rocket science');
  });

  it('keeps curly quotes, dashes, ellipsis, braces and code symbols', () => {
    const raw = '“quotes” –dash— … {braces} [x] ~ | \\ ^ `tick`';
    expect(KB.normalizeSelectionText(raw).text).toBe(raw);
  });

  it('keeps non-Latin letters and combining marks', () => {
    expect(KB.normalizeSelectionText('Привет मनुष्य café').text).toBe('Привет मनुष्य café');
  });

  it('truncates over 2000 chars on a word boundary and flags it', () => {
    const raw = Array.from({ length: 600 }, (_, i) => `word${i}`).join(' ');
    const { text, truncated } = KB.normalizeSelectionText(raw);
    expect(truncated).toBe(true);
    expect(text.length).toBeLessThanOrEqual(2000);
    expect(raw.startsWith(text)).toBe(true);
    expect(raw.charAt(text.length)).toBe(' ');
  });

  it('returns empty for empty input', () => {
    expect(KB.normalizeSelectionText('')).toEqual({ text: '', truncated: false });
    expect(KB.normalizeSelectionText(null)).toEqual({ text: '', truncated: false });
  });
});

describe('truncateOnWordBoundary', () => {
  it('cuts hard when no reasonable space exists', () => {
    expect(KB.truncateOnWordBoundary('a'.repeat(50), 10)).toBe('a'.repeat(10));
  });
  it('returns short strings unchanged', () => {
    expect(KB.truncateOnWordBoundary('short', 10)).toBe('short');
  });
});

describe('selection context extraction', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.title = 'Agents article';
  });

  function selectText(node, start, end) {
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return sel;
  }

  it('returns the surrounding block text around the selection', () => {
    const p = document.createElement('p');
    p.textContent = 'Unlike copilots that wait, AI agents break down complex tasks and use tools autonomously.';
    document.body.appendChild(p);
    const text = p.firstChild;
    const start = text.data.indexOf('AI agents');
    const sel = selectText(text, start, start + 'AI agents'.length);

    const ctx = KB.collectContext(sel);
    expect(ctx.topic).toBe('AI agents');
    expect(ctx.selected_text).toBe('AI agents');
    expect(ctx.surrounding_text).toContain('Unlike copilots');
    expect(ctx.surrounding_text).toContain('use tools autonomously');
    expect(ctx.page_title).toBe('Agents article');
    expect(ctx.page_url).toMatch(/^http/);
  });

  it('windows long blocks to ±600 chars and caps at 2400', () => {
    const p = document.createElement('p');
    p.textContent = `${'before '.repeat(400)}TARGET${' after'.repeat(400)}`;
    document.body.appendChild(p);
    const text = p.firstChild;
    const start = text.data.indexOf('TARGET');
    const sel = selectText(text, start, start + 6);
    const surrounding = KB.extractSelectionContext(sel);
    expect(surrounding).toContain('TARGET');
    expect(surrounding.length).toBeLessThanOrEqual(1206);
    expect(surrounding.length).toBeLessThanOrEqual(KB.MAX_SURROUNDING_CHARS);
  });

  it('returns empty context when the block is only the selection', () => {
    const p = document.createElement('p');
    p.textContent = 'Alone';
    document.body.appendChild(p);
    const sel = selectText(p.firstChild, 0, 5);
    expect(KB.extractSelectionContext(sel)).toBe('');
  });
});

describe('isEditableTarget', () => {
  it('detects inputs, textareas, selects and contenteditable ancestors', () => {
    document.body.innerHTML = `
      <input id="i" /><textarea id="t"></textarea><select id="s"></select>
      <div contenteditable="true"><span id="ce">x</span></div>
      <div contenteditable="false"><span id="nce">y</span></div>
      <p id="p">plain</p>`;
    expect(KB.isEditableTarget(document.getElementById('i'))).toBe(true);
    expect(KB.isEditableTarget(document.getElementById('t'))).toBe(true);
    expect(KB.isEditableTarget(document.getElementById('s'))).toBe(true);
    expect(KB.isEditableTarget(document.getElementById('ce').firstChild)).toBe(true);
    expect(KB.isEditableTarget(document.getElementById('nce'))).toBe(false);
    expect(KB.isEditableTarget(document.getElementById('p').firstChild)).toBe(false);
    expect(KB.isEditableTarget(null)).toBe(false);
  });
});
