import SectionSelector from '@/components/SectionSelector';

export default function Home() {
  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center pt-4 pb-2">
        
        <h1 className="text-4xl font-bold text-white tracking-tight mb-3">
          Adaptive Study System
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
          AI-generated MCQs from your dossier. The system learns your weak spots
          and focuses every session on what you need most.
        </p>
      </div>

      <SectionSelector />
    </div>
  );
}
