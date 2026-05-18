'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import NumberChips from '@/components/ui/number-chips';

interface SectionMeta {
  id: string;
  title: string;
  textLength: number;
}

export default function SectionSelector() {
  const router = useRouter();
  const [sections, setSections] = useState<SectionMeta[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [numQ, setNumQ] = useState(5);

  useEffect(() => {
    fetch('/api/sections')
      .then((r) => r.json())
      .then((data) => { setSections(data.sections ?? []); setLoading(false); })
      .catch(() => { setError('Failed to load sections.'); setLoading(false); });
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const startSession = async () => {
    if (selected.size === 0) return;
    setStarting(true);
    setError('');
    try {
      const res = await fetch('/api/prep/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionIds: Array.from(selected), numQuestionsPerSection: numQ }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to start session');
      sessionStorage.setItem(`session_${data.sessionId}`, JSON.stringify(data));
      router.push(`/quiz?sessionId=${data.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="card flex items-center justify-center h-40 gap-3 text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading sections…
      </div>
    );
  }

  const totalQuestions = selected.size * numQ;

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Section grid */}
      <div className="card space-y-5">
        <div>
          <h2 className="text-base font-semibold text-white mb-0.5">Choose sections</h2>
          <p className="text-sm text-slate-500">Select the sections you want to study in this session.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {sections.map((s) => {
            const isSelected = selected.has(s.id);
            return (
              <motion.button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                layout
                animate={{
                  backgroundColor: isSelected
                    ? 'rgba(37,99,235,0.12)'
                    : 'rgba(255,255,255,0.02)',
                  borderColor: isSelected
                    ? 'rgba(59,130,246,0.4)'
                    : 'rgba(255,255,255,0.06)',
                }}
                whileHover={{
                  backgroundColor: isSelected
                    ? 'rgba(37,99,235,0.16)'
                    : 'rgba(255,255,255,0.05)',
                }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="relative flex items-center gap-3 p-3.5 rounded-xl border text-left w-full"
              >
                {/* Section number badge */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold transition-colors ${
                  isSelected ? 'bg-blue-600 text-white' : 'bg-white/[0.06] text-slate-400'
                }`}>
                  {s.id}
                </div>

                {/* Title */}
                <span className={`text-sm font-medium leading-snug transition-colors ${
                  isSelected ? 'text-blue-100' : 'text-slate-300'
                }`}>
                  {s.title}
                </span>

                {/* Check */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="ml-auto shrink-0"
                    >
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Config + CTA */}
      <div className="card space-y-5">
        <NumberChips
          options={[3, 5, 8, 10]}
          value={numQ}
          onChange={setNumQ}
          label="Questions per section"
        />

        <div className="flex items-center gap-4 pt-1">
          <button
            onClick={startSession}
            disabled={selected.size === 0 || starting}
            className="btn-primary flex items-center gap-2"
          >
            {starting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Start Session <ArrowRight className="w-4 h-4" /></>
            )}
          </button>

          {selected.size > 0 && (
            <motion.p
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-sm text-slate-500"
            >
              {totalQuestions} questions across {selected.size} section{selected.size !== 1 ? 's' : ''}
            </motion.p>
          )}
        </div>
      </div>
    </div>
  );
}
