'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, RotateCcw, History, ChevronDown, ChevronUp } from 'lucide-react';

interface AnswerResult {
  questionId: string;
  questionText: string;
  choices: string[];
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string | null;
}

interface SubmitResult {
  sessionId: string;
  score: { total: number; correct: number; wrong: number; scorePct: number };
  results: AnswerResult[];
}

export default function ResultsView({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<SubmitResult | null>(null);
  const [filter, setFilter] = useState<'all' | 'wrong' | 'correct'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = sessionStorage.getItem(`results_${sessionId}`);
    if (stored) setData(JSON.parse(stored));
  }, [sessionId]);

  if (!data) {
    return (
      <div className="card text-center py-12 text-slate-400">
        <p className="mb-4">No results found for this session.</p>
        <Link href="/" className="btn-primary inline-flex">Start New Session</Link>
      </div>
    );
  }

  const { score, results } = data;
  const displayed = filter === 'wrong'
    ? results.filter((r) => !r.isCorrect)
    : filter === 'correct'
    ? results.filter((r) => r.isCorrect)
    : results;

  const grade =
    score.scorePct >= 80 ? { label: 'Excellent', color: 'text-emerald-400', ring: 'stroke-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' } :
    score.scorePct >= 60 ? { label: 'Good', color: 'text-amber-400', ring: 'stroke-amber-500', bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400' } :
    { label: 'Needs Work', color: 'text-red-400', ring: 'stroke-red-500', bg: 'bg-red-500/10 border-red-500/20 text-red-400' };

  const circumference = 2 * Math.PI * 44;
  const dash = (score.scorePct / 100) * circumference;

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      {/* Score card */}
      <div className="card">
        <div className="flex flex-col sm:flex-row items-center gap-8">
          {/* Circular progress */}
          <div className="relative w-32 h-32 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
              <motion.circle
                cx="50" cy="50" r="44"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                className={grade.ring}
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: circumference - dash }}
                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold ${grade.color}`}>{score.scorePct}%</span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex-1 space-y-4 text-center sm:text-left">
            <div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${grade.bg} mb-2`}>
                {grade.label}
              </span>
              <p className="text-slate-400 text-sm">{score.total} questions answered</p>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-400">{score.correct}</p>
                <p className="text-xs text-slate-500 mt-0.5">Correct</p>
              </div>
              <div className="w-px h-8 bg-white/[0.08]" />
              <div className="text-center">
                <p className="text-2xl font-bold text-red-400">{score.wrong}</p>
                <p className="text-xs text-slate-500 mt-0.5">Wrong</p>
              </div>
              <div className="w-px h-8 bg-white/[0.08]" />
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-300">{score.total}</p>
                <p className="text-xs text-slate-500 mt-0.5">Total</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1 justify-center sm:justify-start">
              <Link href="/" className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
                <RotateCcw className="w-3.5 h-3.5" /> Study Again
              </Link>
              <Link href="/history" className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
                <History className="w-3.5 h-3.5" /> History
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl w-fit">
        {([
          { key: 'all', label: `All (${results.length})` },
          { key: 'correct', label: `Correct (${score.correct})` },
          { key: 'wrong', label: `Wrong (${score.wrong})` },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              filter === key
                ? 'bg-white/[0.08] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Question review */}
      <div className="space-y-2">
        {displayed.map((r, idx) => {
          const isOpen = expanded.has(r.questionId);
          return (
            <div
              key={r.questionId}
              className={`rounded-xl border overflow-hidden transition-colors ${
                r.isCorrect
                  ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                  : 'border-red-500/20 bg-red-500/[0.04]'
              }`}
            >
              {/* Header row — always visible */}
              <button
                onClick={() => toggleExpand(r.questionId)}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                {r.isCorrect
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                <span className="text-slate-200 text-sm leading-snug flex-1">{r.questionText}</span>
                <span className="shrink-0 text-slate-500 ml-2">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>

              {/* Expanded answer detail */}
              {isOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-white/[0.05] pt-3">
                  <div className="space-y-1.5">
                    {r.choices.map((choice) => {
                      const letter = choice.match(/^([A-D])/)?.[1];
                      const isUser = letter === r.userAnswer;
                      const isCorrect = letter === r.correctAnswer;
                      const clean = choice.replace(/^[A-D]\.\s*/, '');
                      return (
                        <div key={choice} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                          isCorrect ? 'bg-emerald-500/10 border border-emerald-500/20' :
                          isUser    ? 'bg-red-500/10 border border-red-500/20' :
                          'opacity-50'
                        }`}>
                          <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold shrink-0 ${
                            isCorrect ? 'bg-emerald-500 text-white' :
                            isUser    ? 'bg-red-500 text-white' :
                            'bg-white/[0.06] text-slate-500'
                          }`}>
                            {letter}
                          </span>
                          <span className={
                            isCorrect ? 'text-emerald-300 font-medium' :
                            isUser    ? 'text-red-300 line-through' :
                            'text-slate-400'
                          }>
                            {clean}
                          </span>
                          {isCorrect && <span className="ml-auto text-xs text-emerald-400 font-medium">✓ Correct</span>}
                          {isUser && !isCorrect && <span className="ml-auto text-xs text-red-400 font-medium">Your answer</span>}
                        </div>
                      );
                    })}
                  </div>

                  {!r.isCorrect && r.explanation && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <p className="text-xs font-semibold text-blue-400 mb-1">Explanation</p>
                      <p className="text-sm text-slate-300 leading-relaxed">{r.explanation}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {displayed.length === 0 && (
          <div className="card text-center text-slate-500 py-8">
            {filter === 'wrong' ? '🎉 Perfect score — no wrong answers!' : 'No results to show.'}
          </div>
        )}
      </div>
    </div>
  );
}
