# Adaptive Document Preparation System

An AI-powered MCQ study engine that ingests a multi-section PDF dossier, generates questions via an LLM, scores your answers, and **adapts every subsequent session to your weak areas**.

---

## How It Works

1. Select one or more document sections to study
2. The system checks MongoDB for prior wrong answers on those sections
3. Groq LLM generates MCQs — on first run from raw text; on return visits the prompt is enriched with your historically weak topics
4. Answer questions, get scored, see explanations for wrong answers
5. Results are persisted — the next session targets your gaps automatically

---

## Stack

| Layer | Choice |
|---|---|
| Frontend + API | Next.js 16 (App Router) |
| LLM | Groq API (`llama-3.3-70b-versatile`) |
| PDF Parsing | `pdf-parse` |
| Database | MongoDB (`mongodb-memory-server` embedded, no install needed) |
| Styling | Tailwind CSS + Framer Motion |
| Testing | Jest + `ts-jest` |
| Container | Docker + docker-compose |

---

## Prerequisites

- Node.js ≥ 22
- npm ≥ 9
- Groq API key — free at [console.groq.com](https://console.groq.com)

No external MongoDB installation needed — the app auto-starts an embedded persistent instance under `data/mongodb/`.

---

## Setup

```bash
npm install

cp .env.example .env.local
# Set GROQ_API_KEY=gsk_... in .env.local

# Optional: place your PDF at data/SLATEFALL_DOSSIER.pdf
# Without it, the app uses 10 built-in demo sections.

npm run dev
# → http://localhost:3000
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/sections` | List all sections from the PDF |
| `POST` | `/api/prep/start` | Start a session — generates adaptive MCQs |
| `POST` | `/api/prep/submit` | Submit answers and get scored results |
| `GET` | `/api/history` | List past sessions with full question detail |
| `DELETE` | `/api/history/:sessionId` | Delete a session and its questions |
| `GET` | `/api/snapshot` | Export recent sessions as JSON (for evaluation) |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | *(required)* | Groq API key. Without one, a mock LLM is used. |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Model ID. Use `llama-3.1-8b-instant` for faster dev. |
| `MCQ_PER_SECTION` | `5` | Questions generated per section. |
| `MONGODB_URI` | `mongodb://localhost:27017` | Falls back to embedded MongoDB if unreachable. |
| `MONGODB_DB` | `adaptive_doc_prep` | Database name. |
| `PDF_PATH` | `./data/SLATEFALL_DOSSIER.pdf` | Path to input PDF. |

---

## Tests

```bash
npm test
```

Covers DB operations, answer scoring, prompt structure, and all API routes end-to-end.

---

## Docker

```bash
GROQ_API_KEY=gsk_... docker-compose up
# → http://localhost:3000
```

PDF and MongoDB data are persisted in named volumes across restarts.

---

## How I Built This

The goal was an adaptive study loop: generate MCQs from a PDF, track wrong answers by topic, and bias every subsequent session toward the user's weakest areas.

I split the work into four clear layers — PDF parsing, LLM generation, storage, and scoring — so each piece could be built and debugged independently.

**The trickiest parts:**

- **PDF parsing** — raw PDF text is messy. The extractor looks for `Section N` / `Chapter N` headings and falls back to ~800-word chunks if none are found, so it works on any PDF. A built-in demo mode means the app runs without a real PDF at all.
- **Reliable LLM output** — Groq sometimes wraps JSON in markdown fences or adds commentary. `parseMCQResponse()` strips fences, locates the JSON array by bracket position, and validates each MCQ individually so a single bad item doesn't kill the whole response. Exponential backoff (1s, 2s) handles transient API failures.
- **The adaptive loop** — `getWeakTopics()` runs a MongoDB aggregation over past wrong answers, ranked by `topic_tags` frequency. Those topics get injected into the LLM system prompt so new questions target exactly where the user keeps failing. Mastered questions are tracked separately and the LLM is told to avoid repeating them.
- **Embedded MongoDB + HMR** — to avoid forcing users to install MongoDB, the app auto-starts `mongodb-memory-server`. Next.js hot-reload kept creating new `MongoClient` instances and hitting a `DBPathInUse` lock. Fixed by caching the client on `globalThis` and cleaning up stale lock files on startup.

**What didn't work:** vague prompt wording ("deep understanding") produced recall questions — explicit instructions fixed it. SQLite was the first DB choice; MongoDB's native arrays and aggregation pipelines fit the MCQ schema much better.

**Takeaway:** the hard part wasn't the AI — it was the plumbing. I'd enforce JSON mode via the API from day one rather than writing defensive parsing after the fact.
