/* KnowBear extension — selection normalization + page-context extraction. */
(function (KB) {
  'use strict';

  KB.MAX_TOPIC_CHARS = KB.MAX_TOPIC_CHARS || 2000;

  // Control + zero-width chars (server CONTROL_CHARS_PATTERN plus zero-widths).
  // Keep escapes intact — formatters must not expand them.
  KB.CONTROL_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u200b-\u200d\u2060\ufeff]/g; // eslint-disable-line no-control-regex

  // Negated form of the server allowlist (api/utils.py ALLOWED_PATTERN):
  // \p{L}\p{N}\p{M}\s plus - . , ! ? ' " ( ) / + # & : = ; @ % $ * [ ] { } ~ ` ^ | \ “”‘’ –— …
  KB.DISALLOWED_RE = /[^\p{L}\p{N}\p{M}_\s\-.,!?'"()/+#&:=;@%$*[\]{}~`^|\\“”‘’–—…]/gu;

  KB.BLOCK_TAGS = new Set([
    'P', 'LI', 'DIV', 'ARTICLE', 'SECTION', 'MAIN', 'TD', 'TH', 'BLOCKQUOTE', 'PRE',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DD', 'DT', 'FIGCAPTION', 'BODY',
  ]);

  KB.truncateOnWordBoundary = function (s, max) {
    if (s.length <= max) return s;
    const cut = s.slice(0, max);
    const at = cut.lastIndexOf(' ');
    return (at > max * 0.6 ? cut.slice(0, at) : cut).trimEnd();
  };

  KB.normalizeSelectionText = function (raw) {
    if (!raw) return { text: '', truncated: false };
    let s = String(raw).normalize('NFC');
    s = s.replace(KB.CONTROL_RE, '');
    s = s.replace(KB.DISALLOWED_RE, ' '); // emoji / symbols the server would 400 on
    s = s.replace(/\s+/g, ' ').trim(); // mirrors server [\r\n\t]+ → ' ' + collapse
    const truncated = s.length > KB.MAX_TOPIC_CHARS;
    if (truncated) s = KB.truncateOnWordBoundary(s, KB.MAX_TOPIC_CHARS);
    return { text: s, truncated };
  };

  /** Whitespace/control normalization for grounding text (server re-sanitizes). */
  KB.normalizeContextText = function (raw) {
    if (!raw) return '';
    return String(raw).normalize('NFC').replace(KB.CONTROL_RE, '').replace(/\s+/g, ' ').trim();
  };

  function closestBlock(node) {
    let el = node && node.nodeType === 1 ? node : node && node.parentElement;
    while (el && !KB.BLOCK_TAGS.has(el.tagName)) el = el.parentElement;
    return el || null;
  }

  /**
   * Text around the selection: closest block ancestor (climbing up to 4 levels if it
   * is too short), windowed to ±SELECTION_CONTEXT_CHARS and capped at MAX_SURROUNDING_CHARS.
   */
  KB.extractSelectionContext = function (selection) {
    try {
      if (!selection || selection.rangeCount === 0) return '';
      const range = selection.getRangeAt(0);
      const selected = KB.normalizeContextText(selection.toString());
      if (!selected) return '';
      const radius = KB.SELECTION_CONTEXT_CHARS || 600;
      const wanted = selected.length + radius * 2;

      let block = closestBlock(range.commonAncestorContainer);
      let text = block ? KB.normalizeContextText(block.textContent) : '';
      for (let i = 0; i < 4 && block && block.parentElement && text.length < wanted; i++) {
        if (block.tagName === 'BODY') break;
        block = block.parentElement;
        text = KB.normalizeContextText(block.textContent);
      }
      if (!text || text === selected) return '';

      const probe = selected.slice(0, 200);
      let at = text.indexOf(probe);
      if (at < 0) at = Math.max(0, Math.floor((text.length - selected.length) / 2));
      const start = Math.max(0, at - radius);
      const end = Math.min(text.length, at + selected.length + radius);
      let windowText = text.slice(start, end);
      const cap = KB.MAX_SURROUNDING_CHARS || 2400;
      if (windowText.length > cap) windowText = KB.truncateOnWordBoundary(windowText, cap);
      return windowText === selected ? '' : windowText;
    } catch {
      return '';
    }
  };

  KB.collectContext = function (selection) {
    const { text, truncated } = KB.normalizeSelectionText(selection.toString());
    return {
      topic: text,
      truncated,
      selected_text: text.slice(0, 2000),
      surrounding_text: KB.extractSelectionContext(selection),
      page_title: (document.title || '').slice(0, 300),
      page_url: location.href.slice(0, 2048),
    };
  };

  KB.isEditableTarget = function (node) {
    let el = node && node.nodeType === 1 ? node : node && node.parentElement;
    while (el) {
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (el.isContentEditable) return true;
      const ce = el.getAttribute && el.getAttribute('contenteditable');
      if (ce !== null && ce !== undefined && ce !== 'false') return true;
      el = el.parentElement;
    }
    return false;
  };
})((globalThis.KB = globalThis.KB || {}));
