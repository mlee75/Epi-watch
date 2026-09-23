import { NextResponse } from 'next/server';
import { fetchEmergencies } from '@/lib/live/emergencies';

export const revalidate = 120;

export async function GET() {
  const data = await fetchEmergencies();
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
  });
}
