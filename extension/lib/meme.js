/*
 * KnowBear extension — meme parsing.
 * VERBATIM port of sanitizeMemeText + parseMemeContent from src/utils/memeImage.ts.
 * Keep in sync with the web app; pure strings, no DOM.
 */
(function (KB) {
  'use strict';

  function sanitizeMemeText(raw) {
    return raw
      .replace(/\n*---\s*\n\s*\*["'][^"']+["']\*\s*—\s*.*$/s, '')
      .replace(/\n*---\s*$/s, '')
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/^Thought:[\s\S]*?\n\n/gi, '')
      .replace(/TEMPLATE:\s*\w+\s*\n*/gi, '')
      .replace(/\n*\bPUNCHLINE:?\s*$/i, '')
      .trim();
  }

  function parseMemeContent(rawContent, fallbackTopic = 'The Concept') {
    const text = sanitizeMemeText(rawContent);

    if (text.startsWith('{') && text.endsWith('}')) {
      try {
        const parsed = JSON.parse(text);
        const setup = sanitizeMemeText(parsed.setup || fallbackTopic);
        const punchline = sanitizeMemeText(parsed.punchline || text);
        return {
          setup,
          punchline,
          cleanText: punchline || text,
        };
      } catch {
        // Ignore JSON parse failure
      }
    }

    let setup = '';
    let punchline = '';

    const setupMatch = text.match(/SETUP:\s*([\s\S]*?)(?=PUNCHLINE:?|$)/i);
    if (setupMatch) {
      setup = setupMatch[1].trim();
    }

    const punchlineMatch = text.match(/PUNCHLINE:\s*([\s\S]*?)$/i);
    if (punchlineMatch) {
      punchline = punchlineMatch[1].trim();
    }

    if (!punchline) {
      setup = fallbackTopic;
      punchline = (setupMatch ? setupMatch[1] : text)
        .replace(/^SETUP:\s*/i, '')
        .replace(/\bPUNCHLINE:?\s*$/i, '')
        .trim()
        .replace(/^["']|["']$/g, '');
    }

    setup = sanitizeMemeText(setup || fallbackTopic);
    punchline = sanitizeMemeText(punchline);

    let cleanText = text;
    if (setupMatch || punchlineMatch) {
      const cleanSetup = setup.replace(/^KnowBear(\s+asks)?:?\s*/i, '').trim();
      const cleanPunchline = punchline.replace(/^KnowBear(\s+says)?:?\s*/i, '').trim();
      if (cleanSetup && cleanSetup !== fallbackTopic) {
        cleanText = `${cleanSetup} ${cleanPunchline}`;
      } else {
        cleanText = cleanPunchline;
      }
    }

    cleanText = cleanText.replace(/^["']|["']$/g, '').trim();

    return { setup, punchline, cleanText };
  }

  KB.sanitizeMemeText = sanitizeMemeText;
  KB.parseMemeContent = parseMemeContent;
})((globalThis.KB = globalThis.KB || {}));
