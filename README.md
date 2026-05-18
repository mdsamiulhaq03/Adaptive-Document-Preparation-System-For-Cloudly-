# Adaptive Document Preparation System

An AI-powered MCQ study engine that ingests a multi-section PDF dossier, generates questions via an LLM, scores your answers, and **adapts every subsequent session to your weak areas**.

---

## Project Overview

The system implements a full adaptive prep flow:

1. User selects one or more document sections to study
2. System checks MongoDB for prior session history on those sections
3. Groq LLM generates N MCQs — on first run from raw text; on returning runs the prompt is enriched with historically wrong topics so questions focus on gaps
4. User answers questions; session is scored
5. Wrong answers are shown with the correct answer + explanation
6. Full session result is persisted to the knowledge base

The **adaptive intelligence** is the core differentiator: from the second session onwards, the system identifies which topic tags have accumulated wrong answers and injects them into the LLM system prompt — ensuring new questions target exactly where the user is weakest.

---

## Stack & Reasoning

| Layer | Choice | Why |
|---|---|---|
| Frontend + API | **Next.js 16** (App Router) | Single-repo full-stack — API Routes serve as the backend, React handles UI. No extra server process. |
| LLM | **Groq API** (`llama-3.3-70b-versatile`) | Free tier, ~200 tok/s, reliable structured JSON output. Falls back to a mock generator if no valid API key is present. |
| PDF Parsing | **`pdf-parse`** (Node.js) | Pure JS — no native compilation, handles machine-readable PDFs reliably. |
| Database | **MongoDB** (`mongodb` driver + `mongodb-memory-server`) | Native array/document storage (no JSON serialization for choices/tags), aggregation pipelines for weak-topic queries. Uses an embedded persistent server automatically — no external MongoDB installation required. |
| Styling | **Tailwind CSS** + **Framer Motion** | Utility-first with smooth animated transitions. |
| Testing | **Jest** + `ts-jest` | 33 tests covering DB, scoring, prompt structure, and all API routes. |
| Container | **Docker** + `docker-compose` | Full stack (app + MongoDB) runs with a single command. |

---

## Prerequisites

