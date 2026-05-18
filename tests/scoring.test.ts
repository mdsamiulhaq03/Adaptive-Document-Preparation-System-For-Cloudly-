import { scoreAnswers, buildWeakTopicSummary } from '../src/lib/scoring';

const mockQuestions = [
  {
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa', // 24-char hex (MongoDB ObjectId-like)
    correct_ans: 'A',
    explanation: 'A is correct.',
    question_text: 'Question 1?',
    choices: ['A. Option A', 'B. Option B', 'C. Option C', 'D. Option D'],
  },
  {
    id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
    correct_ans: 'C',
    explanation: 'C is correct.',
    question_text: 'Question 2?',
    choices: ['A. Option A', 'B. Option B', 'C. Option C', 'D. Option D'],
  },
  {
    id: 'cccccccccccccccccccccccc',
    correct_ans: 'B',
    explanation: 'B is correct.',
    question_text: 'Question 3?',
    choices: ['A. Option A', 'B. Option B', 'C. Option C', 'D. Option D'],
  },
];

describe('scoreAnswers', () => {
  it('scores all correct', () => {
    const result = scoreAnswers(
      [
        { questionId: 'aaaaaaaaaaaaaaaaaaaaaaaa', userAnswer: 'A' },
        { questionId: 'bbbbbbbbbbbbbbbbbbbbbbbb', userAnswer: 'C' },
        { questionId: 'cccccccccccccccccccccccc', userAnswer: 'B' },
      ],
      mockQuestions
    );
    expect(result.correct).toBe(3);
    expect(result.wrong).toBe(0);
    expect(result.scorePct).toBe(100);
    expect(result.answers.every((a) => a.isCorrect)).toBe(true);
  });

  it('scores all wrong', () => {
    const result = scoreAnswers(
      [
        { questionId: 'aaaaaaaaaaaaaaaaaaaaaaaa', userAnswer: 'B' },
        { questionId: 'bbbbbbbbbbbbbbbbbbbbbbbb', userAnswer: 'A' },
        { questionId: 'cccccccccccccccccccccccc', userAnswer: 'C' },
      ],
      mockQuestions
    );
    expect(result.correct).toBe(0);
    expect(result.wrong).toBe(3);
    expect(result.scorePct).toBe(0);
    expect(result.answers.every((a) => !a.isCorrect)).toBe(true);
  });

  it('scores mixed answers', () => {
    const result = scoreAnswers(
      [
        { questionId: 'aaaaaaaaaaaaaaaaaaaaaaaa', userAnswer: 'A' }, // correct
        { questionId: 'bbbbbbbbbbbbbbbbbbbbbbbb', userAnswer: 'A' }, // wrong
        { questionId: 'cccccccccccccccccccccccc', userAnswer: 'B' }, // correct
      ],
      mockQuestions
    );
    expect(result.correct).toBe(2);
    expect(result.wrong).toBe(1);
    expect(result.scorePct).toBe(67);
  });

  it('normalizes answer letters (full choice vs letter)', () => {
    const result = scoreAnswers(
      [{ questionId: 'aaaaaaaaaaaaaaaaaaaaaaaa', userAnswer: 'A. Option A' }],
      [mockQuestions[0]]
    );
    expect(result.answers[0].isCorrect).toBe(true);
  });

  it('throws for unknown question ID', () => {
    expect(() =>
      scoreAnswers([{ questionId: 'zzzzzzzzzzzzzzzzzzzzzzzz', userAnswer: 'A' }], mockQuestions)
    ).toThrow('Question ID zzzzzzzzzzzzzzzzzzzzzzzz not found');
  });

  it('attaches explanation only for wrong answers', () => {
    const result = scoreAnswers(
      [
        { questionId: 'aaaaaaaaaaaaaaaaaaaaaaaa', userAnswer: 'A' }, // correct
        { questionId: 'bbbbbbbbbbbbbbbbbbbbbbbb', userAnswer: 'A' }, // wrong
      ],
      mockQuestions.slice(0, 2)
    );
    expect(result.answers[0].explanation).toBe('A is correct.');
    expect(result.answers[1].explanation).toBe('C is correct.');
  });
});

describe('buildWeakTopicSummary', () => {
  it('aggregates topic tags by wrong count', () => {
    const rows = [
      { topic_tags: ['encryption', 'AES'], wrong_count: 3 },
      { topic_tags: ['encryption', 'RSA'], wrong_count: 2 },
      { topic_tags: ['hashing'], wrong_count: 1 },
    ];
    const result = buildWeakTopicSummary(rows);
    const encRow = result.find((r) => r.topic === 'encryption');
    expect(encRow).toBeDefined();
    expect(encRow!.wrongCount).toBe(5); // 3 + 2
    expect(result[0].wrongCount).toBeGreaterThanOrEqual(result[1].wrongCount);
  });

  it('handles null/empty topic_tags', () => {
    const rows = [
      { topic_tags: null, wrong_count: 5 },
      { topic_tags: [], wrong_count: 3 },
    ];
    expect(buildWeakTopicSummary(rows)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(buildWeakTopicSummary([])).toEqual([]);
  });
});
