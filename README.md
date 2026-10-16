# KnowBear

KnowBear is an explanation engine that makes complex concepts easier to understand across different cognitive depths.

> Made as a fun experimental project assisted by AI to explore how I learn—taking dense, intimidating technical jargon and simplifying it into intuitive, memorable concepts.

It is available in three distinct interfaces:

---

## 1. AI Agent Skill (`skills/knowbear`)

A workspace-aware reasoning tool for Claude Code, Antigravity, and other agent harnesses. It climbs the **Ladder of Abstraction** and grounds explanations directly in your repository:

- **Rung 1 (ELI5):** Sensory, physical analogies with zero jargon.
- **Rung 2 (Mental Model):** Problem statement, input/output contracts, and boundaries.
- **Rung 3 (Architecture):** Component topologies and clean Mermaid flowcharts.
- **Rung 4 (Code Grounding):** Real workspace code citations (`file://`), line ranges, algorithmic complexity, and failure modes.
- **Punchline:** A sharp one-liner meme distillation.

```bash
/knowbear <topic or file>    # Full 4-rung progressive ladder
/knowbear eli5 <topic>       # Rung 1 only (sensory analogy)
/knowbear model <topic>      # Rung 2 only (functional model)
/knowbear arch <topic>       # Rung 3 only (flow + diagram)
/knowbear deep <topic>       # Rung 4 only (code inspection)
/knowbear meme <topic>       # Punchline one-liner
```

---

## 2. Full-Stack Web App

A fast, distraction-free reading interface for conceptual explanations across 4 audience levels:

- **ELI5:** Simple sensory analogies for a 5-year-old.
- **ELI12:** Middle-school level concepts with relatable everyday examples.
- **ELI15:** High-school depth connecting broader ideas.
- **Meme:** Humorous, punchy one-liner summaries.

### Key Features

- **Multi-Level Explanations:** Seamlessly switch between ELI5, ELI12, ELI15, and Meme cognitive depths with expressive mascot avatar reactions.
- **Shareable Meme Cards:** Generate mascot-themed punchline cards with one-click **Copy Image**, **Download Image**, or native mobile **Share** directly to chat apps.
- **Flexible Inputs:** Query topics, paste multiline reading passages up to 2,000 characters (`Shift+Enter`), or paste screenshots (`Ctrl+V`) for visual explanations.
- **Curated Starter Topics:** Streamlined popular topics for instant answers to everyday science, biology, and economics concepts.

### Quickstart

```bash
make          # or: make start / npm run local:start
```

Starts the React frontend at `http://localhost:5173` and FastAPI backend at `http://localhost:8000` (requires `GROQ_API_KEY` for text and optional `OPENROUTER_API_KEY` for vision in `.env`). Use `make stop` to stop both servers, or `make check` to run lint, type-check, and tests.

Or via Docker:

```bash
docker compose up --build
```

---

## 3. Browser Extension (`extension/`)

A zero-build Manifest V3 Chrome/Brave extension that explains highlighted passages or screenshots in place without leaving your tab:

- **Selection Pill & Side Panel:** Highlight text on any page to open the floating KnowBear pill, pick a depth (`ELI5`, `ELI12`, `ELI15`, `Meme`), stream context-grounded explanations, step simpler/deeper, and ask multi-turn follow-up questions (`POST /api/followup`).
- **Native PDF & Shortcut Support:** Explain selections in Chrome's PDF viewer via right-click (**Explain selection with KnowBear**), `Alt+K` (selection or clipboard fallback), or the floating PDF launcher pill.
- **Toolbar Popup:** Explain pasted passages or screenshots (paste `Ctrl+V`, upload, or capture visible tab).

### Load Unpacked

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select the `extension/` directory.
3. *(Optional)* Enable **Allow access to file URLs** on the KnowBear card to use it on local `file://` PDFs, or change the Backend URL in **Settings** (`https://knowbear.sanjeevkumar.me` by default, or `http://localhost:8000` for local dev).

---

## License

Do whatever you want with it. Fork it, remix it, break it, or build something fun.
