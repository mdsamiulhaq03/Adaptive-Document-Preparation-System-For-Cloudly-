/**
 * Tests for MCQ generation prompt structure and mock generator.
 * Does NOT call the real Groq API.
 */

import { generateMCQsMock } from '../src/lib/groq';

describe('generateMCQsMock', () => {
  const baseCtx = {
    sectionId: '1',
    sectionTitle: 'Introduction to Security',
    sectionText: 'This section covers basic security principles including authentication and authorization.',
  };

  it('returns the requested number of MCQs', async () => {
    const mcqs = await generateMCQsMock({ ...baseCtx, numQuestions: 5 });
    expect(mcqs).toHaveLength(5);
  });

  it('returns 3 MCQs when numQuestions is 3', async () => {
    const mcqs = await generateMCQsMock({ ...baseCtx, numQuestions: 3 });
    expect(mcqs).toHaveLength(3);
  });

  it('each MCQ has required fields', async () => {
    const mcqs = await generateMCQsMock({ ...baseCtx, numQuestions: 2 });
    for (const mcq of mcqs) {
      expect(typeof mcq.question).toBe('string');
      expect(mcq.question.length).toBeGreaterThan(0);
      expect(Array.isArray(mcq.choices)).toBe(true);
      expect(mcq.choices.length).toBeGreaterThanOrEqual(2);
      expect(typeof mcq.correct_ans).toBe('string');
      expect(typeof mcq.explanation).toBe('string');
      expect(Array.isArray(mcq.topic_tags)).toBe(true);
    }
  });

  it('correct_ans is a single letter A-D', async () => {
    const mcqs = await generateMCQsMock({ ...baseCtx, numQuestions: 5 });
    for (const mcq of mcqs) {
      expect(mcq.correct_ans).toMatch(/^[A-D]$/);
    }
  });

  it('mentions weak topics in question when provided', async () => {
    const mcqs = await generateMCQsMock({
      ...baseCtx,
      numQuestions: 3,
      weakTopics: [{ topic: 'encryption', wrongCount: 5 }],
    });
    const hasWeakRef = mcqs.some((m) =>
      m.question.toLowerCase().includes('encryption') ||
      m.question.toLowerCase().includes('focus')
    );
    expect(hasWeakRef).toBe(true);
  });

  it('defaults to 5 questions when numQuestions is not set', async () => {
    const mcqs = await generateMCQsMock(baseCtx);
    expect(mcqs).toHaveLength(5);
  });
});

describe('prompt structure validation', () => {
  it('correct_ans in mock is always A (first choice)', async () => {
    const mcqs = await generateMCQsMock({
      sectionId: '2',
      sectionTitle: 'Test',
      sectionText: 'Text',
      numQuestions: 3,
    });
    for (const mcq of mcqs) {
      expect(mcq.correct_ans).toBe('A');
      expect(mcq.choices[0]).toMatch(/^A\./);
    }
  });

  it('topic_tags are non-empty strings', async () => {
    const mcqs = await generateMCQsMock({
      sectionId: '3',
      sectionTitle: 'Network Security',
      sectionText: 'Firewalls, IDS/IPS, VPNs.',
      numQuestions: 1,
    });
    expect(mcqs[0].topic_tags.every((t) => typeof t === 'string' && t.length > 0)).toBe(true);
  });
});
