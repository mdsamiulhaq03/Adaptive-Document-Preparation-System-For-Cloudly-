import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB = 'test_api';
  process.env.GROQ_API_KEY = 'mock';
});

afterAll(async () => {
  const { closeDb } = await import('../src/lib/db');
  await closeDb();
  await mongod.stop();
});

function makeReq(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/sections', () => {
  it('returns a sections array', async () => {
    const { GET } = await import('../src/app/api/sections/route');
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.sections)).toBe(true);
    expect(data.sections.length).toBeGreaterThan(0);
    expect(data.sections[0]).toHaveProperty('id');
    expect(data.sections[0]).toHaveProperty('title');
  });
});

describe('POST /api/prep/start', () => {
  let sessionId: string;
  let questionIds: string[];

  it('creates a session and returns questions with string IDs', async () => {
    const { POST } = await import('../src/app/api/prep/start/route');
    const req = makeReq('POST', 'http://localhost/api/prep/start', {
      sectionIds: ['1'],
      numQuestionsPerSection: 3,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.sessionId).toBe('string');
    expect(Array.isArray(data.questions)).toBe(true);
    expect(data.questions.length).toBe(3);
    expect(typeof data.isAdaptive).toBe('boolean');
    // MongoDB ObjectId hex strings are 24 chars
    expect(data.questions[0].id).toHaveLength(24);
    sessionId = data.sessionId;
    questionIds = data.questions.map((q: { id: string }) => q.id);
  });

  it('returns 400 for empty sectionIds', async () => {
    const { POST } = await import('../src/app/api/prep/start/route');
    const req = makeReq('POST', 'http://localhost/api/prep/start', { sectionIds: [] });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/prep/submit', () => {
  let sessionId: string;
  let questionIds: string[];

  beforeAll(async () => {
    const { POST: startPost } = await import('../src/app/api/prep/start/route');
    const req = makeReq('POST', 'http://localhost/api/prep/start', {
      sectionIds: ['2'],
      numQuestionsPerSection: 2,
    });
    const res = await startPost(req as any);
    const data = await res.json();
    sessionId = data.sessionId;
    questionIds = data.questions.map((q: { id: string }) => q.id);
  });

  it('scores answers and returns results', async () => {
    const { POST } = await import('../src/app/api/prep/submit/route');
    const answers = questionIds.map((id) => ({ questionId: id, userAnswer: 'A' }));
    const req = makeReq('POST', 'http://localhost/api/prep/submit', { sessionId, answers });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('score');
    expect(data.score.total).toBe(questionIds.length);
    expect(Array.isArray(data.results)).toBe(true);
  });

  it('returns 404 for unknown sessionId', async () => {
    const { POST } = await import('../src/app/api/prep/submit/route');
    const req = makeReq('POST', 'http://localhost/api/prep/submit', {
      sessionId: 'does-not-exist',
      answers: [{ questionId: 'fakeid', userAnswer: 'A' }],
    });
    const res = await POST(req as any);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/history', () => {
  it('returns sessions array', async () => {
    const { GET } = await import('../src/app/api/history/route');
    const req = makeReq('GET', 'http://localhost/api/history?limit=5');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.sessions)).toBe(true);
  });
});

describe('GET /api/snapshot', () => {
  it('returns snapshot with exportedAt', async () => {
    const { GET } = await import('../src/app/api/snapshot/route');
    const req = makeReq('GET', 'http://localhost/api/snapshot?n=3');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.snapshot)).toBe(true);
    expect(typeof data.exportedAt).toBe('string');
  });
});
