import { NextResponse } from 'next/server';
import { fetchEmergencyAircraft } from '@/lib/live/aircraft';

// Regenerated at most every 30 seconds and served from cache in between, so
// every visitor shares one upstream request.
export const revalidate = 30;

export async function GET() {
  const data = await fetchEmergencyAircraft();
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
}
