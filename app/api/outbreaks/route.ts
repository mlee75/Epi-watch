import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const severity = searchParams.get('severity'); // CRITICAL|HIGH|MEDIUM|LOW
    const region = searchParams.get('region');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'recent'; // recent|severity|cases|deaths
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');
    const activeOnly = searchParams.get('active') !== 'false';

    // Build where clause
    const where: Record<string, unknown> = {};

    if (activeOnly) where.isActive = true;

    if (severity && severity !== 'ALL') {
      where.severity = severity.toUpperCase();
    }

    if (region && region !== 'ALL') {
      where.region = region.toUpperCase();
    }

    if (search) {
      where.OR = [
        { disease: { contains: search } },
        { country: { contains: search } },
        { summary: { contains: search } },
      ];
    }

    // Build orderBy
    let orderBy: Record<string, string> | Record<string, string>[] = { reportDate: 'desc' };

    if (sort === 'severity') {
      // Prisma doesn't support custom enum ordering, so we order by reportDate
      // and severity as a secondary sort. Frontend can re-sort for display.
      orderBy = [
        { reportDate: 'desc' },
      ];
    } else if (sort === 'cases') {
      orderBy = { cases: 'desc' };
    } else if (sort === 'deaths') {
      orderBy = { deaths: 'desc' };
    }

    const [outbreaks, total] = await Promise.all([
      prisma.outbreak.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.outbreak.count({ where }),
    ]);

    // Sort by severity on the server side when requested
    let results = outbreaks;
    if (sort === 'severity') {
      const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      results = outbreaks.sort(
        (a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4)
      );
    }

    return NextResponse.json({
      data: results,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (err) {
    console.error('[GET /api/outbreaks]', err);
    return NextResponse.json({ error: 'Failed to fetch outbreaks' }, { status: 500 });
  }
}
