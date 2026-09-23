import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import prisma from '@/lib/db';

// Google News RSS search queries for outbreak news
const NEWS_QUERIES = [
  { query: 'disease outbreak epidemic 2026', category: 'media' as const },
  { query: 'WHO disease outbreak news', category: 'official' as const },
  { query: 'CDC outbreak alert', category: 'official' as const },
  { query: 'cholera outbreak', category: 'media' as const },
  { query: 'measles outbreak', category: 'media' as const },
  { query: 'mpox outbreak', category: 'media' as const },
  { query: 'dengue outbreak', category: 'media' as const },
  { query: 'Ebola outbreak', category: 'media' as const },
  { query: 'avian influenza bird flu', category: 'media' as const },
  { query: 'Marburg virus', category: 'media' as const },
];

interface NewsArticle {
  title: string;
  excerpt: string;
  url: string;
  source: string;
  publishedAt: string | null;
  imageUrl: string | null;
  disease: string | null;
  location: string | null;
  severity: string | null;
  category: 'official' | 'field' | 'media';
}

// ─── Fetch from Google News RSS ──────────────────────────────────────────────

async function fetchGoogleNews(
  entry: typeof NEWS_QUERIES[number],
): Promise<NewsArticle[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(entry.query)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const res = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EpiWatch/2.0)',
        Accept: 'application/rss+xml,application/xml,text/xml',
      },
      responseType: 'text',
    });

    const $ = cheerio.load(res.data as string, { xmlMode: true });
    const articles: NewsArticle[] = [];

    $('item').each((_, el) => {
      const title = $(el).find('title').text().replace(/<!\[CDATA\[(.+?)\]\]>/, '$1').trim();
      const link = $(el).find('link').text().trim() || $(el).find('guid').text().trim();
      const pubDate = $(el).find('pubDate').text().trim();
      const rawSource = $(el).find('source').text().trim() || 'News';
      const description = $(el).find('description').text().trim();

      const imageUrl = extractImage(description);
      const excerpt = extractExcerpt(description);

      if (title && link) {
        articles.push({
          title,
          excerpt,
          url: link,
          source: rawSource,
          publishedAt: pubDate ? new Date(pubDate).toISOString() : null,
          imageUrl,
          disease: extractDisease(title),
          location: extractLocation(title),
          severity: determineSeverity(title, description),
          category: classifyCategory(title, rawSource, entry.category),
        });
      }
    });

    return articles.slice(0, 5);
  } catch {
    return [];
  }
}

// ─── OG image fetcher ────────────────────────────────────────────────────────

// ─── Text extraction helpers ─────────────────────────────────────────────────

function extractExcerpt(html: string, maxLength = 160): string {
  const text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function extractImage(html: string): string | null {
  if (!html || !html.includes('<img')) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/);
  return match?.[1] || null;
}

function extractDisease(text: string): string | null {
  const diseases = [
    'Ebola', 'Marburg', 'COVID-19', 'Dengue', 'Malaria', 'Cholera',
    'Measles', 'Mpox', 'Monkeypox', 'Yellow Fever', 'Zika', 'Chikungunya',
    'Lassa Fever', 'Nipah', 'Influenza', 'Typhoid', 'Tuberculosis',
    'Avian Influenza', 'Pertussis', 'Oropouche', 'Polio',
  ];

  const lower = text.toLowerCase();
  for (const disease of diseases) {
    if (lower.includes(disease.toLowerCase())) return disease;
  }

  const aliases: Record<string, string> = {
    'bird flu': 'Avian Influenza', 'h5n1': 'Avian Influenza',
    'monkey pox': 'Mpox', 'monkeypox': 'Mpox',
    'coronavirus': 'COVID-19', 'covid': 'COVID-19',
    'whooping cough': 'Pertussis',
    'tb ': 'Tuberculosis',
    'yellow fever': 'Yellow Fever',
    'oropouche': 'Oropouche Fever',
  };
  for (const [alias, disease] of Object.entries(aliases)) {
    if (lower.includes(alias)) return disease;
  }

  return null;
}

function extractLocation(text: string): string | null {
  const countries = [
    'Congo', 'DRC', 'Nigeria', 'India', 'Brazil', 'USA', 'United States',
    'China', 'Haiti', 'Yemen', 'Syria', 'Pakistan', 'Bangladesh',
    'Tanzania', 'Kenya', 'Uganda', 'Thailand', 'Philippines', 'Vietnam',
    'Sudan', 'Ethiopia', 'Somalia', 'Mozambique', 'Malawi',
    'Afghanistan', 'Indonesia', 'Myanmar', 'Mexico', 'Colombia',
    'Peru', 'Argentina', 'South Africa', 'Egypt', 'Iraq',
  ];

  for (const country of countries) {
    if (text.includes(country)) return country;
  }
  return null;
}

