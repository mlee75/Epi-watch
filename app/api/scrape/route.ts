import { NextRequest, NextResponse } from 'next/server';
import { runAllScrapers } from '@/lib/scrapers/index';

// Called by Vercel Cron (GET) or manually (POST with secret header)
export async function GET(request: NextRequest) {
  // Vercel Cron sends an Authorization header
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || process.env.SCRAPE_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Also allow direct call in development
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return runScrape();
}

export async function POST(request: NextRequest) {
  // Verify secret token for manual triggers
  const body = await request.json().catch(() => ({}));
  const secret = process.env.SCRAPE_SECRET;

  if (secret && body.secret !== secret) {
    const authHeader = request.headers.get('x-scrape-secret');
    if (authHeader !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return runScrape();
}

async function runScrape() {
  const startTime = Date.now();

  try {
    const result = await runAllScrapers();

    return NextResponse.json({
      success: true,
      durationMs: Date.now() - startTime,
      ...result,
    });
  } catch (err) {
    console.error('[/api/scrape]', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Scrape failed',
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
