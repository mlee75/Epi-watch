import axios from 'axios';
import * as cheerio from 'cheerio';
import type { ScrapedOutbreak } from '../types';
import { getCountryCoords } from '../countryCoords';
import { getRegionForCountry, detectTrend } from '../classifiers';

// ProMED migrated to a paid platform (promedmail.org) in April 2025.
// Their free alert digest is now distributed via email only, not RSS.
// We scrape their public search page as a best-effort fallback.
const PROMED_SEARCH_URL = 'https://www.promedmail.org/search?q=outbreak&limit=20';

// ProMED subjects often look like:
// "CHOLERA UPDATE (74): AFRICA, ASIA, MIDDLE EAST, 2024"
// "EBOLA VIRUS DISEASE: DEM REP CONGO"
function parseProMEDSubject(subject: string): { disease: string; country: string } | null {
  const clean = subject
    .replace(/\s+UPDATE\s*\([^)]*\)/gi, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\d{4}$/, '')
    .trim();

  const parts = clean.split(':');
  if (parts.length < 2) return null;

  const diseaseRaw = parts[0].trim();
  const countryRaw = parts[1].split(',')[0].trim();

  const ABBR: Record<string, string> = {
    'DEM REP CONGO': 'Democratic Republic of Congo',
    DRC: 'Democratic Republic of Congo',
    'SAUDI ARABIA': 'Saudi Arabia',
    'SOUTH AFRICA': 'South Africa',
    'SOUTH KOREA': 'South Korea',
    'UNITED STATES': 'United States',
    USA: 'United States',
    UK: 'United Kingdom',
    'UNITED KINGDOM': 'United Kingdom',
    AFRICA: 'Multiple Countries',
    ASIA: 'Multiple Countries',
    EUROPE: 'Multiple Countries',
    GLOBAL: 'Multiple Countries',
    WORLDWIDE: 'Multiple Countries',
    'MULTI-COUNTRY': 'Multiple Countries',
    'MIDDLE EAST': 'Multiple Countries',
  };

  const upper = countryRaw.toUpperCase();
  const country =
    ABBR[upper] ||
    countryRaw.split(' ').map((w) => (w[0] ?? '') + w.slice(1).toLowerCase()).join(' ');

  const disease = diseaseRaw
    .split(' ')
    .map((w) => (w[0] ?? '') + w.slice(1).toLowerCase())
    .join(' ');

  return { disease, country };
}

export async function scrapeProMED(): Promise<ScrapedOutbreak[]> {
  const outbreaks: ScrapedOutbreak[] = [];

  // Try ProMED search API (JSON endpoint from their new Payload CMS)
  try {
    const res = await axios.get<{
      docs?: Array<{
        title?: string;
        slug?: string;
        publishedAt?: string;
        excerpt?: string;
      }>
    }>(
      'https://www.promedmail.org/api/promed-posts?limit=20&sort=-publishedAt&where[_status][equals]=published',
      {
        timeout: 12000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpiWatch/2.0)',
          Accept: 'application/json',
        },
      }
    );

    const docs = res.data?.docs ?? [];

    for (const doc of docs) {
      try {
        const title = doc.title?.trim() ?? '';
        if (!title || title.length < 5) continue;

        const parsed = parseProMEDSubject(title);
        if (!parsed) continue;

        const { disease, country } = parsed;
        const coords = getCountryCoords(country);
        const slug = doc.slug ?? '';
        const excerpt = doc.excerpt ?? '';

        outbreaks.push({
          disease,
          country,
          region: getRegionForCountry(country),
          lat: coords?.[0],
          lng: coords?.[1],
          cases: 0,
          deaths: 0,
          recovered: 0,
          trend: detectTrend(excerpt),
          summary: excerpt.slice(0, 400) || undefined,
          sourceUrl: `https://www.promedmail.org/${slug}`,
          sourceName: 'ProMED',
          reportDate: doc.publishedAt ? new Date(doc.publishedAt) : new Date(),
          verified: false,
          language: 'en',
        });
      } catch {
        // Skip
      }
    }

    if (outbreaks.length > 0) {
      console.log(`[ProMED] Got ${outbreaks.length} items from Payload CMS API`);
      return outbreaks;
    }
  } catch (err) {
    console.warn('[ProMED] Payload API failed:', err instanceof Error ? err.message : err);
  }

  // Try their public search page HTML
  try {
    const response = await axios.get(PROMED_SEARCH_URL, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const $ = cheerio.load(response.data);

    $('a, .result-title, h2, h3').each((_, el) => {
      try {
        const text = $(el).text().trim();
        if (text.length < 10 || !/[A-Z]{3,}/.test(text)) return;

        const href = $(el).attr('href') || $(el).find('a').attr('href') || '';
        const parsed = parseProMEDSubject(text);
        if (!parsed) return;

        const { disease, country } = parsed;
        const coords = getCountryCoords(country);

        outbreaks.push({
          disease,
          country,
          region: getRegionForCountry(country),
          lat: coords?.[0],
          lng: coords?.[1],
          cases: 0, deaths: 0, recovered: 0,
          trend: 'stable',
          sourceUrl: href.startsWith('http') ? href : `https://www.promedmail.org${href}`,
          sourceName: 'ProMED',
          reportDate: new Date(),
          verified: false,
          language: 'en',
        });
      } catch {
        // Skip
      }
    });

    console.log(`[ProMED] Got ${outbreaks.length} items from search HTML`);
  } catch (err) {
    // ProMED is paywalled — this is expected to fail silently
    console.warn('[ProMED] All strategies failed (paywall):', err instanceof Error ? err.message : err);
  }

  return outbreaks;
}
