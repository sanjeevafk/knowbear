import { describe, it, expect } from 'vitest';
import './chrome-stub.js';
import '../lib/protocol.js';
import '../lib/meme.js';

const KB = globalThis.KB;

// Same fixtures as src/tests/MemeRenderer.test.tsx, plus JSON / TEMPLATE / think-block cases.
describe('KB.parseMemeContent (parity with web app)', () => {
  it('parses structured SETUP and PUNCHLINE tags into cleanText', () => {
    const raw = `SETUP: Explaining code in a 100-page document
PUNCHLINE: Summarizing with a single KnowBear meme`;
    const parsed = KB.parseMemeContent(raw);
    expect(parsed.setup).toBe('Explaining code in a 100-page document');
    expect(parsed.punchline).toBe('Summarizing with a single KnowBear meme');
    expect(parsed.cleanText).toBe('Explaining code in a 100-page document Summarizing with a single KnowBear meme');
  });

  it('handles plain text one-liners with topic-as-setup fallback', () => {
    const raw = 'Quantum physics: where turning on the lights changes the experiment.';
    const parsed = KB.parseMemeContent(raw, 'Quantum Computing');
    expect(parsed.setup).toBe('Quantum Computing');
    expect(parsed.punchline).toBe(raw);
    expect(parsed.cleanText).toBe(raw);
  });

  it('strips regeneration quotes and horizontal rules', () => {
    const raw = `When you deploy to production on Friday, PagerDuty becomes your weekend DJ.

---
*"Learning never exhausts the mind."* — Leonardo da Vinci`;
    const parsed = KB.parseMemeContent(raw);
    expect(parsed.cleanText).toBe('When you deploy to production on Friday, PagerDuty becomes your weekend DJ.');
    expect(parsed.cleanText).not.toContain('Leonardo da Vinci');
  });

  it('strips think blocks', () => {
    const parsed = KB.parseMemeContent('<think>plan the joke</think>SETUP: Cache miss\nPUNCHLINE: Me asking mom twice');
    expect(parsed.setup).toBe('Cache miss');
    expect(parsed.punchline).toBe('Me asking mom twice');
    expect(parsed.cleanText).not.toContain('plan the joke');
  });

  it('strips TEMPLATE: lines', () => {
    const parsed = KB.parseMemeContent('TEMPLATE: drake\nSETUP: Reading docs\nPUNCHLINE: Asking the bear');
    expect(parsed.setup).toBe('Reading docs');
    expect(parsed.cleanText).toBe('Reading docs Asking the bear');
  });

  it('uses JSON output with cleanText = punchline', () => {
    const parsed = KB.parseMemeContent('{"setup": "Async code", "punchline": "Promises I cannot keep"}');
    expect(parsed.setup).toBe('Async code');
    expect(parsed.punchline).toBe('Promises I cannot keep');
    expect(parsed.cleanText).toBe('Promises I cannot keep');
  });

  it('strips KnowBear asks/says prefixes from cleanText', () => {
    const parsed = KB.parseMemeContent('SETUP: KnowBear asks: Why recursion?\nPUNCHLINE: KnowBear says: See recursion.');
    expect(parsed.cleanText).toBe('Why recursion? See recursion.');
  });

  it('strips raw SETUP/PUNCHLINE labels if stream truncates before punchline text', () => {
    const parsed = KB.parseMemeContent(
      'SETUP: Minimizing a DFA is like cleaning your closet: PUNCHLINE',
      'This passage',
    );
    expect(parsed.setup).toBe('This passage');
    expect(parsed.punchline).toBe('Minimizing a DFA is like cleaning your closet:');
    expect(parsed.punchline).not.toContain('SETUP:');
    expect(parsed.punchline).not.toContain('PUNCHLINE');
  });
});
