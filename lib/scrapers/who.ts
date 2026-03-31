import axios from 'axios';
import * as cheerio from 'cheerio';
import type { ScrapedOutbreak } from '../types';
import { getCountryCoords } from '../countryCoords';
import { getRegionForCountry, detectTrend } from '../classifiers';

const WHO_BASE = 'https://www.who.int';

// PAHO Epidemiological Alerts page — regularly updated, verified HTML (2026-03-31)
const PAHO_ALERTS_URL = 'https://www.paho.org/en/epidemiological-alerts-and-updates';

// WHO DON page — fallback HTML scrape
const WHO_DON_URL = 'https://www.who.int/emergencies/disease-outbreak-news';

function parseWHOTitle(title: string): { disease: string; country: string } | null {
  // Formats: "Cholera - Yemen", "Mpox — Democratic Republic of the Congo"
  const match = title.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (!match) return null;
  const country = match[2].trim().split(',')[0].trim();
  return { disease: match[1].trim(), country };
}

// Known disease keywords for validation
const DISEASE_KEYWORDS = [
  'cholera', 'ebola', 'mpox', 'monkeypox', 'dengue', 'measles', 'typhoid', 'malaria',
  'plague', 'anthrax', 'rabies', 'yellow fever', 'lassa', 'nipah', 'marburg', 'hantavirus',
  'polio', 'influenza', 'avian', 'h5n1', 'mers', 'sars', 'covid', 'zika', 'rift valley',
  'west nile', 'meningitis', 'hepatitis', 'brucellosis', 'salmonella', 'e. coli', 'listeria',
  'chikungunya', 'oropouche', 'diphtheria', 'pertussis', 'whooping', 'leprosy', 'tuberculosis',
  'monkeypox', 'marburg', 'virus', 'fever', 'outbreak', 'syndrome',
];

function containsDisease(text: string): boolean {
  const lower = text.toLowerCase();
  return DISEASE_KEYWORDS.some((kw) => lower.includes(kw));
}

// Parse PAHO Epidemiological Alert titles
// Examples:
//   "Epidemiological Update Pertussis (Whooping Cough) in the Americas Region - 25 March 2026"
//   "Epidemiological Alert: Yellow fever in the Americas Region - 13 March 2026."
//   "Epidemiological Alert Chikungunya - 10 February 2026"
//   "Epidemiological Alert Hantavirus Pulmonary Syndrome in Americas Region - 19 December 2025"
function parsePAHOTitle(raw: string): { disease: string; country: string } | null {
  // 1. Skip non-disease items
  const lower = raw.toLowerCase();
  if (
    lower.startsWith('briefing note') ||
    lower.includes('misuse of') ||
    lower.includes('prevention and control') ||
    lower.includes('organizational chart') ||
    lower.includes('considerations for') ||
    !containsDisease(lower)
  ) {
    return null;
  }

  // 2. Strip "Epidemiological (Alert|Update)[:| -]?" prefix
  let title = raw
    .replace(/^Epidemiological\s+(Alert|Update|Report)\s*[:–\-]?\s*/i, '')
    .replace(/^Briefing\s+(Note|Report)\s*[:–\-]?\s*/i, '')
    .trim();

  // 3. Strip trailing date " - DD Month YYYY" or "(DD Month YYYY)"
  title = title
    .replace(/\s*[-–]\s*\d{1,2}\s+\w+\s+\d{4}\.?\s*$/, '')
    .replace(/\s*\(\d{1,2}\s+\w+\s+\d{4}\)\s*$/, '')
    .trim();

  // 4. Handle "Disease in Country/Region" format
  const inMatch = title.match(/^(.+?)\s+in\s+(?:the\s+)?(.+)$/i);
  if (inMatch) {
    let disease = inMatch[1].trim();
    let country = inMatch[2].trim();

    // Strip parenthetical synonyms: "Pertussis (Whooping Cough)" → "Pertussis"
    disease = disease.replace(/\s*\([^)]+\)/g, '').trim();

    // Normalize regional terms → "Multiple Countries"
    if (/americas?|region|global|worldwide|pan[-\s]american/i.test(country)) {
      country = 'Multiple Countries';
    } else {
      // Try to get the primary country from a list
      country = country.split(/\s+and\s+/i)[0].split(',')[0].trim();
    }

    if (!containsDisease(disease)) return null;
    return { disease, country };
  }

  // 5. Simple disease name (no country) — treat as Americas/Multiple
  const cleaned = title.replace(/\s*\([^)]+\)/g, '').trim();
  if (cleaned.length > 3 && containsDisease(cleaned)) {
    return { disease: cleaned, country: 'Multiple Countries' };
  }

  return null;
}

