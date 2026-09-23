import { NextRequest, NextResponse } from 'next/server';
import { fetchNhsn, fetchSari } from '@/lib/live/hospital';

/**
 * Hospital-intake summary for one country, for the globe's country card.
 * The underlying upstream fetches are cached (see lib/live/hospital.ts), so
 * this route only filters cached data. It is not rate limited: the limiter
 * writes to the database per call, and the globe calls this on hover; the
 * CDN cache header below absorbs repeat requests instead.
 */

// Natural Earth codes that differ from WHO's.
const NE_TO_WHO: Record<string, string> = { KOS: 'XKX', SDS: 'SSD', PSX: 'PSE' };

export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get('iso3') ?? '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(raw)) return NextResponse.json({ error: 'iso3 required' }, { status: 400 });
  const iso3 = NE_TO_WHO[raw] ?? raw;

  const [sari, nhsn] = await Promise.all([fetchSari(), iso3 === 'USA' ? fetchNhsn() : Promise.resolve(null)]);
  const c = sari.countries.find((x) => x.iso3 === iso3) ?? null;
  const us = nhsn?.national?.weeks.slice(-8) ?? null;

  return NextResponse.json(
    {
      sari: c && {
        latestWeek: c.latest.week,
        settledWeek: c.reference?.week ?? null,
        settledCases: c.reference?.cases ?? null,
        provisionalWeeks: c.provisionalWeeks,
        cases: c.latest.cases,
        priorMean: c.priorMean,
        change: c.change,
        weeks: c.weeks.slice(-12).map((w) => ({ week: w.week, cases: w.cases })),
      },
      us,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' } }
  );
}
