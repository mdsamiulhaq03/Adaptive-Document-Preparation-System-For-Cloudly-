export interface SubmittedAnswer {
  questionId: string;
  userAnswer: string;
}

export interface ScoredAnswer {
  questionId: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
  questionText: string;
  choices: string[];
}

export interface SessionScore {
  total: number;
  correct: number;
  wrong: number;
  scorePct: number;
  answers: ScoredAnswer[];
}

export interface StoredQuestion {
  id: string;
  correct_ans: string;
  explanation: string | null;
  question_text: string;
  choices: string[]; // already an array (MongoDB native)
}

export function scoreAnswers(
  submitted: SubmittedAnswer[],
  storedQuestions: StoredQuestion[]
): SessionScore {
  const questionMap = new Map(storedQuestions.map((q) => [q.id, q]));

  const scored: ScoredAnswer[] = submitted.map((ans) => {
    const q = questionMap.get(ans.questionId);
    if (!q) throw new Error(`Question ID ${ans.questionId} not found`);

    const normalizedUser = ans.userAnswer.trim().toUpperCase().replace(/^([A-D]).*/, '$1');
    const normalizedCorrect = q.correct_ans.trim().toUpperCase().replace(/^([A-D]).*/, '$1');
    const isCorrect = normalizedUser === normalizedCorrect;

    return {
      questionId: ans.questionId,
      userAnswer: normalizedUser,
      correctAnswer: normalizedCorrect,
      isCorrect,
      explanation: q.explanation ?? 'No explanation available.',
      questionText: q.question_text,
      choices: q.choices,
    };
  });

  const correct = scored.filter((s) => s.isCorrect).length;
  const total = scored.length;

  return {
    total,
    correct,
    wrong: total - correct,
    scorePct: total > 0 ? Math.round((correct / total) * 100) : 0,
    answers: scored,
  };
}

export function buildWeakTopicSummary(
  wrongAnswers: Array<{ topic_tags: string[] | null; wrong_count: number }>
): Array<{ topic: string; wrongCount: number }> {
  const topicMap = new Map<string, number>();

  for (const row of wrongAnswers) {
    if (!row.topic_tags || row.topic_tags.length === 0) continue;
    for (const tag of row.topic_tags) {
      topicMap.set(tag, (topicMap.get(tag) ?? 0) + row.wrong_count);
    }
  }

  return Array.from(topicMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([topic, wrongCount]) => ({ topic, wrongCount }));
}
