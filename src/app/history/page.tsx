'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Download, Trash2 } from 'lucide-react';

interface QuestionRecord {
  id: string;
  sectionId: string;
  questionText: string;
  choices: string[];
  correctAnswer: string;
  userAnswer: string | null;
  isCorrect: boolean;
  explanation: string | null;
  topicTags: string[];
}

interface SessionRecord {
  sessionId: string;
  createdAt: string;
  sections: string[];
  totalQuestions: number;
  correctAnswers: number;
  scorePct: number;
  questions: QuestionRecord[];
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/history')
      .then((r) => r.json())
      .then((d) => { setSessions(d.sessions ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Delete this session? This cannot be undone.')) return;
    setDeleting(sessionId);
    try {
      const res = await fetch(`/api/history/${sessionId}`, { method: 'DELETE' });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
        if (expanded === sessionId) setExpanded(null);
      }
    } finally {
      setDeleting(null);
    }
  };

  const exportSnapshot = async () => {
    const res = await fetch('/api/snapshot');
    const data = await res.json();
    setSnapshot(JSON.stringify(data, null, 2));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-slate-500">Loading history…</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Study History</h1>
          <p className="text-sm text-slate-500 mt-0.5">{sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportSnapshot} className="btn-secondary text-sm py-2 px-4 flex items-center gap-2">
            <Download className="w-3.5 h-3.5" /> Snapshot
          </button>
          <Link href="/" className="btn-primary text-sm py-2 px-4">New Session</Link>
        </div>
      </div>

      {snapshot && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-white text-sm">KB Snapshot (top 5 sessions)</h3>
            <button onClick={() => setSnapshot(null)} className="text-xs text-slate-500 hover:text-slate-300">Close</button>
          </div>
          <pre className="text-xs bg-black/30 p-3 rounded-lg overflow-x-auto max-h-96 text-slate-300">{snapshot}</pre>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="card text-center text-slate-500">
          <p>No sessions yet.</p>
          <Link href="/" className="btn-primary mt-4 inline-block">Start Your First Session</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const isOpen = expanded === s.sessionId;
            const color = s.scorePct >= 80 ? 'text-emerald-400' : s.scorePct >= 50 ? 'text-amber-400' : 'text-red-400';
            return (
              <div key={s.sessionId} className="card">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : s.sessionId)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`text-2xl font-bold ${color}`}>{s.scorePct}%</div>
                    <div>
                      <p className="font-medium text-slate-200 text-sm">
                        Sections: {s.sections.join(', ')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(s.createdAt).toLocaleString()} · {s.correctAnswers}/{s.totalQuestions} correct
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(s.sessionId); }}
                      disabled={deleting === s.sessionId}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                      title="Delete session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-4 pt-4 border-t border-white/8 space-y-3">
                    {s.questions.map((q, idx) => (
                      <div key={q.id} className={`rounded-lg p-3 border ${q.isCorrect ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                        {/* Question */}
                        <div className="flex items-start gap-2 mb-2">
                          {q.isCorrect
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            : <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
                          <p className="text-slate-200 text-sm leading-snug">
                            <span className="text-slate-500 text-xs mr-1">Q{idx + 1}</span>
                            {q.questionText}
                          </p>
                        </div>

                        {/* Wrong answer details */}
                        {!q.isCorrect && q.userAnswer && (
                          <div className="ml-6 space-y-1.5 mt-2">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-red-400 text-xs font-medium w-20 shrink-0">Your answer</span>
                              <span className="text-red-300 line-through">
                                {q.choices.find(c => c.startsWith(q.userAnswer!)) ?? q.userAnswer}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-emerald-400 text-xs font-medium w-20 shrink-0">Correct</span>
                              <span className="text-emerald-300">
                                {q.choices.find(c => c.startsWith(q.correctAnswer)) ?? q.correctAnswer}
                              </span>
                            </div>
                            {q.explanation && (
                              <div className="mt-2 p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                <p className="text-xs text-blue-300 leading-relaxed">{q.explanation}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
