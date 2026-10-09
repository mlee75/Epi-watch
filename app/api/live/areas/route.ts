import { NextResponse } from 'next/server';
import { fetchEmergencyAreas } from '@/lib/live/emergencies';

export const revalidate = 600;
export const maxDuration = 60;

// GDACS affected-area shapes (see lib/live/emergencies.ts); cached ten minutes.
export async function GET() {
  const data = await fetchEmergencyAreas();
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' },
  });
}
