import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { prisma } from '@/lib/prisma';
import { classifySeverity, getRegionForCountry } from '@/lib/classifiers';
import { getCountryCoords } from '@/lib/countryCoords';
import {
  CASE_PATTERNS,
  DEATH_PATTERNS,
  cleanTitle,
  extractCount,
  extractCountry,
  extractDisease,
  withTimeout,
} from '@/lib/feedText';
import { ingestVideos } from '@/lib/scrapers/video';

const parser = new Parser();

// Cap the whole run so a slow or hanging feed can't blow the function timeout.
export const maxDuration = 60;

const FEED_TIMEOUT_MS = 12_000;

// Multiple reliable sources. Verified reachable 2026-08-03 — the previous
// WHO/ECDC/ProMED RSS endpoints now 404, and the old CDC feed was a stale
// COVID-only archive.
const SOURCES = [
  { url: 'https://tools.cdc.gov/api/v2/resources/media/285676.rss', name: 'CDC' },
  { url: 'https://outbreaknewstoday.com/feed/', name: 'OutbreakNews' },
  {
    url: 'https://news.google.com/rss/search?q=disease+outbreak&hl=en-US&gl=US&ceid=US:en',
    name: 'GoogleNews',
  },
];

export async function GET(request: Request) {
  // Security check
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  console.log('🔄 Starting auto-update from multiple sources...');

  let totalNew = 0;
  let totalErrors = 0;
  const results = [];

  for (const source of SOURCES) {
    try {
      console.log(`Fetching from: ${source.url}`);
      const feed = await withTimeout(parser.parseURL(source.url), FEED_TIMEOUT_MS);

      let sourceNew = 0;

      // Process latest 3 items from each source
      for (const item of feed.items.slice(0, 3)) {
        try {
          const title = cleanTitle(item.title || item.contentSnippet || '');

          if (!title || title.length < 10) continue;

          // Counts are only ever read from the headline's own words; anything
          // the source doesn't state stays 0, which the UI renders as "—".
          const cases = extractCount(title, CASE_PATTERNS);
          const deaths = extractCount(title, DEATH_PATTERNS);

          const disease = extractDisease(title);
          const country = extractCountry(title);
          const reportDate = new Date(item.pubDate || Date.now());
          const dedupeKey = `${disease}::${country}::${reportDate.toISOString().slice(0, 10)}`;

          // dedupeKey already scopes to disease+country+day. Matching on bare
          // disease+country as well would permanently suppress every future
          // outbreak of a disease in a country that is already listed.
          const exists = await prisma.outbreak.findFirst({ where: { dedupeKey } });

          if (!exists) {
            const coords = getCountryCoords(country);

            await prisma.outbreak.create({
              data: {
                disease,
                country,
                region: getRegionForCountry(country),
                lat: coords?.[0] ?? null,
                lng: coords?.[1] ?? null,
                cases,
                deaths,
                severity: classifySeverity(cases, deaths),
                isActive: true,
                verified: false,
                summary: title,
                sourceUrl: item.link || source.url,
                sourceName: source.name,
                dedupeKey,
                reportDate,
              },
            });
            sourceNew++;
            totalNew++;
          }
        } catch (err) {
          console.error('Error processing item:', err);
          totalErrors++;
        }
      }

      results.push({
        source: source.url,
        newOutbreaks: sourceNew,
        success: true,
      });
    } catch (error) {
      console.error(`Error fetching ${source.url}:`, error);
      results.push({
        source: source.url,
        error: error instanceof Error ? error.message : String(error),
        success: false,
      });
      totalErrors++;
    }
  }

  // Video intelligence from allowlisted health-authority channels. Runs after
  // the outbreak pass so newly ingested outbreaks are available to link against.
  let videos = null;
  try {
    videos = await ingestVideos();
    totalErrors += videos.errors;
  } catch (error) {
    console.error('Video ingestion failed:', error);
    totalErrors++;
  }

  // Get current stats
  const stats = await prisma.outbreak.groupBy({
    by: ['severity'],
    where: { isActive: true },
    _count: true,
  });

  const totalActive = await prisma.outbreak.count({ where: { isActive: true } });
  const critical = stats.find(s => s.severity === 'CRITICAL')?._count || 0;

  console.log(`✅ Update complete: ${totalNew} new outbreaks from ${SOURCES.length} sources`);

  return NextResponse.json({
    success: true,
    newOutbreaks: totalNew,
    errors: totalErrors,
    totalActive,
    critical,
    sources: results,
    videos,
    timestamp: new Date().toISOString(),
  });
}
