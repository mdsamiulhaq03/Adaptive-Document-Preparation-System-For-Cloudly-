'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import QuizInterface from '@/components/QuizInterface';
import { Loader2 } from 'lucide-react';

interface Question {
  id: string;
  sessionId: string;
  sectionId: string;
  question: string;
  choices: string[];
}

interface SessionData {
  sessionId: string;
  questions: Question[];
  isAdaptive: boolean;
  weakTopicsFound: number;
}

function QuizContent() {
  const params = useSearchParams();
  const router = useRouter();
  const sessionId = params.get('sessionId');
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) { router.push('/'); return; }
    const stored = sessionStorage.getItem(`session_${sessionId}`);
    if (stored) { setSession(JSON.parse(stored)); return; }
    setError('Session not found. Please start a new session.');
  }, [sessionId, router]);

  if (error) {
    return (
      <div className="card text-center py-12 max-w-md mx-auto">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => router.push('/')} className="btn-primary">Back to Home</button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-40 gap-3 text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading quiz…
      </div>
    );
  }

  return <QuizInterface sessionId={session.sessionId} questions={session.questions} isAdaptive={session.isAdaptive} />;
}

export default function QuizPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-40 gap-3 text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    }>
      <QuizContent />
    </Suspense>
  );
}