- **Node.js ≥ 22** (uses built-in features; v24 recommended)
- **npm ≥ 9**
- **Groq API key** — free at [console.groq.com](https://console.groq.com)
- **No external MongoDB needed** — the app auto-starts an embedded persistent MongoDB under `data/mongodb/`
- (Optional) Docker + docker-compose for containerized run

---

## Setup — Under 10 Minutes

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local and set:
#   GROQ_API_KEY=gsk_...
#   (all other values have working defaults)

# 3. Place the PDF
cp /path/to/SLATEFALL_DOSSIER.pdf data/
# If omitted, the system uses 10 synthetic demo sections.

# 4. Start the dev server
npm run dev
# → http://localhost:3000
```

The embedded MongoDB starts automatically on first request — no setup needed.

---

## Running Evaluation Scenarios

### Scenario A — Cold-start prep (UI)

```bash
npm run dev
# Open http://localhost:3000
# Select any two sections → Start Session → Answer questions → Submit
```

Or via API directly:

```bash
# 1. Start a session over sections 1 and 3
curl -X POST http://localhost:3000/api/prep/start \
  -H "Content-Type: application/json" \
  -d '{"sectionIds": ["1", "3"], "numQuestionsPerSection": 5}'

# 2. Submit answers (use sessionId + questionIds from the response above)
curl -X POST http://localhost:3000/api/prep/submit \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "<id>", "answers": [{"questionId": "<qid>", "userAnswer": "A"}]}'

# 3. View the KB snapshot
curl http://localhost:3000/api/snapshot
```

### Scenario B — Three adaptive iterations

The `outputs/` folder is **pre-populated** with real questions generated from `SLATEFALL_DOSSIER.pdf` using the Groq API. To regenerate from scratch:

```bash
# Requires GROQ_API_KEY in .env.local and SLATEFALL_DOSSIER.pdf in data/
npm run scenario:b
```

Output structure:
```
outputs/
  scenario_b_iter1/
    questions_iter1.json     ← 10 questions (§5 + §8), isAdaptive: false
    kb_snapshot_iter1.json   ← KB state after iter 1
  scenario_b_iter2/
    questions_iter2.json     ← 15 questions (§6 + §8 + §9), isAdaptive: true, weak topics injected
    kb_snapshot_iter2.json
  scenario_b_iter3/
    questions_iter3.json     ← 5 questions (§8 only), isAdaptive: true, weak_count grows
    kb_snapshot_iter3.json
```

**How to verify adaptive behavior:**
- `iter1/questions_iter1.json` → `"isAdaptive": false`, `"weakTopicsUsed": []`
- `iter2/questions_iter2.json` → `"isAdaptive": true`, `"weakTopicsUsed": [{"topic": "...", "wrongCount": N}]`
- `iter3/questions_iter3.json` → same topics, `wrongCount` higher than iter 2

---

## 3.4 API Layer

All endpoints are Next.js Route Handlers under `src/app/api/`. They accept and return `application/json`. There is no authentication layer — this is a single-user local tool.

**Base URL (local dev):** `http://localhost:3000`

---

### `GET /api/sections`
### `POST /api/sections`

Returns all sections parsed from the PDF. Both methods are equivalent — `POST` is supported for spec consistency.

**Response `200`**
```json
{
  "sections": [
    { "id": "1", "title": "Identity, Background, and Public Status", "textLength": 3241 },
    { "id": "2", "title": "Powers, Abilities, and Documented Limits", "textLength": 2987 }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Section identifier (`"1"`–`"10"`) |
| `title` | `string` | Section heading extracted from the PDF |
| `textLength` | `number` | Character count of raw section text |

**Errors**

| Status | Condition |
|---|---|
| `500` | PDF could not be parsed or read |

```bash
curl http://localhost:3000/api/sections
```

---

### `POST /api/prep/start`

Starts a new quiz session. Checks the knowledge base for weak topics and mastered questions from prior sessions on the same sections, then calls the LLM to generate adaptive MCQs. The session and all questions are persisted to MongoDB before the response is returned.

**Request body**
```json
{
  "sectionIds": ["5", "8"],
  "numQuestionsPerSection": 5
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `sectionIds` | `string[]` | Yes | — | One or more section IDs to generate questions for |
| `numQuestionsPerSection` | `number` | No | `5` | Questions to generate per section |

**Response `200`**
```json
{
  "sessionId": "a3f1c2d4-...",
  "isAdaptive": true,
  "weakTopicsFound": 3,
  "questions": [
    {
      "id": "664f1a2b3c4d5e6f7a8b9c0d",
      "sessionId": "a3f1c2d4-...",
      "sectionId": "5",
      "question": "What is the primary principle behind the Doctrine of Sequential Suspension?",
      "choices": ["A. Treat each activation as continuous", "B. Treat each activation as ammunition", "C. Activate in pairs", "D. Activate randomly"],
      "topicTags": ["Doctrine of Sequential Suspension", "Suspension Activation"]
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `sessionId` | `string` | UUID for this session — required for submit |
| `isAdaptive` | `boolean` | `true` if prior wrong answers were found and injected into the prompt |
| `weakTopicsFound` | `number` | Count of weak topic clusters used in the prompt |
| `questions[].id` | `string` | MongoDB ObjectId hex string — required when submitting answers |
| `questions[].choices` | `string[]` | Four options, pre-labeled `A.`–`D.` |
| `questions[].topicTags` | `string[]` | LLM-assigned topic tags used for future adaptive weighting |

> **Note:** `correct_ans` and `explanation` are intentionally omitted from this response — they are only returned after submission to prevent cheating.

**Errors**

| Status | Condition |
|---|---|
| `400` | `sectionIds` is missing, empty, or not an array |
| `404` | None of the provided `sectionIds` matched sections in the PDF |
| `500` | LLM generation failed after retries, or a database error occurred |

```bash
curl -X POST http://localhost:3000/api/prep/start \
  -H "Content-Type: application/json" \
  -d '{"sectionIds": ["5", "8"], "numQuestionsPerSection": 5}'
```

---

### `POST /api/prep/submit`

Scores a completed session. Each submitted answer is matched against the stored correct answer, persisted to MongoDB, and the session stats (`total_q`, `correct_q`, `score_pct`) are recomputed via aggregation. Re-submission of an already-scored session is rejected with `409`.

**Request body**
```json
{
  "sessionId": "a3f1c2d4-...",
  "answers": [
    { "questionId": "664f1a2b3c4d5e6f7a8b9c0d", "userAnswer": "B" }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `sessionId` | `string` | Yes | UUID returned by `/api/prep/start` |
| `answers` | `array` | Yes | One entry per question — partial submission is allowed |
| `answers[].questionId` | `string` | Yes | `id` from the start response |
| `answers[].userAnswer` | `string` | Yes | Single letter `A`–`D` |

**Response `200`**
```json
{
  "sessionId": "a3f1c2d4-...",
  "score": {
    "total": 10,
    "correct": 7,
    "wrong": 3,
    "scorePct": 70
  },
  "results": [
    {
      "questionId": "664f1a2b3c4d5e6f7a8b9c0d",
      "questionText": "What is the primary principle behind the Doctrine of Sequential Suspension?",
      "choices": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "userAnswer": "B",
      "correctAnswer": "B",
      "isCorrect": true,
      "explanation": null
    },
    {
      "questionId": "664f1a2b3c4d5e6f7a8b9c0e",
      "questionText": "...",
      "choices": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "userAnswer": "A",
      "correctAnswer": "C",
      "isCorrect": false,
      "explanation": "The correct answer is C because..."
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `score.scorePct` | `number` | Percentage score (`0`–`100`) |
| `results[].explanation` | `string \| null` | Populated only for wrong answers |

**Errors**

| Status | Condition |
|---|---|
| `400` | `sessionId` missing, or `answers` is empty or not an array |
| `404` | `sessionId` not found, or no questions found for session |
| `409` | Session was already submitted — re-submission blocked |
| `500` | Database or scoring error |

```bash
curl -X POST http://localhost:3000/api/prep/submit \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "a3f1c2d4-...",
    "answers": [
      {"questionId": "664f1a2b3c4d5e6f7a8b9c0d", "userAnswer": "B"},
      {"questionId": "664f1a2b3c4d5e6f7a8b9c0e", "userAnswer": "A"}
    ]
  }'
```

---

### `GET /api/history`

Returns a list of past sessions with their full question details, sorted newest-first.

**Query parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | `number` | `20` | Maximum number of sessions to return |

**Response `200`**
```json
{
  "sessions": [
    {
      "sessionId": "a3f1c2d4-...",
      "createdAt": "2026-05-18T13:00:00.000Z",
      "sections": ["5", "8"],
      "totalQuestions": 10,
      "correctAnswers": 7,
      "scorePct": 70,
      "questions": [
        {
          "id": "664f1a2b3c4d5e6f7a8b9c0d",
          "sectionId": "5",
          "questionText": "...",
          "choices": ["A. ...", "B. ...", "C. ...", "D. ..."],
          "correctAnswer": "B",
          "userAnswer": "B",
          "isCorrect": true,
          "explanation": null,
          "topicTags": ["Sequential Suspension", "Combat Doctrine"]
        }
      ]
    }
  ]
}
```

**Errors**

| Status | Condition |
|---|---|
| `500` | Database error |

```bash
curl "http://localhost:3000/api/history?limit=5"
```

---

### `DELETE /api/history/:sessionId`

Deletes a session and all its associated questions from MongoDB. This is irreversible.

**Path parameter**

| Parameter | Description |
|---|---|
| `sessionId` | UUID of the session to delete |

**Response `200`**
```json
{ "deleted": "a3f1c2d4-..." }
```

**Errors**

| Status | Condition |
|---|---|
| `404` | No session found with the given `sessionId` |
| `500` | Database error |

```bash
curl -X DELETE http://localhost:3000/api/history/a3f1c2d4-...
```

---

### `GET /api/snapshot`

Exports the top-N most recent sessions with all questions as a single JSON document. Useful for debugging, evaluation, and verifying adaptive behaviour across iterations.

**Query parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `n` | `number` | `5` | Number of recent sessions to include |

**Response `200`**
```json
{
  "exportedAt": "2026-05-18T14:00:00.000Z",
  "snapshot": [
    {
      "session": {
        "session_id": "a3f1c2d4-...",
        "created_at": "2026-05-18T13:00:00.000Z",
        "sections": ["5", "8"],
        "total_q": 10,
        "correct_q": 7,
        "score_pct": 70
      },
      "questions": [
        {
          "id": "664f1a2b3c4d5e6f7a8b9c0d",
          "session_id": "a3f1c2d4-...",
          "section_id": "5",
          "question_text": "...",
          "choices": ["A. ...", "B. ...", "C. ...", "D. ..."],
          "correct_ans": "B",
          "user_ans": "B",
          "is_correct": true,
          "explanation": "...",
          "topic_tags": ["Sequential Suspension"],
          "created_at": "2026-05-18T13:00:01.000Z"
        }
      ]
    }
  ]
}
```

> Unlike `/api/history`, this endpoint exposes `correct_ans` for all questions — it is intended for evaluation and debugging, not for the quiz UI.

**Errors**

| Status | Condition |
|---|---|
| `500` | Database error |

```bash
curl "http://localhost:3000/api/snapshot?n=3"
```

---

## LLM Integration

### Why Groq

Groq was chosen over OpenAI, Anthropic, and other providers for three concrete reasons:

1. **Speed** — Groq's LPU inference hardware delivers ~200 tokens/second, roughly 5–10× faster than GPU-backed providers at similar model sizes. For a quiz app that generates 5–15 MCQs per section synchronously in the request path, this keeps session start time under 3 seconds even for multi-section selections.
2. **Free tier with no credit card** — The free tier provides enough quota for development and evaluation without billing setup. This matters for a local tool where usage is bursty.
3. **Reliable structured JSON output** — `llama-3.3-70b-versatile` consistently returns well-formed JSON arrays when given a strict output format instruction. Providers with weaker instruction-following require more prompt engineering or function-calling overhead to enforce the MCQ schema.

### Model: `llama-3.3-70b-versatile`

This is the default model (`GROQ_MODEL` env var). It was chosen over the alternatives:

| Model | Why not |
|---|---|
| `llama-3.1-8b-instant` | Fast but instruction-following degrades on complex structured output — MCQ schema compliance drops, requiring more retries |
| `mixtral-8x7b-32768` | Larger context window but lower MCQ quality and slower on Groq hardware |
| `llama-3.3-70b-versatile` | Best balance of output quality, schema compliance, and speed on Groq |

For development iteration, `llama-3.1-8b-instant` is usable: set `GROQ_MODEL=llama-3.1-8b-instant` in `.env.local` for faster (but lower-quality) generation.

### Prompt Design

Two prompts are sent per section — a system prompt and a user prompt.

**System prompt** establishes the MCQ contract:
- Exactly 4 choices (A–D)
- Exactly one unambiguously correct answer
- Explanation of 2–3 sentences
- 1–3 topic tags
- Questions must test understanding, not recall

When adaptive context exists, two blocks are appended:
- **ADAPTIVE CONTEXT** — lists weak topics with wrong-count, instructs the model to focus on those areas from different angles
- **AVOID REPETITION** — lists up to 5 mastered question texts so the model avoids regenerating them

**User prompt** provides the section text (truncated to 3000 characters to stay within token budget) and instructs the model to return **only** a raw JSON array — no markdown fences, no commentary. This avoids the common LLM habit of wrapping JSON in ` ```json ``` ` blocks.

### Response Parsing & Resilience

The parser (`parseMCQResponse`) handles LLM non-compliance defensively:
- Strips markdown fences if the model ignores the "no fences" instruction
- Extracts the JSON array by locating the outermost `[` and `]` brackets
- Validates each MCQ object individually — malformed items are silently dropped; valid ones are kept
- The `correct_ans` field is normalized to a single uppercase letter (`A`–`D`) regardless of whether the model returns `"A"`, `"A."`, or `"A. Some text"`

**Retry policy**: up to 2 attempts with exponential backoff (1s, 2s). All attempts and failures are logged as structured JSON (`llm_retry`, `llm_failed`). Token usage is logged on every successful call (`llm_tokens`).

### Mock Generator

If `GROQ_API_KEY` is absent, set to `"your_groq_api_key_here"`, or set to `"mock"`, the system automatically uses the built-in mock generator (`generateMCQsMock`). It returns placeholder questions with the correct schema, allowing the full app flow — session creation, scoring, adaptive history — to be tested without an API key.

---

## Knowledge Base Schema (MongoDB)

### `sessions` collection

```json
{
  "_id": "ObjectId",
  "session_id": "uuid-string",
  "created_at": "2026-05-18T12:00:00.000Z",
  "sections": ["5", "8"],
  "total_q": 10,
  "correct_q": 4,
  "score_pct": 40.0
}
```

### `questions` collection

```json
{
  "_id": "ObjectId",
  "session_id": "uuid-string",
  "section_id": "8",
  "question_text": "What is the primary principle behind the Doctrine of Sequential Suspension?",
  "choices": ["A. Treat each activation as continuous", "B. Treat each activation as ammunition", "C. Activate in pairs", "D. Activate randomly"],
  "correct_ans": "B",
  "user_ans": "A",
  "is_correct": false,
  "explanation": "The doctrine treats each activation as finite ammunition...",
  "topic_tags": ["Doctrine of Sequential Suspension", "Suspension Activation"],
  "created_at": "2026-05-18T12:00:01.000Z"
}
```

**Indexes:** `{ session_id: 1 }`, `{ section_id: 1 }`, `{ is_correct: 1 }`, `{ created_at: -1 }`

**Adaptive query (aggregation pipeline):**
```js
db.questions.aggregate([
  { $match: { section_id: { $in: sectionIds }, is_correct: false } },
  { $group: {
      _id: { section_id: "$section_id", topic_tags: "$topic_tags" },
      wrong_count: { $sum: 1 },
      topic_tags: { $first: "$topic_tags" }
  }},
  { $sort: { wrong_count: -1 } },
  { $limit: 20 }
])
```

---

## Section Mapping — SLATEFALL_DOSSIER.pdf

The PDF contains 10 sections detected via `Section N.` headings:

| ID | Title |
|---|---|
| 1 | Identity, Background, and Public Status |
| 2 | Powers, Abilities, and Documented Limits |
| 3 | Origin and Key Historical Events |
| 4 | Equipment, Gear, and Specialized Technology |
| 5 | Operational Tactics and Combat Doctrine |
| 6 | Allies, Networks, and Known Affiliations |
| 7 | Adversaries and Documented Threats |
| 8 | Known Bases, Safehouses, and Operational Territory |
| 9 | Case Files: Documented Engagements and Incidents |
| 10 | Glossary, Codenames, and Reference Tables |

Section IDs `1`–`10` map directly to the spec's section numbering — no remapping needed.

---

## Running Tests

```bash
npm test
```

| Test file | Coverage |
|---|---|
| `tests/db.test.ts` | MongoDB CRUD, session stats, adaptive queries, snapshot export |
| `tests/scoring.test.ts` | Answer scoring, normalization, weak topic aggregation |
| `tests/groq_prompt.test.ts` | MCQ structure, field validation, adaptive topic injection |
| `tests/api.test.ts` | All 6 API endpoints end-to-end |

---

## Docker

```bash
# Full stack (app + MongoDB)
GROQ_API_KEY=gsk_... docker-compose up
# → http://localhost:3000
```

MongoDB data and the PDF are persisted in named Docker volumes across restarts.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | *(required for real questions)* | Groq API key (`gsk_...`). Without a valid key the system uses a mock LLM that returns placeholder questions. |
| `MONGODB_URI` | `mongodb://localhost:27017` | MongoDB URI. If unreachable, the app auto-starts an embedded persistent MongoDB under `data/mongodb/`. |
| `MONGODB_DB` | `adaptive_doc_prep` | Database name. |
| `PDF_PATH` | `./data/SLATEFALL_DOSSIER.pdf` | Path to the input PDF. Falls back to 10 synthetic demo sections if absent. |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Groq model ID. `llama-3.1-8b-instant` is faster for development. |
| `MCQ_PER_SECTION` | `5` | Default number of questions per section. |

---

## Logging

Structured JSON logs are emitted to stdout on every operation. Example session flow:

```json
{"ts":"2026-05-18T13:00:00Z","level":"info","msg":"kb_weak_topics_query","sections":["5","8"]}
{"ts":"2026-05-18T13:00:00Z","level":"info","msg":"kb_mastered_query","sections":["5","8"]}
{"ts":"2026-05-18T13:00:00Z","level":"info","msg":"kb_session_create","sessionId":"abc...","sections":["5","8"]}
{"ts":"2026-05-18T13:00:00Z","level":"info","msg":"session_start","sessionId":"abc...","isAdaptive":false,"weakTopics":0}
{"ts":"2026-05-18T13:00:02Z","level":"info","msg":"llm_tokens","sectionId":"5","model":"llama-3.3-70b-versatile","prompt_tokens":712,"completion_tokens":980,"total_tokens":1692,"attempt":1}
{"ts":"2026-05-18T13:00:02Z","level":"info","msg":"llm_success","sectionId":"5","count":5,"attempt":1}
{"ts":"2026-05-18T13:00:03Z","level":"info","msg":"mcq_generated","sessionId":"abc...","sectionId":"5","count":5}
{"ts":"2026-05-18T13:00:03Z","level":"info","msg":"session_ready","sessionId":"abc...","totalQuestions":10}
{"ts":"2026-05-18T13:00:45Z","level":"info","msg":"session_scored","sessionId":"abc...","total":10,"correct":4,"scorePct":40}
```

On LLM failure, the system retries up to 2 times with exponential backoff (1s, 2s), logging each attempt:
```json
{"ts":"...","level":"warn","msg":"llm_retry","sectionId":"5","attempt":1,"maxRetries":2,"error":"rate_limit_exceeded"}
{"ts":"...","level":"error","msg":"llm_failed","sectionId":"5","error":"rate_limit_exceeded"}
```

---

## Known Limitations

- **LLM non-determinism**: MCQ content varies between runs due to temperature. Structural correctness (4 choices, 1 answer, 1 explanation) is enforced; content is not.
- **Token budget**: Section text is truncated to 3000 characters per LLM call to stay within Groq free-tier limits. Tail content of very long sections may be omitted.
- **Embedded MongoDB startup**: The first request after a cold start takes ~2–3 seconds while `mongodb-memory-server` boots. Subsequent requests are fast.
- **No authentication**: Single-user local tool. No auth layer.
- **PDF layout assumptions**: The parser detects `Section N.` headings. PDFs with non-standard layouts fall back to word-count chunking.
- **Adaptive scope**: Adaptation is per-section. Cross-section topic drift is not modeled.
