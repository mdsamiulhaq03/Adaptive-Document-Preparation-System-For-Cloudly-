import { MongoClient, ObjectId, Db, Collection } from 'mongodb';
import path from 'path';
import fs from 'fs';
import { logger } from './logger';

// Use globalThis so the connection survives Next.js hot-module reloads.
// Without this, each HMR cycle creates a new MongoClient and a new embedded
// server, causing the "DBPathInUse" lock-file error.
declare global {
  // eslint-disable-next-line no-var
  var __mongoClient: MongoClient | undefined;
  // eslint-disable-next-line no-var
  var __mongoDb: Db | undefined;
  // eslint-disable-next-line no-var
  var __mongoUri: string | undefined;
}

export async function getDb(): Promise<Db> {
  if (globalThis.__mongoDb) return globalThis.__mongoDb;

  const uri = await resolveMongoUri();
  const dbName = process.env.MONGODB_DB ?? 'adaptive_doc_prep';

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  await initCollections(db);

  globalThis.__mongoClient = client;
  globalThis.__mongoDb = db;
  return db;
}

export async function closeDb(): Promise<void> {
  if (globalThis.__mongoClient) {
    await globalThis.__mongoClient.close();
    globalThis.__mongoClient = undefined;
    globalThis.__mongoDb = undefined;
    globalThis.__mongoUri = undefined;
  }
}

async function resolveMongoUri(): Promise<string> {
  // Return cached URI so embedded server is only started once per process
  if (globalThis.__mongoUri) return globalThis.__mongoUri;

  const configured = process.env.MONGODB_URI;
  const useConfigured =
    configured &&
    configured !== 'mongodb://localhost:27017' &&
    configured !== 'your_mongodb_uri_here';

  if (useConfigured) {
    console.log(`[DB] Connecting to: ${configured!.replace(/:\/\/.*@/, '://<credentials>@')}`);
    globalThis.__mongoUri = configured!;
    return configured!;
  }

  // Embedded persistent MongoDB
  const dbPath = path.resolve('./data/mongodb');
  fs.mkdirSync(dbPath, { recursive: true });

  // Remove stale lock file left by a previously crashed process
  const lockFile = path.join(dbPath, 'mongod.lock');
  if (fs.existsSync(lockFile)) {
    try {
      fs.unlinkSync(lockFile);
      console.log('[DB] Removed stale mongod.lock');
    } catch {/* already gone */}
  }

  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const server = await MongoMemoryServer.create({
    instance: { dbPath, storageEngine: 'wiredTiger' },
  });

  const uri = server.getUri();
  console.log(`[DB] Embedded MongoDB started (data/mongodb/). URI: ${uri}`);
  globalThis.__mongoUri = uri;
  return uri;
}

async function initCollections(db: Db): Promise<void> {
  const sessions = db.collection('sessions');
  const questions = db.collection('questions');

  await sessions.createIndex({ created_at: -1 });
  await questions.createIndex({ session_id: 1 });
  await questions.createIndex({ section_id: 1 });
  await questions.createIndex({ is_correct: 1 });
}

function sessions(db: Db): Collection<SessionDoc> {
  return db.collection<SessionDoc>('sessions');
}
function questions(db: Db): Collection<QuestionDoc> {
  return db.collection<QuestionDoc>('questions');
}

// ── Session helpers ──────────────────────────────────────────────────────────

export async function createSession(sessionId: string, sectionIds: string[]): Promise<void> {
  const db = await getDb();
  logger.info('kb_session_create', { sessionId, sections: sectionIds });
  await sessions(db).insertOne({
    session_id: sessionId,
    created_at: new Date().toISOString(),
    sections: sectionIds,
    total_q: 0,
    correct_q: 0,
    score_pct: 0,
  });
}

export async function updateSessionStats(sessionId: string): Promise<void> {
  const db = await getDb();
  const agg = await questions(db).aggregate<{ total: number; correct: number }>([
    { $match: { session_id: sessionId, user_ans: { $ne: null } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        correct: { $sum: { $cond: ['$is_correct', 1, 0] } },
      },
    },
  ]).toArray();

  const { total = 0, correct = 0 } = agg[0] ?? {};
  const score_pct = total > 0 ? (correct / total) * 100 : 0;
  await sessions(db).updateOne(
    { session_id: sessionId },
    { $set: { total_q: total, correct_q: correct, score_pct } }
  );
}

export async function getSession(sessionId: string): Promise<SessionRow | undefined> {
  const db = await getDb();
  const doc = await sessions(db).findOne({ session_id: sessionId });
  return doc ? docToSessionRow(doc) : undefined;
}

export async function listSessions(limit = 20): Promise<SessionRow[]> {
  const db = await getDb();
  const docs = await sessions(db).find().sort({ created_at: -1 }).limit(limit).toArray();
  return docs.map(docToSessionRow);
}

// ── Question helpers ─────────────────────────────────────────────────────────

export async function insertQuestion(q: InsertQuestion): Promise<string> {
  const db = await getDb();
  const result = await questions(db).insertOne({
    session_id: q.session_id,
    section_id: q.section_id,
    question_text: q.question_text,
    choices: q.choices,
    correct_ans: q.correct_ans,
    user_ans: null,
    is_correct: null,
    explanation: q.explanation ?? null,
    topic_tags: q.topic_tags ?? [],
    created_at: new Date().toISOString(),
  });
  return result.insertedId.toHexString();
}

