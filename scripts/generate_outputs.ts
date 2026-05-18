/**
 * Standalone Scenario B output generator.
 * Uses in-process logic (no HTTP server, no real Groq key needed).
 * Writes JSON files to outputs/scenario_b_iter{N}/.
 *
 * Usage: npx ts-node --project tsconfig.scripts.json scripts/generate_outputs.ts
 */

import path from 'path';
import fs from 'fs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { config as loadEnv } from 'dotenv';

// Load .env.local so GROQ_API_KEY is available in the script
loadEnv({ path: path.resolve('.env.local') });

process.env.PDF_PATH = path.resolve('./data/SLATEFALL_DOSSIER.pdf');

import { v4 as uuidv4 } from 'uuid';
import * as db from '../src/lib/db';
import * as pdfLib from '../src/lib/pdf';
import * as groqLib from '../src/lib/groq';
import { buildWeakTopicSummary } from '../src/lib/scoring';

type WeakTopicSummary = { topic: string; wrongCount: number };

interface IterConfig {
  iteration: number;
  sectionIds: string[];
  outputDir: string;
  correctFraction: number;
}

const ITERATIONS: IterConfig[] = [
  { iteration: 1, sectionIds: ['5', '8'],       outputDir: 'outputs/scenario_b_iter1', correctFraction: 0.4 },
  { iteration: 2, sectionIds: ['6', '8', '9'],   outputDir: 'outputs/scenario_b_iter2', correctFraction: 0.6 },
  { iteration: 3, sectionIds: ['8'],              outputDir: 'outputs/scenario_b_iter3', correctFraction: 0.7 },
];

function pickWrongAnswer(correct: string, choices: string[]): string {
  const letters = choices
    .map((c) => c.match(/^([A-D])/)?.[1])
    .filter((l): l is string => !!l && l !== correct);
  return letters[Math.floor(Math.random() * letters.length)] ?? 'B';
}

async function runIteration(cfg: IterConfig) {
  console.log(`\n=== Iteration ${cfg.iteration}: sections [${cfg.sectionIds.join(', ')}] ===`);

  const allSections = await pdfLib.parsePdf();
  let targetSections = allSections.filter((s) => cfg.sectionIds.includes(s.id));

  if (targetSections.length === 0) {
    const available = allSections.slice(0, cfg.sectionIds.length);
    console.warn(`  Sections not found; using [${available.map((s) => s.id).join(', ')}]`);
    targetSections = available;
    cfg.sectionIds = available.map((s) => s.id);
  }

  const weakTopicRows = await db.getWeakTopics(cfg.sectionIds);
  const masteredQs = await db.getMasteredQuestions(cfg.sectionIds);
  const weakTopics: WeakTopicSummary[] = buildWeakTopicSummary(
    weakTopicRows.map((r) => ({ topic_tags: r.topic_tags, wrong_count: r.wrong_count }))
  );

  const isAdaptive = weakTopics.length > 0;
  console.log(`  Adaptive: ${isAdaptive}, weak topics: ${weakTopics.length}`);

  const sessionId = uuidv4();
  await db.createSession(sessionId, cfg.sectionIds);

  const generator = groqLib.useMockGenerator() ? groqLib.generateMCQsMock : groqLib.generateMCQs;

  const allQuestions: Array<{
    questionDbId: string;
    sectionId: string;
    question: string;
    choices: string[];
    correct_ans: string;
    explanation: string;
    topic_tags: string[];
    simulatedAnswer: string;
    isCorrect: boolean;
  }> = [];

  for (const section of targetSections) {
    const mcqs = await generator({
      sectionId: section.id,
      sectionTitle: section.title,
      sectionText: section.text,
      numQuestions: 5,
      weakTopics: isAdaptive ? weakTopics : [],
      masteredQuestions: masteredQs.slice(0, 10),
    });

    for (const mcq of mcqs) {
      const qId = await db.insertQuestion({
        session_id: sessionId,
        section_id: section.id,
        question_text: mcq.question,
        choices: mcq.choices,
        correct_ans: mcq.correct_ans,
        explanation: mcq.explanation,
        topic_tags: mcq.topic_tags,
      });

      const giveCorrect = Math.random() < cfg.correctFraction;
      const simulatedAnswer = giveCorrect
        ? mcq.correct_ans
        : pickWrongAnswer(mcq.correct_ans, mcq.choices);

      await db.updateQuestionAnswer(qId, simulatedAnswer, giveCorrect);

      allQuestions.push({
        questionDbId: qId,
        sectionId: section.id,
        question: mcq.question,
        choices: mcq.choices,
        correct_ans: mcq.correct_ans,
        explanation: mcq.explanation,
        topic_tags: mcq.topic_tags,
        simulatedAnswer,
        isCorrect: giveCorrect,
      });
    }
  }

  await db.updateSessionStats(sessionId);

  const correct = allQuestions.filter((q) => q.isCorrect).length;
  console.log(`  Score: ${correct}/${allQuestions.length}`);

  const dir = path.resolve(cfg.outputDir);
  fs.mkdirSync(dir, { recursive: true });

  const questionsOutput = {
    iteration: cfg.iteration,
    sessionId,
    sections: cfg.sectionIds,
    isAdaptive,
    weakTopicsUsed: weakTopics,
    generatedAt: new Date().toISOString(),
    usedMockLLM: groqLib.useMockGenerator(),
    questions: allQuestions.map((q) => ({
      questionDbId: q.questionDbId,
      sectionId: q.sectionId,
      question: q.question,
      choices: q.choices,
      correctAnswer: q.correct_ans,
      simulatedUserAnswer: q.simulatedAnswer,
      isCorrect: q.isCorrect,
      explanation: q.explanation,
      topicTags: q.topic_tags,
    })),
    score: {
      total: allQuestions.length,
      correct,
      wrong: allQuestions.length - correct,
      scorePct: Math.round((correct / allQuestions.length) * 100),
    },
    adaptiveBehaviorNote: isAdaptive
      ? `Adaptive: questions focused on ${weakTopics.slice(0, 3).map((t) => `"${t.topic}"`).join(', ')}`
      : 'First run — no prior history; fresh question generation.',
  };

  fs.writeFileSync(
    path.join(dir, `questions_iter${cfg.iteration}.json`),
    JSON.stringify(questionsOutput, null, 2)
  );

  const snapshot = await db.exportSnapshot(5);
  fs.writeFileSync(
    path.join(dir, `kb_snapshot_iter${cfg.iteration}.json`),
    JSON.stringify({ exportedAt: new Date().toISOString(), iteration: cfg.iteration, snapshot }, null, 2)
  );

  console.log(`  Saved to ${cfg.outputDir}/`);
}

async function main() {
  // Start an in-process MongoDB so the script runs without a local server
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB = 'scenario_b_kb';

  console.log('Generating Scenario B outputs...');
  console.log(`MongoDB: in-memory (${mongod.getUri()})`);
  console.log(`Mock LLM: ${groqLib.useMockGenerator()}`);

  for (const cfg of ITERATIONS) {
    await runIteration({ ...cfg });
  }

  await db.closeDb();
  await mongod.stop();
  console.log('\nDone. Check outputs/scenario_b_iter{1,2,3}/');
}

main().catch((e) => { console.error(e); process.exit(1); });
