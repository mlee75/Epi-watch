'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { VideoIntelSidebar } from '@/components/VideoIntelSidebar';
import { fmtDateShort } from '@/lib/format';

interface NewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  disease: string | null;
  severity: string | null;
  location: string | null;
  category: 'official' | 'field' | 'media';
  imageUrl?: string | null;
  excerpt?: string | null;
}

interface FeedResponse {
  articles: NewsArticle[];
  meta: { totalFetched: number; timestamp: string };
}

type FilterType = 'all' | 'official' | 'field' | 'media';

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'official', label: 'Health agencies' },
  { value: 'field', label: 'Field organisations' },
  { value: 'media', label: 'Media' },
];

const CATEGORY_LABEL: Record<NewsArticle['category'], string> = {
  official: 'Health agency',
  field: 'Field organisation',
  media: 'Media',
};

function ago(iso: string | null): string {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return fmtDateShort(iso);
}

/**
 * Outbreak news, as a text-first list.
 *
 * Removed from the previous version:
 *  - per-article severity badges. They came from keywords ("emergency", or
 *    "outbreak" plus "deaths" = CRITICAL) but used the same visual language as
 *    record severity, which is threshold-based, so a guess read as a measurement.
 *  - the "Breaking" banner, which showed the first critical-severity database
 *    record — an outbreak running since 2016 — rather than breaking news.
 *  - five-minute auto-refresh; the upstream feed is cached for five minutes, so
 *    there is a manual refresh and a fetched-at time instead.
 */
export default function LiveNewsFeed() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [query, setQuery] = useState('');
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/news/live-feed?${new URLSearchParams({ filter })}`);
      if (!res.ok) return;
      const data: FeedResponse = await res.json();
      setArticles(data.articles ?? []);
      setFetchedAt(data.meta?.timestamp ?? new Date().toISOString());
    } catch {
      /* keep the previous list */
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) =>
      `${a.title} ${a.disease ?? ''} ${a.location ?? ''} ${a.source}`.toLowerCase().includes(q)
    );
  }, [articles, query]);

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Outbreak news</h1>
        <p className="page-lede">
          Recent coverage of infectious disease outbreaks, collected from Google News searches and
          grouped by publisher type. Articles are listed as found — they are not verified or
          deduplicated, and appearing here does not make a report accurate.
        </p>
      </header>

      <div className="news-layout">
        <section aria-label="Articles">
          <div className="ob-toolbar">
            <div className="ob-seg" role="group" aria-label="Publisher type">
              {FILTERS.map((f) => (
                <button key={f.value} type="button" className="chip" aria-pressed={filter === f.value}
                  onClick={() => setFilter(f.value)}>
                  {f.label}
                </button>
              ))}
            </div>
            <input className="input ob-search" type="search" placeholder="Search headlines"
              value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search headlines" />
            <button type="button" className="btn" onClick={fetchNews} disabled={loading}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          <div className="ob-summary">
            <span><strong>{shown.length}</strong> articles</span>
            {fetchedAt && <span className="muted">Fetched {ago(fetchedAt)}</span>}
          </div>

          <div className="panel">
            {loading && articles.length === 0 ? (
              <p className="muted" style={{ padding: 20 }}>Loading…</p>
            ) : shown.length === 0 ? (
              <p className="muted" style={{ padding: 20 }}>No articles match.</p>
            ) : (
              <ol className="news-list">
                {shown.map((a, i) => (
                  <li key={`${a.url}-${i}`}>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="news-title">
                      {a.title}
                    </a>
                    <div className="news-meta">
                      <span>{a.source}</span>
                      {a.publishedAt && <span>{ago(a.publishedAt)}</span>}
                      <span className="tag">{CATEGORY_LABEL[a.category]}</span>
                      {a.disease && <span className="tag">{a.disease}</span>}
                      {a.location && <span className="tag">{a.location}</span>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            &ldquo;Health agency&rdquo; means the publisher is a public health body such as WHO or
            CDC, judged by the publisher, not by whether the headline mentions one.
          </p>
        </section>

        <VideoIntelSidebar />
      </div>
    </div>
  );
}