function determineSeverity(title: string, content: string): string {
  const text = (title + ' ' + content).toLowerCase();

  if (text.includes('emergency') || text.includes('critical') ||
      (text.includes('outbreak') && text.includes('deaths'))) {
    return 'CRITICAL';
  }
  if (text.includes('spread') || text.includes('increasing') ||
      text.includes('alert')) {
    return 'HIGH';
  }
  if (text.includes('cases') || text.includes('reported')) {
    return 'MEDIUM';
  }
  return 'LOW';
}

// Official = published BY a health authority, judged on the publisher alone.
// The previous version also matched the headline ("who ", "official") and fell
// back to whichever search query returned the article, so a story ABOUT the
// WHO — or any headline containing "people who…" — was labelled Official, as
// were a medical journal and a news blog. Acronyms are matched case-sensitively
// as whole words, since "who" is also an ordinary English word.
const OFFICIAL_ACRONYM = /\b(WHO|CDC|PAHO|ECDC|UKHSA|FDA|NIH|NHS|NCDC|Africa CDC)\b/;
const OFFICIAL_NAME =
  /world health organi[sz]ation|centers for disease control|pan american health|european centre for disease|health security agency|ministry of health|department of health|who\.int|\bgov\.uk\b|\.gov(\.[a-z]{2})?\b/i;
const FIELD_SOURCE = /promed|reliefweb|m[ée]decins sans fronti[èe]res|doctors without borders|\bMSF\b|unicef|\bIFRC\b|red cross|international organi[sz]ation for migration|\bIOM\b|\bUNHCR\b/i;

function classifyCategory(
  _title: string,
  source: string,
  _fallback: 'official' | 'field' | 'media',
): 'official' | 'field' | 'media' {
  if (OFFICIAL_ACRONYM.test(source) || OFFICIAL_NAME.test(source)) return 'official';
  if (FIELD_SOURCE.test(source)) return 'field';
  return 'media';
}

// ─── GET handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') || 'all';
  const severityFilter = searchParams.get('severity') || 'all';

  try {
    // Pick 5 random queries to avoid rate limits
    const shuffled = NEWS_QUERIES.sort(() => Math.random() - 0.5).slice(0, 5);
    const results = await Promise.all(shuffled.map(fetchGoogleNews));
    let articles = results.flat();

    // Deduplicate by title prefix
    const seen = new Set<string>();
    articles = articles.filter((a) => {
      const key = a.title.toLowerCase().slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Enrich from DB
    const outbreaks = await prisma.outbreak.findMany({
      where: { isActive: true },
      select: { disease: true, country: true, severity: true },
    });

    const diseases = [...new Set(outbreaks.map((o) => o.disease))];
    const dbCountries = [...new Set(outbreaks.map((o) => o.country))];
    const diseaseSeverity: Record<string, string> = {};
    for (const o of outbreaks) {
      const existing = diseaseSeverity[o.disease];
      if (!existing || severityRank(o.severity) < severityRank(existing)) {
        diseaseSeverity[o.disease] = o.severity;
      }
    }

    for (const article of articles) {
      if (!article.disease) {
        const lower = article.title.toLowerCase();
        for (const d of diseases) {
          if (lower.includes(d.toLowerCase())) { article.disease = d; break; }
        }
      }
      if (article.disease && diseaseSeverity[article.disease]) {
        article.severity = diseaseSeverity[article.disease];
      }
      if (!article.location) {
        for (const c of dbCountries) {
          if (article.title.toLowerCase().includes(c.toLowerCase())) {
            article.location = c;
            break;
          }
        }
      }
    }

    // Apply filters
    if (filter !== 'all') {
      articles = articles.filter((a) => a.category === filter);
    }
    if (severityFilter !== 'all') {
      articles = articles.filter((a) => a.severity === severityFilter.toUpperCase());
    }

    // Sort by date (newest first)
    articles.sort((a, b) => {
      if (!a.publishedAt) return 1;
      if (!b.publishedAt) return -1;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    return NextResponse.json({
      articles: articles.slice(0, 50),
      meta: {
        totalFetched: articles.length,
        sources: shuffled.length,
        timestamp: new Date().toISOString(),
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (err) {
    console.error('[/api/news/live-feed]', err);
    return NextResponse.json({ articles: [], meta: {} }, { status: 500 });
  }
}

function severityRank(s: string): number {
  return s === 'CRITICAL' ? 0 : s === 'HIGH' ? 1 : s === 'MEDIUM' ? 2 : 3;
}
