# KnowBear

KnowBear is a multi-depth explanation engine that breaks down complex software, systems, and concepts across the **Ladder of Abstraction**—from plain physical analogies to concrete code implementations.

It is available both as a full-stack web application and as a native AI agent skill.

---

## What It Does

KnowBear explains any topic, codebase, or technical problem across 4 progressive cognitive depths:

1. **ELI5 & Sensory Analogy:** Physical intuition, sensory metaphors, zero jargon.
2. **Functional Mental Model:** The problem statement, core inputs/outputs, and boundaries.
3. **Systems Architecture:** Component flow, lifecycles, and visual Mermaid diagrams.
4. **Concrete Implementation:** Real code grounding, line references, algorithmic complexity, and failure modes.
5. **Punchline:** A sharp one-liner meme distillation.

---

## Interfaces

### 1. AI Agent Skill (`skills/knowbear`)

Use directly inside Claude Code, Antigravity, or other agent harnesses:

```bash
/knowbear <topic or file>    # Full 4-rung ladder
/knowbear eli5 <topic>       # Rung 1 only (sensory analogy)
/knowbear model <topic>      # Rung 2 only (functional model)
/knowbear arch <topic>       # Rung 3 only (system flow + diagram)
/knowbear deep <topic>       # Rung 4 only (code inspection)
/knowbear meme <topic>       # Punchline one-liner
```

### 2. Full-Stack Web App

- **Frontend:** React, Vite, TypeScript, Tailwind, Zustand
- **Backend:** FastAPI, Groq (`openai/gpt-oss-20b`), streaming SSE, Upstash Redis

#### Quickstart

```bash
npm run local:start
```

Starts the frontend at `http://localhost:5173` and backend at `http://localhost:8000`.

Or with Docker:

```bash
docker compose up --build
```
