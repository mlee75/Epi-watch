import { NextRequest, NextResponse } from 'next/server';

import prisma from '@/lib/db';
import { VIDEO_SOURCES } from '@/lib/videoSources';

// Reads the database with no request-derived cache key, so without this Next
// would prerender it at build time and the feed would freeze at deploy state.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const authority = searchParams.get('authority');
    const disease = searchParams.get('disease');
    const country = searchParams.get('country');
    const outbreakId = searchParams.get('outbreakId');
    const linkedOnly = searchParams.get('linked') === 'true';

    // Same clamping contract as /api/outbreaks: malformed input falls back to
    // the default instead of reaching Prisma and throwing a 500.
    const parsedLimit = parseInt(searchParams.get('limit') || '24');
    const limit = Number.isNaN(parsedLimit) ? 24 : Math.min(Math.max(parsedLimit, 1), 100);

    const parsedOffset = parseInt(searchParams.get('offset') || '0');
    const offset = Number.isNaN(parsedOffset) ? 0 : Math.max(parsedOffset, 0);

    const where: Record<string, unknown> = { isActive: true };

    if (authority && authority !== 'ALL') where.authority = authority;
    if (disease && disease !== 'ALL') where.disease = disease;
    if (country && country !== 'ALL') where.country = country;
    if (outbreakId) where.outbreakId = outbreakId;
    if (linkedOnly) where.outbreakId = { not: null };

    const [videos, total] = await Promise.all([
      prisma.outbreakVideo.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          outbreak: {
            select: { id: true, disease: true, country: true, severity: true },
          },
        },
      }),
      prisma.outbreakVideo.count({ where }),
    ]);

    return NextResponse.json(
      {
        data: videos,
        meta: {
          total,
          limit,
          offset,
          hasMore: offset + videos.length < total,
          // Surfaced so the provenance claim is inspectable from the API, not
          // just asserted in the UI.
          verifiedSources: VIDEO_SOURCES.map((s) => ({
            authority: s.authority,
            channelName: s.channelName,
            channelId: s.channelId,
            language: s.language,
          })),
        },
      },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    );
  } catch (err) {
    console.error('[GET /api/videos]', err);
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
  }
}