export async function updateQuestionAnswer(id: string, userAns: string, isCorrect: boolean): Promise<void> {
  const db = await getDb();
  await questions(db).updateOne(
    { _id: new ObjectId(id) },
    { $set: { user_ans: userAns, is_correct: isCorrect } }
  );
}

export async function getSessionQuestions(sessionId: string): Promise<QuestionRow[]> {
  const db = await getDb();
  const docs = await questions(db).find({ session_id: sessionId }).sort({ _id: 1 }).toArray();
  return docs.map(docToQuestionRow);
}

// ── Adaptive-logic helpers ───────────────────────────────────────────────────

export async function getWeakTopics(sectionIds: string[]): Promise<WeakTopic[]> {
  if (sectionIds.length === 0) return [];
  const db = await getDb();
  logger.info('kb_weak_topics_query', { sections: sectionIds });
  return questions(db).aggregate<WeakTopic>([
    { $match: { section_id: { $in: sectionIds }, is_correct: false } },
    {
      $group: {
        _id: { section_id: '$section_id', topic_tags: '$topic_tags' },
        section_id: { $first: '$section_id' },
        question_text: { $first: '$question_text' },
        topic_tags: { $first: '$topic_tags' },
        wrong_count: { $sum: 1 },
      },
    },
    { $sort: { wrong_count: -1 } },
    { $limit: 20 },
  ]).toArray();
}

export async function getMasteredQuestions(sectionIds: string[]): Promise<string[]> {
  if (sectionIds.length === 0) return [];
  const db = await getDb();
  logger.info('kb_mastered_query', { sections: sectionIds });
  const docs = await questions(db).distinct('question_text', {
    section_id: { $in: sectionIds },
    is_correct: true,
  });
  return docs;
}

// ── Snapshot export ──────────────────────────────────────────────────────────

export async function exportSnapshot(topN = 5): Promise<SnapshotRecord[]> {
  const db = await getDb();
  const sessionDocs = await sessions(db)
    .find()
    .sort({ created_at: -1 })
    .limit(topN)
    .toArray();

  return Promise.all(
    sessionDocs.map(async (s) => {
      const qDocs = await questions(db)
        .find({ session_id: s.session_id })
        .sort({ _id: 1 })
        .toArray();
      return {
        session: {
          session_id: s.session_id,
          created_at: s.created_at,
          sections: s.sections,
          total_q: s.total_q,
          correct_q: s.correct_q,
          score_pct: s.score_pct,
        },
        questions: qDocs.map((q) => ({
          id: q._id!.toHexString(),
          session_id: q.session_id,
          section_id: q.section_id,
          question_text: q.question_text,
          choices: q.choices,
          correct_ans: q.correct_ans,
          user_ans: q.user_ans,
          is_correct: q.is_correct,
          explanation: q.explanation,
          topic_tags: q.topic_tags,
          created_at: q.created_at,
        })),
      };
    })
  );
}

// ── Converters ───────────────────────────────────────────────────────────────

function docToSessionRow(doc: SessionDoc & { _id?: ObjectId }): SessionRow {
  return {
    session_id: doc.session_id,
    created_at: doc.created_at,
    sections: doc.sections,
    total_q: doc.total_q,
    correct_q: doc.correct_q,
    score_pct: doc.score_pct,
  };
}

function docToQuestionRow(doc: QuestionDoc & { _id?: ObjectId }): QuestionRow {
  return {
    id: doc._id!.toHexString(),
    session_id: doc.session_id,
    section_id: doc.section_id,
    question_text: doc.question_text,
    choices: doc.choices,
    correct_ans: doc.correct_ans,
    user_ans: doc.user_ans,
    is_correct: doc.is_correct,
    explanation: doc.explanation,
    topic_tags: doc.topic_tags,
    created_at: doc.created_at,
  };
}

// ── MongoDB document shapes ───────────────────────────────────────────────────

interface SessionDoc {
  session_id: string;
  created_at: string;
  sections: string[];
  total_q: number;
  correct_q: number;
  score_pct: number;
}

interface QuestionDoc {
  session_id: string;
  section_id: string;
  question_text: string;
  choices: string[];
  correct_ans: string;
  user_ans: string | null;
  is_correct: boolean | null;
  explanation: string | null;
  topic_tags: string[];
  created_at: string;
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface SessionRow {
  session_id: string;
  created_at: string;
  sections: string[];
  total_q: number;
  correct_q: number;
  score_pct: number;
}

export interface QuestionRow {
  id: string;
  session_id: string;
  section_id: string;
  question_text: string;
  choices: string[];
  correct_ans: string;
  user_ans: string | null;
  is_correct: boolean | null;
  explanation: string | null;
  topic_tags: string[];
  created_at: string;
}

export interface InsertQuestion {
  session_id: string;
  section_id: string;
  question_text: string;
  choices: string[];
  correct_ans: string;
  explanation?: string;
  topic_tags?: string[];
}

export interface WeakTopic {
  section_id: string;
  question_text: string;
  topic_tags: string[];
  wrong_count: number;
}

export interface SnapshotRecord {
  session: SessionRow;
  questions: Array<QuestionRow>;
}
