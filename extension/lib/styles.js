/* KnowBear extension — shadow-DOM stylesheet + design tokens (dark panel per mock). */
(function (KB) {
  'use strict';

  KB.FONT_FAMILY_NAME = 'KnowBear Plex';
  KB.FONT_FILES = [
    { file: 'fonts/IBMPlexSans-Regular.woff2', weight: '400' },
    { file: 'fonts/IBMPlexSans-SemiBold.woff2', weight: '600' },
    { file: 'fonts/IBMPlexSans-Bold.woff2', weight: '700' },
  ];

  KB.CSS = `
:host {
  all: initial;
  --kb-font-size: 15px;
  --kb-bg: #141310;
  --kb-bg-raised: #1c1b17;
  --kb-bg-sunken: #0f0e0c;
  --kb-border: #26241f;
  --kb-text: #f5f2e8;
  --kb-muted: #9b968a;
  --kb-accent: #e8c547;
  --kb-accent-text: #141310;
  --kb-eli5: #4ade80;
  --kb-eli12: #60a5fa;
  --kb-eli15: #a78bfa;
  --kb-meme: #fb923c;
  --kb-danger: #f87171;
  --kb-radius: 12px;
  --kb-shadow: 0 8px 28px rgba(0, 0, 0, .45);
  --kb-ease: cubic-bezier(.2, .7, .2, 1);
}
* { box-sizing: border-box; }
.kb-layer {
  font-family: "${KB.FONT_FAMILY_NAME}", "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: var(--kb-font-size);
  line-height: 1.55;
  color: var(--kb-text);
  -webkit-font-smoothing: antialiased;
}
button, input, textarea { font: inherit; color: inherit; }
button { cursor: pointer; }
:focus-visible { outline: 2px solid var(--kb-accent); outline-offset: 2px; }
[hidden] { display: none !important; }
.kb-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* Pill (mock panel 1) */
.kb-pill {
  position: fixed; z-index: 2147483647;
  display: inline-flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 10px 0 4px;
  background: var(--kb-bg); border: 1px solid var(--kb-border); border-radius: 999px;
  box-shadow: var(--kb-shadow);
  animation: kb-pop .14s var(--kb-ease);
}
.kb-pill-badge {
  display: inline-flex; align-items: center; gap: 6px;
  height: 24px; padding: 0 9px 0 4px; border-radius: 999px;
  background: var(--kb-accent); color: var(--kb-accent-text);
  font-weight: 700; font-size: 12.5px; letter-spacing: .01em;
}
.kb-pill-mascot {
  width: 18px; height: 18px; border-radius: 50%; object-fit: cover; display: block;
}
.kb-pill-level { font-size: 12.5px; font-weight: 600; color: var(--kb-text); }
.kb-chev { width: 12px; height: 12px; color: var(--kb-muted); }
.kb-pill-hint { font-size: 11px; color: var(--kb-muted); }

/* Level picker (mock panel 2) */
.kb-picker {
  position: fixed; z-index: 2147483647; width: 300px; padding: 8px;
  background: var(--kb-bg); border: 1px solid var(--kb-border); border-radius: var(--kb-radius);
  box-shadow: var(--kb-shadow);
  animation: kb-pop .14s var(--kb-ease);
}
.kb-picker-title { padding: 6px 8px 8px; font-size: 12.5px; color: var(--kb-muted); font-weight: 600; }
.kb-row {
  display: grid; grid-template-columns: 10px 1fr 16px; align-items: center; gap: 10px;
  width: 100%; padding: 8px; border: 0; border-radius: 8px; background: transparent; text-align: left;
}
.kb-row:hover, .kb-row:focus-visible { background: var(--kb-bg-raised); }
.kb-row-label { display: block; font-weight: 600; font-size: 13.5px; }
.kb-row-hint { display: block; font-size: 12px; color: var(--kb-muted); }
.kb-dot { width: 10px; height: 10px; border-radius: 50%; }
.kb-dot--eli5 { background: var(--kb-eli5); }
.kb-dot--eli12 { background: var(--kb-eli12); }
.kb-dot--eli15 { background: var(--kb-eli15); }
.kb-dot--meme { background: var(--kb-meme); }
.kb-check { width: 16px; height: 16px; color: var(--kb-accent); visibility: hidden; }
.kb-row[aria-checked="true"] .kb-check { visibility: visible; }

/* Side panel (mock panels 3–7) */
.kb-panel {
  position: fixed; z-index: 2147483647; top: 16px; right: 16px;
  width: min(380px, calc(100vw - 32px)); max-height: 90vh;
  display: flex; flex-direction: column;
  background: var(--kb-bg); border: 1px solid var(--kb-border); border-radius: var(--kb-radius);
  box-shadow: var(--kb-shadow); overflow: hidden;
  animation: kb-slide .18s var(--kb-ease);
}
.kb-header { display: flex; align-items: center; gap: 8px; padding: 10px 10px 8px 14px; }
.kb-brand { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14.5px; flex: 1; }
.kb-brand-mark {
  width: 24px; height: 24px; border-radius: 7px; object-fit: cover; display: block;
  background: #0F1B2D; border: 1px solid rgba(232, 197, 71, .35);
}
.kb-icon-btn {
  display: inline-grid; place-items: center; width: 28px; height: 28px;
  border: 0; border-radius: 7px; background: transparent; color: var(--kb-muted);
}
.kb-icon-btn:hover { background: var(--kb-bg-raised); color: var(--kb-text); }
.kb-icon-btn svg { width: 15px; height: 15px; }
.kb-tabs { display: flex; gap: 2px; padding: 0 10px; border-bottom: 1px solid var(--kb-border); }
.kb-tab {
  flex: 1; padding: 8px 4px 9px; border: 0; background: transparent;
  color: var(--kb-muted); font-size: 12.5px; font-weight: 600; letter-spacing: .03em;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.kb-tab:hover { color: var(--kb-text); }
.kb-tab[aria-selected="true"] { color: var(--kb-text); border-bottom-color: var(--kb-accent); }
.kb-tab[data-level="meme"][aria-selected="true"] { border-bottom-color: var(--kb-meme); }
.kb-body { flex: 1; overflow-y: auto; padding: 12px 14px 4px; overscroll-behavior: contain; }
.kb-topic { margin: 0 0 8px; font-size: 12px; color: var(--kb-muted); }
.kb-topic strong { color: var(--kb-text); font-weight: 600; }
.kb-source {
  margin: 0 0 10px; padding: 8px 10px; border-radius: 8px; background: var(--kb-bg-sunken);
  border: 1px solid var(--kb-border); font-size: 12px; color: var(--kb-muted);
  max-height: 84px; overflow: auto;
}
.kb-source-title { display: block; font-weight: 600; color: var(--kb-text); margin-bottom: 2px; }
.kb-hint { margin: 0 0 8px; font-size: 11.5px; color: var(--kb-accent); }
.kb-text p { margin: 0 0 .7em; }
.kb-text.is-streaming p:last-child::after {
  content: ""; display: inline-block; width: .5em; height: 1em; margin-left: 2px;
  vertical-align: -2px; background: var(--kb-accent); animation: kb-blink 1s steps(2) infinite;
}
.kb-skeleton { height: 10px; margin: 8px 0; border-radius: 6px; background: var(--kb-bg-raised); animation: kb-pulse 1.2s ease-in-out infinite; }
.kb-skeleton:nth-child(2) { width: 86%; }
.kb-skeleton:nth-child(3) { width: 64%; }
.kb-insight {
  position: relative; margin: 6px 0 10px; padding: 10px 36px 10px 12px; border-radius: 10px;
  background: var(--kb-bg-raised); border: 1px solid var(--kb-border); font-size: .93em;
}
.kb-insight-title { display: block; margin-bottom: 3px; font-size: 11.5px; font-weight: 700; letter-spacing: .03em; color: var(--kb-accent); text-transform: uppercase; }
.kb-insight ul { margin: 0; padding-left: 18px; }
.kb-insight li { margin: 2px 0; }
.kb-insight .kb-icon-btn { position: absolute; top: 6px; right: 6px; }
.kb-meme {
  margin: 4px 0 10px; padding: 18px 16px; border-radius: 10px; text-align: center;
  background: linear-gradient(180deg, var(--kb-bg-raised), var(--kb-bg-sunken));
  border: 1px solid var(--kb-border);
}
.kb-meme-setup { margin: 0 0 10px; font-size: .86em; color: var(--kb-muted); }
.kb-meme-punch { margin: 0; font-size: 1.25em; font-weight: 700; line-height: 1.3; color: var(--kb-accent); }
.kb-error {
  display: flex; gap: 8px; align-items: flex-start; margin: 8px 0; padding: 9px 10px; border-radius: 8px;
  background: rgba(248, 113, 113, .08); border: 1px solid rgba(248, 113, 113, .3); font-size: 12.5px;
}
.kb-error.is-offline { background: rgba(155, 150, 138, .1); border-color: var(--kb-border); }
.kb-error-msg { flex: 1; }
.kb-link-btn { border: 0; background: transparent; padding: 0; color: var(--kb-accent); font-weight: 600; font-size: 12.5px; }
.kb-steppers { display: flex; align-items: center; gap: 6px; padding: 6px 0 10px; flex-wrap: wrap; }
.kb-step {
  display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: 999px;
  border: 1px solid var(--kb-border); background: transparent; font-size: 12px; font-weight: 600;
}
.kb-step:hover { background: var(--kb-bg-raised); }
.kb-step--accent { background: var(--kb-accent); color: var(--kb-accent-text); border-color: var(--kb-accent); }
.kb-spacer { flex: 1; }
.kb-thread { display: flex; flex-direction: column; gap: 8px; padding: 4px 0 8px; border-top: 1px solid var(--kb-border); }
.kb-thread:empty { display: none; }
.kb-q {
  align-self: flex-end; max-width: 85%; margin-top: 8px; padding: 6px 12px; border-radius: 14px 14px 4px 14px;
  background: var(--kb-accent); color: var(--kb-accent-text); font-weight: 600; font-size: .92em;
}
.kb-a ul { margin: 0; padding-left: 18px; }
.kb-a li { margin: 0 0 .45em; }
.kb-chip {
  align-self: flex-start; padding: 5px 10px; border-radius: 999px; border: 1px solid var(--kb-border);
  background: var(--kb-bg-raised); font-size: 12px; color: var(--kb-text);
}
.kb-chip:hover { border-color: var(--kb-accent); }
.kb-form { display: flex; gap: 6px; padding: 10px 12px 12px; border-top: 1px solid var(--kb-border); }
.kb-input {
  flex: 1; min-width: 0; padding: 8px 12px; border-radius: 999px; border: 1px solid var(--kb-border);
  background: var(--kb-bg-sunken); font-size: 13px; outline: none;
}
.kb-input:focus { border-color: var(--kb-accent); }
.kb-send {
  display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; border: 0;
  background: var(--kb-accent); color: var(--kb-accent-text);
}
.kb-send:disabled { opacity: .5; cursor: default; }
.kb-send svg { width: 15px; height: 15px; }
.kb-toast {
  position: fixed; z-index: 2147483647; left: 50%; bottom: 24px; transform: translateX(-50%);
  padding: 8px 14px; border-radius: 999px; background: var(--kb-bg); border: 1px solid var(--kb-border);
  box-shadow: var(--kb-shadow); font-size: 13px; animation: kb-pop .14s var(--kb-ease);
}

@keyframes kb-pop { from { opacity: 0; transform: translateY(4px) scale(.98); } to { opacity: 1; transform: none; } }
@keyframes kb-slide { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: none; } }
@keyframes kb-blink { 50% { opacity: 0; } }
@keyframes kb-pulse { 50% { opacity: .45; } }

@media (max-width: 520px) {
  .kb-panel { top: auto; bottom: 8px; right: 8px; left: 8px; width: auto; max-height: 70vh; }
  .kb-picker { width: min(300px, calc(100vw - 16px)); }
}
@media (prefers-reduced-motion: reduce) {
  .kb-pill, .kb-picker, .kb-panel, .kb-toast { animation: none; }
  .kb-text.is-streaming p:last-child::after, .kb-skeleton { animation: none; }
}
`;

  KB.applyStyles = function (root, fontSize) {
    const host = root.host || root;
    if (host && host.style) host.style.setProperty('--kb-font-size', `${KB.clampFontSize(fontSize)}px`);
    if (root.__kbStyled) return;
    root.__kbStyled = true;
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(KB.CSS);
      root.adoptedStyleSheets = [...(root.adoptedStyleSheets || []), sheet];
    } catch {
      const style = document.createElement('style');
      style.textContent = KB.CSS;
      root.appendChild(style);
    }
  };

  /** Register the bundled IBM Plex Sans with the document under a private family name. */
  KB.loadFonts = function () {
    if (KB.__fontsLoaded || typeof FontFace === 'undefined' || !document.fonts) return;
    KB.__fontsLoaded = true;
    for (const { file, weight } of KB.FONT_FILES) {
      try {
        const face = new FontFace(KB.FONT_FAMILY_NAME, `url("${chrome.runtime.getURL(file)}") format("woff2")`, {
          weight,
          style: 'normal',
          display: 'swap',
        });
        document.fonts.add(face);
        face.load().catch(() => {});
      } catch {
        // Page CSP may block extension font URLs; system font fallback applies.
      }
    }
  };
})((globalThis.KB = globalThis.KB || {}));
