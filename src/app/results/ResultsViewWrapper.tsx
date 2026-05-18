'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import ResultsView from '@/components/ResultsView';

export default function ResultsViewWrapper() {
  const params = useSearchParams();
  const router = useRouter();
  const sessionId = params.get('sessionId');

  useEffect(() => {
    if (!sessionId) router.push('/');
  }, [sessionId, router]);

  if (!sessionId) return null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Session Results</h1>
        <p className="text-sm text-slate-500 mt-0.5">Session ID: {sessionId}</p>
      </div>
      <ResultsView sessionId={sessionId} />
    </div>
  );
}
