/**
 * Multi-language RSS scraper.
 *
 * Sources:
 *  - WHO Disease Outbreak News RSS (EN/FR/ES/AR/ZH/RU)
 *  - WHO Health Emergency Preparedness & Response RSS
 *  - CDC Health Alerts RSS
 *  - ProMED RSS
 *  - ReliefWeb disease alerts RSS
 *  - Google News RSS (multilingual outbreak search)
 *
 * All non-English items are translated using OpenAI if an API key is set.
 * Otherwise they are stored with the original headline + language tag.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { ScrapedOutbreak } from '../types';
import { getCountryCoords } from '../countryCoords';
import { getRegionForCountry, detectTrend } from '../classifiers';

// ─── Feed definitions ──────────────────────────────────────────────────────
const RSS_FEEDS: Array<{
  url: string;
  lang: string;
  source: string;
  verified: boolean;
}> = [
  // PAHO — Pan American Health Organization (works as of 2026)
  { url: 'https://www.paho.org/en/rss.xml', lang: 'en', source: 'PAHO', verified: true },
  { url: 'https://www.paho.org/es/rss.xml', lang: 'es', source: 'PAHO', verified: true },
  { url: 'https://www.paho.org/pt/rss.xml', lang: 'pt', source: 'PAHO', verified: true },
  // CDC MMWR — Morbidity and Mortality Weekly Report
  { url: 'https://www.cdc.gov/mmwr/rss/mmwr_weekly.xml', lang: 'en', source: 'CDC', verified: true },
  // WHO news (general news feed, includes DON items)
  { url: 'https://www.who.int/rss-feeds/news-releases.xml', lang: 'en', source: 'WHO', verified: true },
];

// Google News RSS queries — disease-specific and regional
const GNEWS_QUERIES: Array<{ query: string; lang: string; country: string }> = [
  // English — disease-specific
  { query: 'cholera+outbreak+cases+deaths', lang: 'en', country: 'US' },
  { query: 'mpox+monkeypox+outbreak+spread', lang: 'en', country: 'US' },
  { query: 'dengue+fever+outbreak+cases', lang: 'en', country: 'US' },
  { query: 'ebola+marburg+hemorrhagic+fever+outbreak', lang: 'en', country: 'US' },
  { query: 'avian+flu+H5N1+bird+flu+cases', lang: 'en', country: 'US' },
  { query: 'disease+outbreak+WHO+emergency+alert', lang: 'en', country: 'US' },
  // Regional English
  { query: 'disease+outbreak+Africa+epidemic+cases', lang: 'en', country: 'KE' },
  { query: 'epidemic+Asia+health+alert+cases', lang: 'en', country: 'SG' },
  { query: 'disease+outbreak+Latin+America', lang: 'en', country: 'MX' },
  // French
  { query: 'épidémie+maladie+urgence+sanitaire', lang: 'fr', country: 'FR' },
  // Spanish
  { query: 'brote+enfermedad+emergencia+salud', lang: 'es', country: 'MX' },
  // Portuguese
  { query: 'surto+doença+emergência+saúde', lang: 'pt', country: 'BR' },
  // Arabic
  { query: 'تفشي+مرض+طوارئ+صحية', lang: 'ar', country: 'SA' },
  // Chinese
  { query: '疾病暴发+公共卫生+紧急情况', lang: 'zh', country: 'CN' },
];

// ─── Country extraction from headlines ────────────────────────────────────

// Common disease keywords across languages
const DISEASE_KEYWORDS_MULTILANG: Record<string, string[]> = {
  // English
  en: ['cholera', 'ebola', 'mpox', 'monkeypox', 'dengue', 'measles', 'typhoid', 'malaria',
    'plague', 'anthrax', 'rabies', 'yellow fever', 'lassa', 'nipah', 'marburg', 'hantavirus',
    'polio', 'influenza', 'avian flu', 'h5n1', 'mers', 'sars', 'covid', 'zika', 'rift valley',
    'west nile', 'meningitis', 'hepatitis', 'brucellosis', 'salmonella', 'e. coli', 'listeria'],
  fr: ['choléra', 'ébola', 'variole du singe', 'dengue', 'rougeole', 'typhoïde', 'paludisme',
    'peste', 'fièvre jaune', 'méningite', 'grippe', 'grippe aviaire', 'hépatite'],
  es: ['cólera', 'ébola', 'viruela del mono', 'dengue', 'sarampión', 'tifoidea', 'paludismo',
    'plague', 'fiebre amarilla', 'meningitis', 'gripe', 'hepatitis', 'listeria'],
  ar: ['كوليرا', 'إيبولا', 'جدري', 'حمى الضنك', 'حصبة', 'تيفوئيد', 'ملاريا', 'طاعون', 'إنفلونزا'],
  zh: ['霍乱', '埃博拉', '猴痘', '登革热', '麻疹', '伤寒', '疟疾', '鼠疫', '黄热病', '流感'],
  ru: ['холера', 'эбола', 'оспа', 'лихорадка', 'корь', 'тиф', 'малярия', 'чума', 'грипп'],
  pt: ['cólera', 'ébola', 'varíola', 'dengue', 'sarampo', 'tifoide', 'malária', 'hepatite'],
  de: ['cholera', 'ebola', 'affenpocken', 'dengue', 'masern', 'typhus', 'malaria', 'influenza'],
};

function extractDiseaseFromTitle(title: string, lang: string): string | null {
  const lower = title.toLowerCase();
  const keywords = DISEASE_KEYWORDS_MULTILANG[lang] || DISEASE_KEYWORDS_MULTILANG.en;

  for (const kw of keywords) {
    if (lower.includes(kw)) {
      // Try to get proper casing from the title
      const idx = lower.indexOf(kw);
      const raw = title.slice(idx, idx + kw.length);
      return raw.split(' ').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ');
    }
  }
  return null;
}

// Country extraction: look for known country names after common prepositions
function extractCountryFromTitle(title: string): string | null {
  const COUNTRY_PATTERNS = [
    // After "in": "outbreak in Kenya", "surge in Brazil"
    // Capture at most 4 capitalized words to avoid grabbing full sentences
    /\bin\s+([A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+){0,3})(?:\s*[,\.;–\-\s]|$)/,
    // After "—" or "-": "Cholera — Yemen"
    /[—\-]\s*([A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+){0,3})(?:\s*[,\.;]|$)/,
    // WHO title format: "Disease - Country" (first segment before dash is disease)
    /^[^—\-]+[—\-]\s*([A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+){0,3})/,
  ];

  for (const pattern of COUNTRY_PATTERNS) {
    const match = title.match(pattern);
    if (match) {
      const candidate = match[1].trim().replace(/\s+/g, ' ');
      // Must be 1-4 words and start with capital — avoids full sentences
      const wordCount = candidate.split(' ').length;
      if (candidate.length > 2 && wordCount <= 4 && /^[A-Z]/.test(candidate)) {
        // Check against our known coordinates (exact or alias match)
        const coords = getCountryCoords(candidate);
        if (coords) return candidate;
      }
    }
  }
  return null;
}

// ─── AI translation via Anthropic Claude ──────────────────────────────────

async function translateToEnglish(text: string, lang: string): Promise<string> {
  if (lang === 'en' || !text) return text;
  if (!process.env.ANTHROPIC_API_KEY) return text;

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content:
          `Translate this disease outbreak headline from ${lang} to English. ` +
          `Output ONLY the translated text. Preserve disease names, country names, and numbers exactly.\n\n${text}`,
      }],
    });
    const block = msg.content.find((b) => b.type === 'text');
    return (block as { type: 'text'; text: string } | undefined)?.text?.trim() || text;
  } catch {
    return text; // Fallback to original on any error
  }
}

// ─── Parse RSS XML ─────────────────────────────────────────────────────────

interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
}

function parseRSSFeed(xml: string): RSSItem[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items: RSSItem[] = [];

  $('item').each((_, el) => {
    const title = $(el).find('title').text().replace(/<!\[CDATA\[(.+?)\]\]>/, '$1').trim();
    const link =
      $(el).find('link').text().trim() ||
      $(el).find('guid').text().trim();
    const pubDate = $(el).find('pubDate').text().trim();
    const description = $(el)
      .find('description')
      .text()
      .replace(/<!\[CDATA\[(.+?)\]\]>/s, '$1')
      .replace(/<[^>]+>/g, '') // strip HTML tags
      .trim()
      .slice(0, 500);

    if (title && link) {
      items.push({ title, link, pubDate, description });
    }
  });

  return items;
}

// ─── Main scraper ──────────────────────────────────────────────────────────

async function fetchFeed(url: string): Promise<string | null> {
  try {
    const res = await axios.get(url, {
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EpiWatch/2.0)',
        Accept: 'application/rss+xml,application/xml,text/xml',
      },
      responseType: 'text',
    });
    return res.data as string;
  } catch (err) {
    console.warn(`[RSS] Fetch failed for ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function scrapeRSSFeeds(): Promise<ScrapedOutbreak[]> {
  const outbreaks: ScrapedOutbreak[] = [];

  // ── Static RSS feeds ────────────────────────────────────────────────────
  const feedResults = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const xml = await fetchFeed(feed.url);
      if (!xml) return [];

      const items = parseRSSFeed(xml);
      const results: ScrapedOutbreak[] = [];

      for (const item of items.slice(0, 20)) {
        const titleEn = await translateToEnglish(item.title, feed.lang);
        const disease = extractDiseaseFromTitle(titleEn, 'en') ||
          extractDiseaseFromTitle(item.title, feed.lang) ||
          'Unknown Disease';

        const country = extractCountryFromTitle(titleEn) ||
          extractCountryFromTitle(item.title) ||
          'Unknown';

        if (country === 'Unknown') continue;

        const coords = getCountryCoords(country);
        const reportDate = item.pubDate ? new Date(item.pubDate) : new Date();

        results.push({
          disease,
          country,
          region: getRegionForCountry(country),
          lat: coords?.[0],
          lng: coords?.[1],
          cases: 0,
          deaths: 0,
          trend: detectTrend(item.description),
          summary: item.description.slice(0, 400) || undefined,
          sourceUrl: item.link,
          sourceName: feed.source,
          reportDate: isNaN(reportDate.getTime()) ? new Date() : reportDate,
          // Extra fields passed through
          ...({ verified: feed.verified, language: feed.lang, titleOrig: feed.lang !== 'en' ? item.title : undefined } as object),
        });
      }

      return results;
    })
  );

  for (const r of feedResults) {
    if (r.status === 'fulfilled') outbreaks.push(...r.value);
  }

  // ── Google News RSS (multilingual) ─────────────────────────────────────
  const gnewsResults = await Promise.allSettled(
    GNEWS_QUERIES.map(async ({ query, lang, country: gc }) => {
      const url = `https://news.google.com/rss/search?q=${query}&hl=${lang}-${gc}&gl=${gc}&ceid=${gc}:${lang}`;
      const xml = await fetchFeed(url);
      if (!xml) return [];

      const items = parseRSSFeed(xml);
      const results: ScrapedOutbreak[] = [];

      for (const item of items.slice(0, 10)) {
        const titleEn = await translateToEnglish(item.title, lang);
        const disease = extractDiseaseFromTitle(titleEn, 'en') ||
          extractDiseaseFromTitle(item.title, lang);
        if (!disease) continue;

        const country = extractCountryFromTitle(titleEn) ||
          extractCountryFromTitle(item.title);
        if (!country) continue;

        const coords = getCountryCoords(country);
        const reportDate = item.pubDate ? new Date(item.pubDate) : new Date();

        results.push({
          disease,
          country,
          region: getRegionForCountry(country),
          lat: coords?.[0],
          lng: coords?.[1],
          cases: 0,
          deaths: 0,
          trend: detectTrend(item.description),
          sourceUrl: item.link,
          sourceName: `News/${lang.toUpperCase()}`,
          reportDate: isNaN(reportDate.getTime()) ? new Date() : reportDate,
          ...({ verified: false, language: lang, titleOrig: lang !== 'en' ? item.title : undefined } as object),
        });
      }

      return results;
    })
  );

  for (const r of gnewsResults) {
    if (r.status === 'fulfilled') outbreaks.push(...r.value);
  }

  console.log(`[RSS] Collected ${outbreaks.length} items from feeds`);
  return outbreaks;
}
