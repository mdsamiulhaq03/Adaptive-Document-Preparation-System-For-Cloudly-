import { NextRequest, NextResponse } from 'next/server';
import { listSessions, getSessionQuestions } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);

    const sessionList = await listSessions(limit);

    const history = await Promise.all(
      sessionList.map(async (s) => {
        const questions = await getSessionQuestions(s.session_id);
        return {
          sessionId: s.session_id,
          createdAt: s.created_at,
          sections: s.sections,
          totalQuestions: s.total_q,
          correctAnswers: s.correct_q,
          scorePct: Math.round(s.score_pct),
          questions: questions.map((q) => ({
            id: q.id,
            sectionId: q.section_id,
            questionText: q.question_text,
            choices: q.choices,
            correctAnswer: q.correct_ans,
            userAnswer: q.user_ans,
            isCorrect: q.is_correct === true,
            explanation: q.explanation,
            topicTags: q.topic_tags ?? [],
          })),
        };
      })
    );

    return NextResponse.json({ sessions: history });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
