import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import type { Outbreak, OutbreakSource } from '@/lib/types';

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export async function GET(
  _request: NextRequest,
  { params }: { params: { countryCode: string } }
) {
  try {
    // countryCode is URL-encoded country name (e.g. "Democratic%20Republic%20of%20Congo")
    const countryName = decodeURIComponent(params.countryCode);

    const dbOutbreaks = await prisma.outbreak.findMany({
      where: { country: { equals: countryName }, isActive: true },
      include: {
        sources: { orderBy: { publishedAt: 'desc' } },
      },
      orderBy: { reportDate: 'desc' },
    });

    if (dbOutbreaks.length === 0) {
      return NextResponse.json({ error: 'No data for this country' }, { status: 404 });
    }

    // Sort by severity
    dbOutbreaks.sort(
      (a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4)
    );

    const totalCases  = dbOutbreaks.reduce((s, o) => s + o.cases, 0);
    const totalDeaths = dbOutbreaks.reduce((s, o) => s + o.deaths, 0);
    const threatLevel = dbOutbreaks[0].severity;
    const threatScore = threatLevel === 'CRITICAL' ? 95
      : threatLevel === 'HIGH' ? 75
      : threatLevel === 'MEDIUM' ? 50 : 25;

    const affectedRegions = [...new Set(
      dbOutbreaks.map((o) => o.subregion ?? o.region).filter(Boolean)
    )];

    const outbreaks = dbOutbreaks.map((o) => {
      // Synthesize source if none stored
      let sources = o.sources;
      if (sources.length === 0) {
        sources = [
          {
            id: `synthetic-${o.id}`,
            outbreakId: o.id,
            sourceName: o.sourceName,
            sourceType: 'news',
            sourceLanguage: o.language,
            sourceCountry: null,
            articleTitle: o.titleOrig ?? `${o.disease} — ${o.country}`,
            articleUrl: o.sourceUrl,
            articleExcerpt: o.summary ?? null,
            publishedAt: o.reportDate,
            scrapedAt: o.createdAt,
            reliabilityScore: 3,
            isVerified: o.verified,
            verifiedBy: o.verified ? o.sourceName : null,
            originalText: null,
            translatedText: null,
            author: null,
          },
        ];
      }

      const serializedSources: OutbreakSource[] = sources.map((s) => ({
        ...s,
        publishedAt: s.publishedAt instanceof Date ? s.publishedAt.toISOString() : (s.publishedAt as string | null),
        scrapedAt: s.scrapedAt instanceof Date ? s.scrapedAt.toISOString() : String(s.scrapedAt),
      }));

      const outbreak: Outbreak & { sources: OutbreakSource[]; totalSources: number } = {
        ...o,
        severity: o.severity as Outbreak['severity'],
        reportDate: o.reportDate.toISOString(),
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
        pathogen: o.pathogen ?? null,
        subregion: o.subregion ?? null,
        lat: o.lat ?? null,
        lng: o.lng ?? null,
        summary: o.summary ?? null,
        trend: o.trend ?? null,
        titleOrig: o.titleOrig ?? null,
        sources: serializedSources,
        totalSources: serializedSources.length,
      };

      return outbreak;
    });

    return NextResponse.json({
      data: {
        country: {
          name: countryName,
          threatLevel,
          threatScore,
          lastUpdated: dbOutbreaks[0].updatedAt.toISOString(),
        },
        overview: {
          activeOutbreaks: dbOutbreaks.length,
          totalCases,
          totalDeaths,
          affectedRegions,
        },
        outbreaks,
      },
    });
  } catch (err) {
    console.error('[GET /api/countries/:countryCode/intelligence]', err);
    return NextResponse.json({ error: 'Failed to fetch country intelligence' }, { status: 500 });
  }
}
