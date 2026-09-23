import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import type { OutbreakSource } from '@/lib/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const outbreak = await prisma.outbreak.findUnique({
      where: { id: params.id },
      include: {
        sources: {
          orderBy: { publishedAt: 'desc' },
        },
      },
    });

    if (!outbreak) {
      return NextResponse.json({ error: 'Outbreak not found' }, { status: 404 });
    }

    // No synthetic fallback. It used to fabricate a source from the record's
    // own fields, typed as "news" with a default reliability of 3, even for WHO
    // reports. The record's primary source is already shown by the client.
    const sources = outbreak.sources;

    const serialized: OutbreakSource[] = sources.map((s) => ({
      ...s,
      publishedAt: s.publishedAt?.toISOString() ?? null,
      scrapedAt: s.scrapedAt instanceof Date ? s.scrapedAt.toISOString() : String(s.scrapedAt),
    }));

    return NextResponse.json({ data: serialized, total: serialized.length });
  } catch (err) {
    console.error('[GET /api/outbreaks/:id/sources]', err);
    return NextResponse.json({ error: 'Failed to fetch sources' }, { status: 500 });
  }
}
