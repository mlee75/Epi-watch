import axios from 'axios';
import * as cheerio from 'cheerio';
import type { ScrapedOutbreak } from '../types';
import { getCountryCoords } from '../countryCoords';
import { getRegionForCountry, detectTrend } from '../classifiers';

function parseNumber(str: string): number {
  if (!str) return 0;
  return parseInt(str.replace(/[\s,]/g, ''), 10) || 0;
}

// CDC Travel Health Notices — clean "Disease in Country" format
// Returns 200 with real HTML content (verified 2026-03-31)
// Links: /travel/notices/level1|2|3/disease-country
const CDC_TRAVEL_URL = 'https://wwwnc.cdc.gov/travel/notices';

// Parse "Disease in Country" or "Disease in Country1 and Country2"
function parseTravelNoticeTitle(title: string): { disease: string; country: string } | null {
  // Format 1: "Disease in Country"
  const inMatch = title.match(/^(.+?)\s+in\s+(.+)$/i);
  if (inMatch) {
    const disease = inMatch[1].trim();
    // Take first country if multiple ("Ghana and Liberia" → "Ghana")
    const country = inMatch[2].trim().split(/\s+and\s+/i)[0].trim().split(',')[0].trim();
    return { disease, country };
  }

  // Format 2: "Global Disease" — no "in"
  const globalMatch = title.match(/^(?:Global\s+|Worldwide\s+)?(.+)$/i);
  if (globalMatch) {
    return { disease: globalMatch[1].trim(), country: 'Multiple Countries' };
  }

  return null;
}

export async function scrapeCDC(): Promise<ScrapedOutbreak[]> {
  const outbreaks: ScrapedOutbreak[] = [];

  // ── CDC Travel Health Notices ─────────────────────────────────────────
  try {
    const response = await axios.get(CDC_TRAVEL_URL, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const $ = cheerio.load(response.data);

    // Target specifically the travel notice links (/travel/notices/level1|2|3/...)
    $('a[href*="/travel/notices/level"]').each((_, el) => {
      try {
        const title = $(el).text().trim();
        if (!title || title.length < 5 || title.toLowerCase().includes('read more')) return;

        const href = $(el).attr('href') || '';
        const sourceUrl = href.startsWith('http')
          ? href
          : `https://wwwnc.cdc.gov${href}`;

        const parsed = parseTravelNoticeTitle(title);
        if (!parsed) return;

        const { disease, country } = parsed;
        if (!disease || disease.length < 3) return;

        const coords = getCountryCoords(country);

        // Determine level from URL (level1=watch, level2=alert, level3=warning)
        let cases = 0;
        let deaths = 0;

        outbreaks.push({
          disease,
          country,
          region: getRegionForCountry(country),
          lat: coords?.[0],
          lng: coords?.[1],
          cases,
          deaths,
          recovered: 0,
          trend: 'stable',
          sourceUrl,
          sourceName: 'CDC',
          reportDate: new Date(),
          verified: true,
          language: 'en',
        });
      } catch {
        // Skip
      }
    });

    console.log(`[CDC] Got ${outbreaks.length} items from Travel Notices`);
  } catch (err) {
    console.error('[CDC] Travel Notices failed:', err instanceof Error ? err.message : err);
  }

  return outbreaks;
}