export async function scrapeWHO(): Promise<ScrapedOutbreak[]> {
  const outbreaks: ScrapedOutbreak[] = [];

  // ── Strategy 1: PAHO Epidemiological Alerts HTML ──────────────────────
  try {
    const res = await axios.get(PAHO_ALERTS_URL, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const $ = cheerio.load(res.data);

    // PAHO alert links point to /en/documents/...
    $('a[href*="/en/documents/"]').each((_, el) => {
      try {
        const title = $(el).text().trim();
        if (title.length < 10) return;

        const href = $(el).attr('href') || '';
        if (!href) return;

        const sourceUrl = href.startsWith('http')
          ? href
          : `https://www.paho.org${href}`;

        const parsed = parsePAHOTitle(title);
        if (!parsed) return;

        const { disease, country } = parsed;
        if (!disease || disease.length < 3) return;

        const coords = getCountryCoords(country);

        // Try to parse date from title
        const dateMatch = title.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
        const reportDate = dateMatch ? new Date(`${dateMatch[2]} ${dateMatch[1]}, ${dateMatch[3]}`) : new Date();

        outbreaks.push({
          disease,
          country,
          region: getRegionForCountry(country),
          lat: coords?.[0],
          lng: coords?.[1],
          cases: 0,
          deaths: 0,
          recovered: 0,
          trend: 'stable',
          sourceUrl,
          sourceName: 'PAHO',
          reportDate: isNaN(reportDate.getTime()) ? new Date() : reportDate,
          verified: true,
          language: 'en',
        });
      } catch {
        // Skip
      }
    });

    if (outbreaks.length > 0) {
      console.log(`[WHO/PAHO] Got ${outbreaks.length} items from PAHO alerts`);
      return outbreaks;
    }
  } catch (err) {
    console.warn('[WHO/PAHO] PAHO alerts failed:', err instanceof Error ? err.message : err);
  }

  // ── Strategy 2: WHO DON HTML (best-effort cheerio parse) ───────────────
  try {
    const response = await axios.get(WHO_DON_URL, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: 'https://www.google.com/',
      },
    });

    const $ = cheerio.load(response.data);
    const articleLinks: { href: string; title: string; date: string }[] = [];

    $('a[href*="disease-outbreak-news/item"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const title =
        $(el).find('h3, h4, span, div').first().text().trim() ||
        $(el).text().trim();
      const date = $(el).find('time').attr('datetime') || '';
      if (href && title && title.includes('-')) {
        articleLinks.push({ href, title, date });
      }
    });

    for (const article of articleLinks.slice(0, 15)) {
      try {
        const parsed = parseWHOTitle(article.title);
        if (!parsed) continue;

        const { disease, country } = parsed;
        const coords = getCountryCoords(country);
        const sourceUrl = article.href.startsWith('http')
          ? article.href
          : `${WHO_BASE}${article.href}`;

        const reportDate = article.date ? new Date(article.date) : new Date();

        outbreaks.push({
          disease,
          country,
          region: getRegionForCountry(country),
          lat: coords?.[0],
          lng: coords?.[1],
          cases: 0,
          deaths: 0,
          recovered: 0,
          trend: 'stable',
          sourceUrl,
          sourceName: 'WHO',
          reportDate: isNaN(reportDate.getTime()) ? new Date() : reportDate,
          verified: true,
          language: 'en',
        });
      } catch {
        // Skip
      }
    }

    console.log(`[WHO] Got ${outbreaks.length} items from DON HTML`);
  } catch (err) {
    console.error('[WHO] All strategies failed:', err instanceof Error ? err.message : err);
  }

  return outbreaks;
}
