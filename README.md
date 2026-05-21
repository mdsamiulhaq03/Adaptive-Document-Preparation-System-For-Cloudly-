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

## Database Schema

The app uses two MongoDB collections.

### `sessions`

| Field | Type | Description |
|---|---|---|
| `session_id` | `string` (UUID) | Primary key |
| `created_at` | `string` (ISO 8601) | Session creation timestamp |
| `sections` | `string[]` | Section IDs studied in this session |
| `total_q` | `number` | Total questions generated |
| `correct_q` | `number` | Number of correct answers |
| `score_pct` | `number` | Percentage correct |

### `questions`

| Field | Type | Description |
|---|---|---|
| `session_id` | `string` | References the parent session |
| `section_id` | `string` | Section this question came from |
| `question_text` | `string` | The question string |
| `choices` | `string[]` | Answer options, e.g. `["A. ...", "B. ...", "C. ...", "D. ..."]` |
| `correct_ans` | `string` | Correct answer letter (`A`/`B`/`C`/`D`) |
| `user_ans` | `string \| null` | User's submitted answer (`null` until submitted) |
| `is_correct` | `boolean \| null` | Whether the answer was correct (`null` until submitted) |
| `explanation` | `string` | LLM-generated clarification |
| `topic_tags` | `string[]` | Concept labels extracted by the LLM |
| `created_at` | `string` (ISO 8601) | Question creation timestamp |

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

-
