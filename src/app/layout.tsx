import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { Brain } from 'lucide-react';

export const metadata: Metadata = {
  title: 'DocPrep AI — Adaptive Study System',
  description: 'AI-powered adaptive document preparation system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">
        <nav className="border-b border-white/[0.06] bg-[#08080f]/80 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 font-bold text-white tracking-tight">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/40">
                <Brain className="w-4 h-4 text-white" />
              </div>
              DocPrep AI
            </Link>
            <div className="flex items-center gap-1">
              <NavLink href="/">Study</NavLink>
              <NavLink href="/history">History</NavLink>
            </div>
          </div>
        </nav>
        <main className="max-w-4xl mx-auto px-6 py-10">
          {children}
        </main>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all duration-150"
    >
      {children}
    </Link>
  );
}
