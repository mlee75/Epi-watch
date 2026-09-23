import { NextRequest, NextResponse } from 'next/server';
import { fetchCountryBrief } from '@/lib/live/countryBrief';

export const maxDuration = 60;

// Verified reporting for one country (see lib/live/countryBrief.ts). Upstream
// requests are cached for 30 minutes; the CDN caches each country's response.
export async function GET(request: NextRequest) {
  const iso3 = (request.nextUrl.searchParams.get('iso3') ?? '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(iso3)) return NextResponse.json({ error: 'iso3 required' }, { status: 400 });
  const brief = await fetchCountryBrief(iso3);
  if (!brief) return NextResponse.json({ error: 'unknown country' }, { status: 404 });
  return NextResponse.json(brief, { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' } });
}
