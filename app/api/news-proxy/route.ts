import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Proxy for Google News RSS to avoid CORS issues from browser
// Parses XML and returns JSON articles

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url || !url.startsWith('https://news.google.com/')) {
    return NextResponse.json({ articles: [] }, { status: 400 });
  }

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

    const articles: Array<{
      title: string;
      url: string;
      source: string;
      publishedAt: string | null;
    }> = [];

    $('item').each((_, el) => {
      const title = $(el).find('title').text()
        .replace(/<!\[CDATA\[(.+?)\]\]>/, '$1')
        .trim();
      const link = $(el).find('link').text().trim() || $(el).find('guid').text().trim();
      const pubDate = $(el).find('pubDate').text().trim();
      const source = $(el).find('source').text().trim() || 'News';

      if (title && link) {
        articles.push({
          title,
          url: link,
          source,
          publishedAt: pubDate ? new Date(pubDate).toISOString() : null,
        });
      }
    });

    return NextResponse.json({ articles: articles.slice(0, 8) }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch {
    return NextResponse.json({ articles: [] });
  }
}
