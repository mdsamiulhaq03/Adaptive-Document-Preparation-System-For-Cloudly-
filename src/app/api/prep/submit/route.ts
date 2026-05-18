import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionQuestions,
  updateQuestionAnswer,
  updateSessionStats,
  getSession,
} from '@/lib/db';
import { scoreAnswers, SubmittedAnswer } from '@/lib/scoring';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      sessionId: string;
      answers: SubmittedAnswer[];
    };

    const { sessionId, answers } = body;

    if (!sessionId || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        { error: 'sessionId and answers array are required' },
        { status: 400 }
      );
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const storedQuestions = await getSessionQuestions(sessionId);
    if (storedQuestions.length === 0) {
      return NextResponse.json({ error: 'No questions found for this session' }, { status: 404 });
    }

    // Guard against re-submission: if all questions already have answers, reject
    const alreadyScored = storedQuestions.every((q) => q.user_ans !== null);
    if (alreadyScored) {
      logger.warn('session_resubmit_blocked', { sessionId });
      return NextResponse.json(
        { error: 'This session has already been submitted' },
        { status: 409 }
      );
    }

    const result = scoreAnswers(answers, storedQuestions);

    // Persist each answer
    await Promise.all(
      result.answers.map((scored) =>
        updateQuestionAnswer(scored.questionId, scored.userAnswer, scored.isCorrect)
      )
    );
    await updateSessionStats(sessionId);
    logger.info('session_scored', {
      sessionId,
      total: result.total,
      correct: result.correct,
      scorePct: result.scorePct,
    });

    return NextResponse.json({
      sessionId,
      score: {
        total: result.total,
        correct: result.correct,
        wrong: result.wrong,
        scorePct: result.scorePct,
      },
      results: result.answers.map((a) => ({
        questionId: a.questionId,
        questionText: a.questionText,
        choices: a.choices,
        userAnswer: a.userAnswer,
        correctAnswer: a.correctAnswer,
        isCorrect: a.isCorrect,
        explanation: a.isCorrect ? null : a.explanation,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('session_submit_failed', { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
