import { NextRequest, NextResponse } from 'next/server';
import { exportSnapshot } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const topN = parseInt(url.searchParams.get('n') ?? '5', 10);
    const snapshot = await exportSnapshot(topN);
    return NextResponse.json({ snapshot, exportedAt: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
