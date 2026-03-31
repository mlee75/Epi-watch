import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { COUNTRY_COORDS } from '@/lib/countryCoords';

// ── Country name list for mention detection ────────────────────────────────
const ALL_COUNTRIES = Object.keys(COUNTRY_COORDS).filter(
  (k) => k !== 'Multiple Countries' && k !== 'Global' && k !== 'UAE' && k !== 'USA'
);

// Pre-sort longest names first so multi-word names match before shorter subsets
const SORTED_COUNTRIES = [...ALL_COUNTRIES].sort((a, b) => b.length - a.length);

// ── Regional + disease-specific Google News queries ────────────────────────
const NEWS_QUERIES = [
  'disease+outbreak+health+epidemic+Africa',
  'disease+outbreak+health+epidemic+Asia',
  'disease+outbreak+health+epidemic+Americas',
  'disease+outbreak+health+epidemic+Europe',
  'disease+outbreak+health+Middle+East',
  'disease+outbreak+health+Pacific+Southeast+Asia',
  'cholera+dengue+measles+outbreak+cases+2026',
  'tuberculosis+malaria+typhoid+outbreak+health+2026',
  'ebola+mpox+marburg+hemorrhagic+fever+2026',
  'avian+flu+H5N1+influenza+outbreak+countries',
];

// Extract country names from an article title using word-boundary matching
function extractCountries(title: string): string[] {
  const lower = title.toLowerCase();
  const found = new Set<string>();
  for (const country of SORTED_COUNTRIES) {
    const nameLower = country.toLowerCase();
    const idx = lower.indexOf(nameLower);
    if (idx === -1) continue;
    // Require non-alpha boundaries (prevents "Niger" matching "Nigeria", "Mali" in "Somalia")
    const beforeOk = idx === 0 || !/[a-z]/.test(lower[idx - 1]);
    const afterOk = idx + nameLower.length >= lower.length || !/[a-z]/.test(lower[idx + nameLower.length]);
    if (beforeOk && afterOk) found.add(country);
  }
  return Array.from(found);
}

// Fetch all queries concurrently, extract country mention counts
async function fetchNewsActivity(): Promise<Record<string, number>> {
  const mentions: Record<string, number> = {};

  const results = await Promise.allSettled(
    NEWS_QUERIES.map((q) =>
      axios.get(
        `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`,
        {
          timeout: 5000,
          responseType: 'text',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EpiWatch/2.0)' },
        }
      )
    )
  );

  for (const res of results) {
    if (res.status !== 'fulfilled') continue;
    const $ = cheerio.load(res.value.data as string, { xmlMode: true });
    $('item').each((_, el) => {
      const title = $(el).find('title').text().replace(/<!\[CDATA\[(.+?)\]\]>/, '$1').trim();
      const snippet = $(el).find('description').text().replace(/<[^>]+>/g, '').slice(0, 200);
      for (const country of extractCountries(`${title} ${snippet}`)) {
        mentions[country] = (mentions[country] ?? 0) + 1;
      }
    });
  }

  return mentions;
}

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3,
};

export async function GET() {
  try {
    // Run DB query and news sweep concurrently
    const [outbreaks, newsActivity] = await Promise.all([
      prisma.outbreak.findMany({
        where: { isActive: true },
        select: { country: true, severity: true },
      }),
      fetchNewsActivity(),
    ]);

    const countryMap: Record<string, string> = {};

    // Only accept country names that exist in our known country list (exact case-insensitive match)
    const knownSet = new Set(ALL_COUNTRIES.map((c) => c.toLowerCase()));
    const isValidCountry = (name: string) =>
      !!name && knownSet.has(name.toLowerCase());

    // 1. Build outbreak-based severity map (highest severity per country)
    for (const o of outbreaks) {
      if (!o.country || o.country === 'Multiple Countries' || o.country === 'Unknown') continue;
      if (!isValidCountry(o.country)) continue;
      const existing = countryMap[o.country];
      if (!existing || (SEVERITY_ORDER[o.severity] ?? 4) < (SEVERITY_ORDER[existing] ?? 4)) {
        countryMap[o.country] = o.severity;
      }
    }

    // 2. Fill in countries only visible in news (don't downgrade outbreak data)
    for (const [country, count] of Object.entries(newsActivity)) {
      if (countryMap[country]) continue; // already has outbreak severity — keep it
      if (count >= 3) {
        countryMap[country] = 'MEDIUM';
      } else {
        countryMap[country] = 'LOW';
      }
    }

    return NextResponse.json({ data: countryMap }, {
      headers: {
        // Serve fresh for 10 min; CDN may serve stale for up to 30 min while revalidating
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800',
      },
    });
  } catch (err) {
    console.error('[GET /api/countries-map]', err);
    return NextResponse.json({ data: {} }, { status: 500 });
  }
}
