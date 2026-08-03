import { NextResponse } from 'next/server';
import Parser from 'rss-parser';
import { prisma } from '@/lib/prisma';
import { classifySeverity, getRegionForCountry } from '@/lib/classifiers';
import { getCountryCoords } from '@/lib/countryCoords';

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
    timestamp: new Date().toISOString(),
  });
}

function extractDisease(text: string): string {
  const diseases = [
    'Ebola', 'Marburg', 'Lassa', 'Dengue', 'Zika', 'Chikungunya',
    'Cholera', 'Typhoid', 'Malaria', 'Yellow Fever', 'Measles',
    'COVID-19', 'COVID', 'Mpox', 'Monkeypox', 'Plague', 'Anthrax',
    'Avian Influenza', 'Bird Flu', 'H5N1', 'Rabies', 'Polio',
    // The CDC "Outbreaks — US Based" feed is predominantly foodborne; without
    // these every CDC item collapsed to the "Infectious Disease" fallback.
    'Salmonella', 'Listeria', 'Cyclospora', 'Norovirus', 'Botulism',
    'Hepatitis A', 'Shigella', 'Campylobacter', 'Legionnaires', 'E. coli',
  ];

  const lowerText = text.toLowerCase();
  for (const disease of diseases) {
    if (lowerText.includes(disease.toLowerCase())) {
      return disease;
    }
  }
  return 'Infectious Disease';
}

function extractCountry(text: string): string {
  const countries = [
    'Afghanistan', 'Angola', 'Argentina', 'Australia', 'Bangladesh',
    'Brazil', 'Cameroon', 'Chad', 'China', 'Colombia', 'Congo', 'DRC',
    'Ecuador', 'Egypt', 'Ethiopia', 'France', 'Germany', 'Ghana',
    'Haiti', 'India', 'Indonesia', 'Iran', 'Iraq', 'Italy', 'Japan',
    'Kenya', 'Lebanon', 'Liberia', 'Libya', 'Madagascar', 'Mali',
    'Mexico', 'Mozambique', 'Myanmar', 'Nepal', 'Niger', 'Nigeria',
    'Pakistan', 'Peru', 'Philippines', 'Somalia', 'South Africa',
    'South Sudan', 'Spain', 'Sudan', 'Syria', 'Tanzania', 'Thailand',
    'Turkey', 'Uganda', 'Ukraine', 'United States', 'USA', 'Venezuela',
    'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
  ];

  for (const country of countries) {
    if (text.includes(country)) {
      return country;
    }
  }
  return 'Multiple Countries';
}

// CDC's feed marks up pathogen names ("<em>Salmonella</em> Outbreak Linked to
// Shell Eggs") and some feeds escape entities. The title is stored as the
// summary and rendered as plain text, so the markup has to come off first.
function cleanTitle(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;|&#8217;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Feed timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// Deliberately matched against the headline only. Article bodies mention many
// incidental figures ("73 new cases this week", "31% fatality rate"), and
// scanning them reliably picks the wrong one — a plausible but false total is
// worse here than no total at all. In a headline the number sitting next to
// "cases"/"deaths" is the figure the story is actually about.
const COUNT = String.raw`(\d[\d,]*)`;
// Repeated as whitespace-separated words so multi-word lead-ins like
// "rise to" / "climb past" are matched, not just single connectives.
const LEAD = String.raw`(?:\s*(?:rise|rises|risen|climb|climbs|climbed|reach|reaches|reached|pass|passes|passed|past|surpass|surpasses|hit|hits|top|tops|topped|now|stand|stands|at|to|:)){1,3}`;

const CASE_PATTERNS = [
  // "1,406 confirmed cases", "87 infections"
  new RegExp(String.raw`${COUNT}\s+(?:confirmed|suspected|probable|reported|new|total)?\s*(?:cases|infections)`, 'i'),
  // "cases rise to 1,406", "cases pass 11,000", "cases: 452"
  new RegExp(String.raw`(?:cases|infections)\s*${LEAD}\s*${COUNT}`, 'i'),
];

const DEATH_PATTERNS = [
  new RegExp(String.raw`${COUNT}\s+(?:confirmed|reported|new|total)?\s*(?:deaths|fatalities|dead)`, 'i'),
  new RegExp(String.raw`(?:deaths|fatalities)\s*${LEAD}\s*${COUNT}`, 'i'),
];

function extractCount(text: string, patterns: RegExp[]): number {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const value = parseInt(match[1].replace(/,/g, ''), 10);
    // Guard against a stray year or ID being read as a count.
    if (Number.isFinite(value) && value >= 0 && value < 100_000_000) {
      return value;
    }
  }
  return 0;
}
