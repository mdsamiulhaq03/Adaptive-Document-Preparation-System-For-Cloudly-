import { Suspense } from 'react';
import ResultsViewWrapper from './ResultsViewWrapper';

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-32 text-slate-400">Loading results…</div>}>
      <ResultsViewWrapper />
    </Suspense>
  );
}
