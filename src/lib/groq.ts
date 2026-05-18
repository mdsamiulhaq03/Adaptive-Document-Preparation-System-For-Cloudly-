import Groq from 'groq-sdk';
import { logger } from './logger';

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const MCQ_PER_SECTION = parseInt(process.env.MCQ_PER_SECTION || '5', 10);
const MAX_RETRIES = 2;

let _client: Groq | null = null;

function getClient(): Groq {
  if (_client) return _client;
  const key = process.env.GROQ_API_KEY;
  if (!key || key === 'your_groq_api_key_here') {
    throw new Error('GROQ_API_KEY is not configured. Set it in .env.local');
  }
  _client = new Groq({ apiKey: key });
  return _client;
}

export interface GeneratedMCQ {
  question: string;
  choices: string[];
  correct_ans: string;
  explanation: string;
  topic_tags: string[];
}

export interface GenerationContext {
  sectionId: string;
  sectionTitle: string;
  sectionText: string;
  numQuestions?: number;
  weakTopics?: WeakTopicSummary[];
  masteredQuestions?: string[];
}

export interface WeakTopicSummary {
  topic: string;
  wrongCount: number;
}

export async function generateMCQs(ctx: GenerationContext): Promise<GeneratedMCQ[]> {
  const client = getClient();
  const n = ctx.numQuestions ?? MCQ_PER_SECTION;
  const systemPrompt = buildSystemPrompt(ctx);
  const userPrompt = buildUserPrompt(ctx, n);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      });

      // Log token usage
      const usage = response.usage;
      if (usage) {
        logger.info('llm_tokens', {
          sectionId: ctx.sectionId,
          model: GROQ_MODEL,
          prompt_tokens: usage.prompt_tokens,
          completion_tokens: usage.completion_tokens,
          total_tokens: usage.total_tokens,
          attempt,
        });
      }

      const raw = response.choices[0]?.message?.content ?? '';
      const mcqs = parseMCQResponse(raw, n);
      logger.info('llm_success', { sectionId: ctx.sectionId, count: mcqs.length, attempt });
      return mcqs;

    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn('llm_retry', {
        sectionId: ctx.sectionId,
        attempt,
        maxRetries: MAX_RETRIES,
        error: lastError.message,
      });

      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 1s, 2s
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }
  }

  logger.error('llm_failed', { sectionId: ctx.sectionId, error: lastError?.message });
  throw lastError ?? new Error('LLM generation failed after retries');
}

function buildSystemPrompt(ctx: GenerationContext): string {
  let base = `You are an expert educator and assessment designer specializing in creating high-quality
multiple-choice questions (MCQs). Your questions must:
- Test genuine understanding, not mere recall
- Have exactly four answer choices labeled A, B, C, D
- Have exactly one unambiguously correct answer
- Include a concise but informative explanation (2-3 sentences)
- Include relevant topic tags (1-3 short phrases)
- Be directly grounded in the provided section text`;

  if (ctx.weakTopics && ctx.weakTopics.length > 0) {
    const topicList = ctx.weakTopics
      .map((t) => `"${t.topic}" (missed ${t.wrongCount}x)`)
      .join(', ');
    base += `\n\nADAPTIVE CONTEXT — The student has previously struggled with: ${topicList}.
Focus new questions specifically on these weak areas. Make questions that reinforce understanding
of these concepts from different angles. Do NOT simply repeat previous question wording.`;
  }

  if (ctx.masteredQuestions && ctx.masteredQuestions.length > 0) {
    const examples = ctx.masteredQuestions.slice(0, 5).join('; ');
    base += `\n\nAVOID REPETITION — The student has already mastered questions similar to: ${examples}.
Generate genuinely different questions that probe deeper or adjacent concepts.`;
  }

  return base;
}

function buildUserPrompt(ctx: GenerationContext, n: number): string {
  const text = ctx.sectionText.slice(0, 3000);
  return `Generate exactly ${n} MCQs for Section ${ctx.sectionId}: "${ctx.sectionTitle}".

SECTION TEXT:
${text}

OUTPUT FORMAT — Return ONLY valid JSON, no markdown fences, no commentary:
[
  {
    "question": "Question text here?",
    "choices": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "correct_ans": "A",
    "explanation": "Brief explanation of why A is correct and others are wrong.",
    "topic_tags": ["topic1", "topic2"]
  }
]`;
}

function parseMCQResponse(raw: string, expected: number): GeneratedMCQ[] {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');

  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) {
    throw new Error(`No JSON array found in LLM response. Raw:\n${raw.slice(0, 500)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new Error(`Invalid JSON from LLM. Raw:\n${raw.slice(0, 500)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('LLM response is not a JSON array');
  }

  const valid: GeneratedMCQ[] = [];
  for (const item of parsed) {
    if (isValidMCQ(item)) {
      const ans = (item.correct_ans as string).trim().toUpperCase().replace(/^([A-D]).*/, '$1');
      valid.push({
        question: item.question as string,
        choices: item.choices as string[],
        correct_ans: ans,
        explanation: item.explanation as string,
        topic_tags: (item.topic_tags as string[]) ?? [],
      });
    }
  }

  if (valid.length === 0) {
    throw new Error(`Parsed 0 valid MCQs from LLM response. Raw:\n${raw.slice(0, 500)}`);
  }

  return valid.slice(0, expected);
}

function isValidMCQ(item: unknown): boolean {
  if (typeof item !== 'object' || item === null) return false;
  const q = item as Record<string, unknown>;
  return (
    typeof q.question === 'string' &&
    Array.isArray(q.choices) &&
    (q.choices as unknown[]).length >= 2 &&
    typeof q.correct_ans === 'string' &&
    typeof q.explanation === 'string'
  );
}

// ── Mock generator ────────────────────────────────────────────────────────────

export async function generateMCQsMock(ctx: GenerationContext): Promise<GeneratedMCQ[]> {
  const n = ctx.numQuestions ?? MCQ_PER_SECTION;
  const weakSuffix = ctx.weakTopics?.length
    ? ` (focus: ${ctx.weakTopics.map((t) => t.topic).join(', ')})`
    : '';

  return Array.from({ length: n }, (_, i) => ({
    question: `[MOCK] Question ${i + 1} about Section ${ctx.sectionId}${weakSuffix}. What is the primary concept?`,
    choices: [
      `A. Correct answer about ${ctx.sectionTitle}`,
      `B. Distractor option 1`,
      `C. Distractor option 2`,
      `D. Distractor option 3`,
    ],
    correct_ans: 'A',
    explanation: `The correct answer is A because it directly relates to the key concept in Section ${ctx.sectionId}: ${ctx.sectionTitle}.`,
    topic_tags: [ctx.sectionTitle.toLowerCase().split(' ').slice(0, 2).join('-'), 'fundamentals'],
  }));
}

export function useMockGenerator(): boolean {
  const key = process.env.GROQ_API_KEY;
  return !key || key === 'your_groq_api_key_here' || key === 'mock' || !key.startsWith('gsk_');
}
