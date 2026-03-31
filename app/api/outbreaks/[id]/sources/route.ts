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

    // If no sources in DB yet, synthesize one from the outbreak's own fields
    let sources = outbreak.sources;
    if (sources.length === 0) {
      sources = [
        {
          id: `synthetic-${outbreak.id}`,
          outbreakId: outbreak.id,
          sourceName: outbreak.sourceName,
          sourceType: 'news',
          sourceLanguage: outbreak.language,
          sourceCountry: null,
          articleTitle: outbreak.titleOrig ?? `${outbreak.disease} — ${outbreak.country}`,
          articleUrl: outbreak.sourceUrl,
          articleExcerpt: outbreak.summary ?? null,
          publishedAt: outbreak.reportDate,
          scrapedAt: outbreak.createdAt,
          reliabilityScore: 3,
          isVerified: outbreak.verified,
          verifiedBy: outbreak.verified ? outbreak.sourceName : null,
          originalText: null,
          translatedText: null,
          author: null,
        },
      ];
    }

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
