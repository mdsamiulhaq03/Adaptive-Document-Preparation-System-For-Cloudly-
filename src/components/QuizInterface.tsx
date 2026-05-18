'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Zap, Send, Loader2 } from 'lucide-react';

interface Question {
  id: string;
  sessionId: string;
  sectionId: string;
  question: string;
  choices: string[];
}

interface Props {
  sessionId: string;
  questions: Question[];
  isAdaptive: boolean;
}

const CHOICE_LETTERS = ['A', 'B', 'C', 'D'];

export default function QuizInterface({ sessionId, questions, isAdaptive }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [direction, setDirection] = useState(1);

  const q = questions[current];
  const totalAnswered = Object.keys(answers).length;
  const allAnswered = totalAnswered === questions.length;
  const progress = (totalAnswered / questions.length) * 100;

  const go = (delta: number) => {
    setDirection(delta);
    setCurrent((c) => Math.max(0, Math.min(questions.length - 1, c + delta)));
  };

  const selectAnswer = (letter: string) => {
    setAnswers((prev) => ({ ...prev, [q.id]: letter }));
    // Auto-advance after short delay
    if (current < questions.length - 1) {
      setTimeout(() => { setDirection(1); setCurrent((c) => c + 1); }, 380);
    }
  };

  const submitAnswers = async () => {
    if (!allAnswered) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/prep/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          answers: Object.entries(answers).map(([qId, ans]) => ({ questionId: qId, userAnswer: ans })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit');
      sessionStorage.setItem(`results_${sessionId}`, JSON.stringify(data));
      router.push(`/results?sessionId=${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Adaptive banner */}
      {isAdaptive && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-400">
          <Zap className="w-4 h-4 shrink-0" />
          Adaptive mode — questions target your historical weak areas
        </div>
      )}

      {/* Progress header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">
            Question <span className="text-white font-semibold">{current + 1}</span>
            <span className="text-slate-600"> / {questions.length}</span>
          </span>
          <span className="text-slate-400">
            <span className="text-white font-semibold">{totalAnswered}</span> answered
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-blue-500 rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {/* Dot indicators */}
        <div className="flex gap-1 flex-wrap">
          {questions.map((item, i) => (
            <button
              key={item.id}
              onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i); }}
              className={`w-6 h-6 rounded-md text-[10px] font-bold transition-all duration-150 ${
                i === current
                  ? 'bg-blue-600 text-white scale-110'
                  : answers[item.id]
                  ? 'bg-blue-500/30 text-blue-400'
                  : 'bg-white/[0.06] text-slate-500 hover:bg-white/[0.10]'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Question card */}
      <div className="relative overflow-hidden" style={{ minHeight: 340 }}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={q.id}
            custom={direction}
            variants={{
              enter: (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="card space-y-5"
          >
            {/* Section label */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                Section {q.sectionId}
              </span>
            </div>

            {/* Question text */}
            <p className="text-white text-lg leading-relaxed font-medium">{q.question}</p>

            {/* Choices */}
            <div className="space-y-2.5">
              {q.choices.map((choice, i) => {
                const letter = CHOICE_LETTERS[i] ?? choice.match(/^([A-D])/)?.[1];
                const isSelected = answers[q.id] === letter;

                return (
                  <motion.button
                    key={choice}
                    type="button"
                    onClick={() => selectAnswer(letter)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    animate={{
                      backgroundColor: isSelected
                        ? 'rgba(37,99,235,0.18)'
                        : 'rgba(255,255,255,0.03)',
                      borderColor: isSelected
                        ? 'rgba(59,130,246,0.5)'
                        : 'rgba(255,255,255,0.07)',
                    }}
                    transition={{ duration: 0.15 }}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border text-left"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-white/[0.06] text-slate-400'
                    }`}>
                      {letter}
                    </div>
                    <span className={`text-sm leading-relaxed transition-colors ${
                      isSelected ? 'text-blue-100 font-medium' : 'text-slate-300'
                    }`}>
                      {/* Strip leading "A. " prefix if present */}
                      {choice.replace(/^[A-D]\.\s*/, '')}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => go(-1)}
          disabled={current === 0}
          className="btn-secondary flex items-center gap-2 disabled:opacity-30"
        >
          <ArrowLeft className="w-4 h-4" /> Previous
        </button>

        {current < questions.length - 1 ? (
          <button onClick={() => go(1)} className="btn-secondary flex items-center gap-2">
            Next <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={submitAnswers}
            disabled={!allAnswered || submitting}
            className="btn-primary flex items-center gap-2"
          >
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
              : <><Send className="w-4 h-4" /> Submit Answers</>}
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
