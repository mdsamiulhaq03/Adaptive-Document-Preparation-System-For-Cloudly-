import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  createSession,
  insertQuestion,
  getWeakTopics,
  getMasteredQuestions,
} from '@/lib/db';
import { getSectionsByIds } from '@/lib/pdf';
import { generateMCQs, generateMCQsMock, useMockGenerator, WeakTopicSummary } from '@/lib/groq';
import { buildWeakTopicSummary } from '@/lib/scoring';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      sectionIds: string[];
      numQuestionsPerSection?: number;
    };

    const { sectionIds, numQuestionsPerSection = 5 } = body;

    if (!Array.isArray(sectionIds) || sectionIds.length === 0) {
      return NextResponse.json({ error: 'sectionIds must be a non-empty array' }, { status: 400 });
    }

    const sections = await getSectionsByIds(sectionIds.map(String));
    if (sections.length === 0) {
      return NextResponse.json({ error: 'No matching sections found' }, { status: 404 });
    }

    // Build adaptive context from KB history
    const weakTopicRows = await getWeakTopics(sectionIds.map(String));
    const masteredQs = await getMasteredQuestions(sectionIds.map(String));
    const weakTopics: WeakTopicSummary[] = buildWeakTopicSummary(
      weakTopicRows.map((r) => ({ topic_tags: r.topic_tags, wrong_count: r.wrong_count }))
    );

    const isAdaptive = weakTopics.length > 0;
    const sessionId = uuidv4();
    await createSession(sessionId, sectionIds.map(String));
    logger.info('session_start', { sessionId, sections: sectionIds, isAdaptive, weakTopics: weakTopics.length });

    const allQuestions: Array<{
      id: string;
      sessionId: string;
      sectionId: string;
      question: string;
      choices: string[];
      topicTags: string[];
    }> = [];

    const generator = useMockGenerator() ? generateMCQsMock : generateMCQs;

    for (const section of sections) {
      const mcqs = await generator({
        sectionId: section.id,
        sectionTitle: section.title,
        sectionText: section.text,
        numQuestions: numQuestionsPerSection,
        weakTopics: isAdaptive ? weakTopics : [],
        masteredQuestions: masteredQs.slice(0, 10),
      });

      logger.info('mcq_generated', { sessionId, sectionId: section.id, count: mcqs.length });
      for (const mcq of mcqs) {
        const qId = await insertQuestion({
          session_id: sessionId,
          section_id: section.id,
          question_text: mcq.question,
          choices: mcq.choices,
          correct_ans: mcq.correct_ans,
          explanation: mcq.explanation,
          topic_tags: mcq.topic_tags,
        });

        allQuestions.push({
          id: qId,
          sessionId,
          sectionId: section.id,
          question: mcq.question,
          choices: mcq.choices,
          topicTags: mcq.topic_tags,
        });
      }
    }

    logger.info('session_ready', { sessionId, totalQuestions: allQuestions.length });
    return NextResponse.json({
      sessionId,
      isAdaptive,
      weakTopicsFound: weakTopics.length,
      questions: allQuestions,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('session_start_failed', { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
