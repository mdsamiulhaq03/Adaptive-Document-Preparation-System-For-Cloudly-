import { NextResponse } from 'next/server';
import { parsePdf } from '@/lib/pdf';

export async function GET() {
  try {
    const sections = await parsePdf();
    return NextResponse.json({
      sections: sections.map((s) => ({
        id: s.id,
        title: s.title,
        textLength: s.text.length,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST also supported for consistency with spec
export async function POST() {
  return GET();
}
