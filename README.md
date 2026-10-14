# KnowBear

KnowBear is a personal full-stack AI explanation workspace focused on clean architecture, resilient streaming UX, and reliable runtime behavior.

## Project Highlights

This project is intentionally built with production-style concerns:

- Frontend with strong state/data boundaries (`zustand` + `zod`)
- Backend with FastAPI, structured logging, middleware, and consistent error contracts
- Streaming generation pipeline with fallback behavior
- Redis-backed caching and token rate limiting with in-memory fallback
- Dockerized local setup and one-command local startup

## Tech Stack

- Frontend: React, Vite, TypeScript, Tailwind, Zustand, Zod
- Backend: FastAPI, Pydantic, Uvicorn
- AI layer: Groq + Gemini via provider abstraction
- Web search & Retrieval: Tavily / Serper / Exa integration hooks
- Caching & limits: Upstash Redis (optional), in-memory fallback

## Architecture

```text
                        +---------------------------+
                        |       React Frontend      |
                        |  - Search + mode UI       |
User Browser            |  - Zustand global store   |
-------------           |  - Zod runtime parsing    |
     |                  +-------------+-------------+
     |  HTTP + SSE                    |
     v                                v
+----+--------------------------------+----+
|            FastAPI Backend               |
|  /api/query      /api/query/stream       |
|  /api/pinned     /api/health             |
|  /api/keep-alive                          |
|                                           |
|  Middleware: CORS, security headers,      |
|  request-id logging, exception handlers   |
+----+-------------------------+------------+
     |                         |
     |                         |
     v                         v
+----+----------------+   +---+----------------------+
| Inference Services  |   | Cache / Rate Limiting    |
| - provider routing  |   | - Upstash Redis (opt)    |
| - stream generation |   | - in-memory fallback     |
| - model fallback    |   +--------------------------+
+----+----------------+
     |
     v
+----+----------------+      +------------------------+
| LLM Providers       |      | Retrieval Providers    |
| Groq / Gemini       |      | Tavily / Serper / Exa  |
+---------------------+      +------------------------+
```

## API Surface

- `GET /api/pinned` - curated starter topics
- `POST /api/query` - generate one or more explanation levels
- `POST /api/query/stream` - stream explanations over SSE
- `GET /api/health` - service health metadata
- `GET /api/keep-alive` - lightweight warmup probe (includes Upstash ping/get if configured)

## Agent Skill (`skills/knowbear`)

KnowBear is also packaged as a native AI Agent Skill (for Claude Code, Antigravity, and other skill-compatible agent runtimes). It implements a multi-depth cognitive explanation engine following the **Ladder of Abstraction**:

- **Rung 1 (ELI5 & Sensory Analogy):** Physical world intuition, zero technical jargon, sensory anchors.
- **Rung 2 (Functional Mental Model):** Explicit problem statement, input/output contract, and operational boundaries.
- **Rung 3 (Systems Architecture):** Component topologies, state transitions, lifecycle sequences, and crisp Mermaid diagrams.
- **Rung 4 (Concrete Code Grounding):** Citing real workspace source files (`file://`), line ranges, complexity, AST/types, and failure modes.
- **Punchline (Meme / One-Liner):** Sharp distillation capturing the pragmatic truth of the concept.

### Triggers & Slash Commands
- `/knowbear <topic or file>` — Full 4-rung progressive explanation ladder.
- `/knowbear eli5 <topic>` — Rung 1 only.
- `/knowbear model <topic>` — Rung 2 only.
- `/knowbear arch <topic>` — Rung 3 only (flow + diagram).
- `/knowbear deep <topic>` — Rung 4 only (code inspection).
- `/knowbear meme <topic>` — Punchline one-liner.

## Local Development

### Prerequisites

- Node.js 20+
- Python 3.10+

### One Command (recommended)

```bash
npm run local:start
```

What it does:
1. Installs frontend dependencies (`npm install`)
2. Installs backend dependencies (`python -m pip install -r api/requirements.txt`)
3. Starts frontend on `http://localhost:5173`
4. Starts backend on `http://localhost:8000`

## Docker

```bash
docker compose up --build
```

Services/ports:
- Frontend: `5173`
- Backend: `8000`

## Environment Variables

Create a `.env` file (or set environment variables directly).

Commonly used:

- `VITE_API_URL` (example: `http://localhost:8000`)
- `GROQ_API_KEY`
- `GEMINI_API_KEY` (optional fallback/judge path)
- `TAVILY_API_KEY` / `SERPER_API_KEY` / `EXA_API_KEY` (optional retrieval providers)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (optional distributed cache/limits)

## Engineering Highlights

- Runtime validation with Zod at frontend API boundaries to prevent invalid payload propagation.
- Centralized Zustand store with persisted user preferences and non-persisted transient runtime state.
- Streaming resilience with fallback to non-stream response path when SSE conditions are degraded.
- Regenerate path bypasses cache and forwards temperature, enabling controlled response variation.

## Validation Commands

```bash
npm run type-check
npm run test -- --run
python -m compileall -q api
```

## Repository Structure

```text
src/                 # React frontend
api/                 # FastAPI backend
Dockerfile
docker-compose.yml
```

## Note

KnowBear is a personal project that evolved into a focused, depth-first explanation system with practical reliability features across frontend and backend.

## Development Journey

KnowBear began as a lean web application built around single query-response interactions: fast, stateless, and minimal by design. That core philosophy remains intact.

It later expanded into a more ambitious chat platform with three dedicated workspace modes, built for multi-turn conversations and collaborative workflows. The experiment was valuable, but it also made the product heavier and less focused than intended.

The project was then reoriented toward a clearer objective: a depth-first, explanation-driven system powered by RAG (Retrieval-Augmented Generation). That iteration remains a work in progress.

The current version reflects the lessons from each phase. It is a streamlined, production-ready API focused on delivering deeper answers with relevant live retrieval context, while preserving the speed, simplicity, and low-latency experience that made the original concept effective.

