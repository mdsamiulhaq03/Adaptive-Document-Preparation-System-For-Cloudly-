import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB = 'test_adaptive_doc_prep';
});

afterAll(async () => {
  const { closeDb } = await import('../src/lib/db');
  await closeDb();
  await mongod.stop();
});

// Re-import db after env is set
async function getLib() {
  return import('../src/lib/db');
}

describe('DB — session operations', () => {
  const sid = 'test-session-001';

  it('creates a session', async () => {
    const { createSession, getSession } = await getLib();
    await createSession(sid, ['1', '2']);
    const s = await getSession(sid);
    expect(s).toBeDefined();
    expect(s!.session_id).toBe(sid);
    expect(s!.sections).toEqual(['1', '2']);
  });

  it('lists sessions', async () => {
    const { listSessions } = await getLib();
    const sessions = await listSessions();
    expect(sessions.some((s) => s.session_id === sid)).toBe(true);
  });
});

describe('DB — question CRUD', () => {
  const sid = 'test-session-002';

  beforeAll(async () => {
    const { createSession } = await getLib();
    await createSession(sid, ['3']);
  });

  it('inserts a question and returns a string ID', async () => {
    const { insertQuestion } = await getLib();
    const id = await insertQuestion({
      session_id: sid,
      section_id: '3',
      question_text: 'What is 2+2?',
      choices: ['A. 3', 'B. 4', 'C. 5', 'D. 6'],
      correct_ans: 'B',
      explanation: 'Basic arithmetic.',
      topic_tags: ['arithmetic'],
    });
    expect(typeof id).toBe('string');
    expect(id.length).toBe(24); // MongoDB ObjectId hex length
  });

  it('retrieves questions for a session', async () => {
    const { getSessionQuestions } = await getLib();
    const qs = await getSessionQuestions(sid);
    expect(qs.length).toBeGreaterThan(0);
    expect(qs[0].question_text).toBe('What is 2+2?');
    expect(Array.isArray(qs[0].choices)).toBe(true);
    expect(qs[0].choices).toHaveLength(4);
  });

  it('records a user answer', async () => {
    const { getSessionQuestions, updateQuestionAnswer } = await getLib();
    const qs = await getSessionQuestions(sid);
    await updateQuestionAnswer(qs[0].id, 'B', true);
    const updated = await getSessionQuestions(sid);
    expect(updated[0].user_ans).toBe('B');
    expect(updated[0].is_correct).toBe(true);
  });

  it('updates session stats correctly', async () => {
    const { updateSessionStats, getSession } = await getLib();
    await updateSessionStats(sid);
    const s = await getSession(sid);
    expect(s!.total_q).toBe(1);
    expect(s!.correct_q).toBe(1);
    expect(s!.score_pct).toBe(100);
  });
});

describe('DB — adaptive helpers', () => {
  const sid = 'test-session-003';

  beforeAll(async () => {
    const { createSession, insertQuestion, updateQuestionAnswer } = await getLib();
    await createSession(sid, ['5']);
    const id = await insertQuestion({
      session_id: sid,
      section_id: '5',
      question_text: 'Weak question about encryption?',
      choices: ['A. AES', 'B. RSA', 'C. SHA', 'D. MD5'],
      correct_ans: 'A',
      explanation: 'AES is symmetric encryption.',
      topic_tags: ['encryption', 'symmetric'],
    });
    await updateQuestionAnswer(id, 'B', false); // wrong answer
  });

  it('returns weak topics for answered-wrong questions', async () => {
    const { getWeakTopics } = await getLib();
    const weak = await getWeakTopics(['5']);
    expect(weak.length).toBeGreaterThan(0);
    expect(weak[0].wrong_count).toBeGreaterThanOrEqual(1);
  });

  it('returns mastered questions for correct answers', async () => {
    const { createSession, insertQuestion, updateQuestionAnswer, getMasteredQuestions } = await getLib();
    const sid2 = 'test-session-004';
    await createSession(sid2, ['5']);
    const id = await insertQuestion({
      session_id: sid2,
      section_id: '5',
      question_text: 'Mastered question about hashing?',
      choices: ['A. SHA-256', 'B. AES-256', 'C. RSA-2048', 'D. ECDSA'],
      correct_ans: 'A',
      explanation: 'SHA-256 is a hash function.',
      topic_tags: ['hashing'],
    });
    await updateQuestionAnswer(id, 'A', true);

    const mastered = await getMasteredQuestions(['5']);
    expect(mastered).toContain('Mastered question about hashing?');
  });
});

describe('DB — snapshot export', () => {
  it('exports up to N sessions with correct shape', async () => {
    const { exportSnapshot } = await getLib();
    const snap = await exportSnapshot(3);
    expect(Array.isArray(snap)).toBe(true);
    expect(snap.length).toBeLessThanOrEqual(3);
    if (snap.length > 0) {
      expect(snap[0]).toHaveProperty('session');
      expect(snap[0]).toHaveProperty('questions');
      expect(Array.isArray(snap[0].session.sections)).toBe(true);
    }
  });
});
