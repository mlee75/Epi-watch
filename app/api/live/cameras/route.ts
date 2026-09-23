import { NextResponse } from 'next/server';
import { fetchCameras } from '@/lib/live/cameras';

export const revalidate = 3600;

export async function GET() {
  const data = await fetchCameras();
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
  });
}
