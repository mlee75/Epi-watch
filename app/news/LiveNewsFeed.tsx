'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface BreakingInfo {
  disease: string;
  country: string;
  severity: string;
}

interface FeedResponse {
  articles: NewsArticle[];
  breaking: BreakingInfo | null;
  meta: { totalFetched: number; timestamp: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEV_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: 'rgba(239,68,68,0.4)' },
  HIGH:     { bg: 'rgba(249,115,22,0.15)', text: '#f97316', border: 'rgba(249,115,22,0.4)' },
  MEDIUM:   { bg: 'rgba(234,179,8,0.15)',  text: '#eab308', border: 'rgba(234,179,8,0.4)' },
  LOW:      { bg: 'rgba(34,197,94,0.15)',  text: '#22c55e', border: 'rgba(34,197,94,0.4)' },
};

const CAT_LABEL: Record<string, { label: string; color: string }> = {
  official: { label: 'Official', color: '#60a5fa' },
  field:    { label: 'Field',    color: '#a78bfa' },
  media:    { label: 'Media',    color: '#94a3b8' },
};

type FilterType = 'all' | 'official' | 'field' | 'media';

// ─── Component ────────────────────────────────────────────────────────────────

export default function LiveNewsFeed() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [breaking, setBreaking] = useState<BreakingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    try {
      const params = new URLSearchParams({ filter });
      const res = await fetch(`/api/news/live-feed?${params}`);
      if (!res.ok) return;
      const data: FeedResponse = await res.json();
      setArticles(data.articles ?? []);
      setBreaking(data.breaking ?? null);
      setLastUpdated(data.meta?.timestamp ?? new Date().toISOString());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    fetchNews();
  }, [fetchNews]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchNews, 5 * 60_000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchNews]);

  // Client-side search filter
  const filtered = searchQuery
    ? articles.filter(a => {
        const q = searchQuery.toLowerCase();
        return a.title.toLowerCase().includes(q) ||
          (a.disease ?? '').toLowerCase().includes(q) ||
          (a.location ?? '').toLowerCase().includes(q) ||
          a.source.toLowerCase().includes(q);
      })
    : articles;

  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(239,68,68,0.08) 0%, transparent 70%)' }}
        />
        <div className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                  <span className="relative inline-flex w-2.5 h-2.5">
                    <span className="animate-ping absolute inset-0 rounded-full bg-red-500 opacity-75" />
                    <span className="relative w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                  </span>
                  <span style={{
                    fontSize: 11, color: '#ef4444', fontWeight: 800,
                    fontFamily: 'var(--font-mono), Space Mono, monospace',
                    letterSpacing: '0.12em',
                  }}>LIVE UPDATES</span>
                </div>
              </div>
              <h1 style={{
                fontSize: 42, fontWeight: 800, color: '#ffffff',
                letterSpacing: '0.01em', lineHeight: 1.1,
              }}>
                Global Outbreak <span style={{ color: '#ef4444' }}>News</span>
              </h1>
              <p style={{ fontSize: 14, color: 'rgba(148,163,184,0.8)', marginTop: 10, maxWidth: 540, lineHeight: 1.7 }}>
                Real-time reports, official statements, and field updates from outbreak zones worldwide.
                Aggregated from WHO, CDC, ProMED, Reuters, BBC, and more.
              </p>
            </div>
            {lastUpdated && (
              <div className="flex items-center gap-2 text-xs flex-shrink-0" style={{ color: '#6b7280', fontFamily: 'var(--font-mono), monospace' }}>
                Last updated: {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Sticky filter bar ──────────────────────────────────────────── */}
      <div className="sticky top-14 z-30" style={{
        background: 'rgba(2,8,23,0.85)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-wrap items-center gap-3">

            {/* Category filters */}
            {([
              ['all', 'All News'],
              ['official', 'Official Reports'],
              ['field', 'Field Reports'],
              ['media', 'Media Coverage'],
            ] as [FilterType, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: filter === key ? 700 : 500,
                  color: filter === key ? '#fff' : 'rgba(148,163,184,0.8)',
                  background: filter === key ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.05)',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            ))}

            <div className="flex-1" />

            {/* Search */}
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: '#6b7280' }}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search articles..."
                style={{
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8, color: '#fff', fontSize: 13, padding: '7px 12px 7px 34px',
                  outline: 'none', width: 220, transition: 'border-color 0.15s',
                }}
              />
            </div>

            {/* Auto-refresh */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => setAutoRefresh(e.target.checked)}
                style={{ accentColor: '#60a5fa' }}
              />
              <span style={{ fontSize: 12, color: '#6b7280' }}>Auto-refresh</span>
            </label>

            <button
              onClick={() => { setLoading(true); fetchNews(); }}
              style={{
                padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#a0a8c8',
                background: 'rgba(255,255,255,0.04)', transition: 'all 0.15s',
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Breaking news banner */}
        {breaking && (
          <div
            className="mb-8 rounded-xl p-5 flex items-start gap-4"
            style={{
              background: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(249,115,22,0.08) 100%)',
              borderLeft: '4px solid #ef4444',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            <span style={{ fontSize: 22, flexShrink: 0 }}>🚨</span>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                Breaking: Active {breaking.disease} outbreak — {breaking.country}
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(148,163,184,0.8)', lineHeight: 1.6 }}>
                A {breaking.severity.toLowerCase()}-severity {breaking.disease} outbreak is currently active in {breaking.country}.
                Monitor the latest reports below for real-time updates.
              </p>
              <span style={{
                display: 'inline-block', marginTop: 8,
                fontSize: 10, fontWeight: 700, color: '#ef4444',
                fontFamily: 'var(--font-mono), monospace',
                letterSpacing: '0.1em',
              }}>
                {breaking.severity} SEVERITY
              </span>
            </div>
          </div>
        )}

        {/* Article count */}
        <div className="flex items-center justify-between mb-6">
          <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'var(--font-mono), monospace' }}>
            <span style={{ color: '#a0a8c8', fontWeight: 700 }}>{filtered.length}</span> articles
            {filter !== 'all' && ` · ${filter}`}
            {searchQuery && ` · "${searchQuery}"`}
          </span>
        </div>

        {/* Loading skeleton */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden" style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <div style={{ height: 180, background: '#0d1129', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div className="p-5">
                  <div style={{ height: 14, background: '#141938', borderRadius: 4, marginBottom: 10, width: '80%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ height: 14, background: '#141938', borderRadius: 4, marginBottom: 10, width: '60%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ height: 10, background: '#141938', borderRadius: 4, width: '40%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((article, i) => (
              <ArticleCard key={`${article.url}-${i}`} article={article} featured={i === 0} index={i} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl p-12 text-center" style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          }}>
            <p style={{ fontSize: 16, color: '#6b7280', marginBottom: 6 }}>No articles found</p>
            <p style={{ fontSize: 13, color: '#4b5563' }}>Try a different filter or search term</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </>
  );
}

// ─── Article Card ─────────────────────────────────────────────────────────────

// Disease-themed images from Unsplash — multiple per disease for variety
const DISEASE_IMAGES: Record<string, string[]> = {
  Ebola:             ['photo-1584036561566-baf8f5f1b144', 'photo-1579154204601-01588f351e67', 'photo-1578307992406-0af5a5ceab21'],
  Marburg:           ['photo-1579154204601-01588f351e67', 'photo-1578307992406-0af5a5ceab21', 'photo-1584036561566-baf8f5f1b144'],
  'COVID-19':        ['photo-1584483766114-2cea6facdf57', 'photo-1585559604959-6388fe69c92a', 'photo-1583947215259-38e31be8751f'],
  Dengue:            ['photo-1597429044777-f53b85f28e93', 'photo-1581093588401-fbb62a02f120', 'photo-1576091160550-2173dba999ef'],
  Malaria:           ['photo-1581093588401-fbb62a02f120', 'photo-1597429044777-f53b85f28e93', 'photo-1576091160550-2173dba999ef'],
  Cholera:           ['photo-1527613426441-4da17471b66d', 'photo-1516549655169-df83a0774514', 'photo-1551076805-e1869033e561'],
  Measles:           ['photo-1631549916768-4119b2e5f926', 'photo-1585559604959-6388fe69c92a', 'photo-1532938911079-1b06ac7ceec7'],
  Mpox:              ['photo-1584036561566-baf8f5f1b144', 'photo-1578307992406-0af5a5ceab21', 'photo-1576091160550-2173dba999ef'],
  Monkeypox:         ['photo-1584036561566-baf8f5f1b144', 'photo-1578307992406-0af5a5ceab21', 'photo-1576091160550-2173dba999ef'],
  'Yellow Fever':    ['photo-1597429044777-f53b85f28e93', 'photo-1576091160550-2173dba999ef', 'photo-1581093588401-fbb62a02f120'],
  Influenza:         ['photo-1584483766114-2cea6facdf57', 'photo-1583947215259-38e31be8751f', 'photo-1585559604959-6388fe69c92a'],
  'Avian Influenza': ['photo-1548550023-2bdb3c5beed7', 'photo-1584483766114-2cea6facdf57', 'photo-1583947215259-38e31be8751f'],
  Tuberculosis:      ['photo-1530026405186-ed1f139313f8', 'photo-1516549655169-df83a0774514', 'photo-1527613426441-4da17471b66d'],
  Pertussis:         ['photo-1631549916768-4119b2e5f926', 'photo-1532938911079-1b06ac7ceec7', 'photo-1585559604959-6388fe69c92a'],
  Polio:             ['photo-1631549916768-4119b2e5f926', 'photo-1532938911079-1b06ac7ceec7', 'photo-1585559604959-6388fe69c92a'],
};
const FALLBACK_IDS = [
  'photo-1584036561566-baf8f5f1b144',
  'photo-1579154204601-01588f351e67',
  'photo-1527613426441-4da17471b66d',
  'photo-1530026405186-ed1f139313f8',
  'photo-1576091160550-2173dba999ef',
  'photo-1532938911079-1b06ac7ceec7',
  'photo-1516549655169-df83a0774514',
  'photo-1551076805-e1869033e561',
];

function unsplashUrl(id: string): string {
  return `https://images.unsplash.com/${id}?w=600&h=300&fit=crop&auto=format&q=60`;
}

function getArticleImage(article: NewsArticle, index: number): string {
  // Use disease-specific image, varied by index
  if (article.disease && DISEASE_IMAGES[article.disease]) {
    const imgs = DISEASE_IMAGES[article.disease];
    return unsplashUrl(imgs[index % imgs.length]);
  }
  // Fallback: cycle through medical/health themed images
  return unsplashUrl(FALLBACK_IDS[index % FALLBACK_IDS.length]);
}

function ArticleCard({ article, featured, index }: { article: NewsArticle; featured?: boolean; index: number }) {
  const sev = article.severity ? SEV_COLORS[article.severity] : null;
  const cat = CAT_LABEL[article.category] ?? CAT_LABEL.media;
  const imgSrc = article.imageUrl || getArticleImage(article, index);

  // Generate a gradient based on the article's disease/category for visual variety
  const gradients = [
    'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
    'linear-gradient(135deg, #0f172a 0%, #1a1a2e 100%)',
    'linear-gradient(135deg, #0c1222 0%, #1c1917 100%)',
    'linear-gradient(135deg, #0f172a 0%, #14292b 100%)',
  ];
  const gradientIdx = (article.title.length + (article.disease?.length ?? 0)) % gradients.length;

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block rounded-xl overflow-hidden transition-all duration-200 ${featured ? 'md:col-span-2 lg:col-span-2' : ''}`}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        textDecoration: 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Visual header band / image */}
      <div
        className="relative"
        style={{
          height: featured ? 200 : 140,
          background: gradients[gradientIdx],
          borderBottom: sev ? `2px solid ${sev.border}` : '1px solid rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}
      >
        <img
          src={imgSrc}
          alt=""
          loading="lazy"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', opacity: 0.6,
            transition: 'opacity 0.3s, transform 0.4s',
          }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          className="group-hover:scale-105 group-hover:opacity-70"
        />
        {/* Dark overlay for text readability */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(2,8,23,0.9) 0%, rgba(2,8,23,0.4) 40%, rgba(2,8,23,0.15) 100%)' }}
        />
        {/* Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          {article.severity && sev && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
              color: sev.text, background: sev.bg, border: `1px solid ${sev.border}`,
              fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.08em',
            }}>
              {article.severity}
            </span>
          )}
          <span style={{
            fontSize: 9, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
            color: cat.color, background: `${cat.color}18`, border: `1px solid ${cat.color}30`,
            fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.06em',
          }}>
            {cat.label}
          </span>
        </div>

        {/* Source badge */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}>
          <svg className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.6)' }} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
          </svg>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
            {article.source}
          </span>
        </div>

        {/* Disease overlay label */}
        {article.disease && (
          <div className="absolute bottom-3 right-3">
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
              color: '#60a5fa', background: 'rgba(96,165,250,0.15)',
              border: '1px solid rgba(96,165,250,0.3)',
            }}>
              {article.disease}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <h3
          className="font-bold leading-tight mb-2 transition-colors group-hover:text-blue-400"
          style={{ fontSize: featured ? 18 : 15, color: '#ffffff', lineHeight: 1.35 }}
        >
          {article.title}
        </h3>

        {/* Excerpt */}
        {article.excerpt && (
          <p style={{
            fontSize: 12, color: 'rgba(148,163,184,0.7)', lineHeight: 1.6,
            marginBottom: 8,
            display: '-webkit-box', WebkitLineClamp: featured ? 3 : 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {article.excerpt}
          </p>
        )}

        {/* Location */}
        {article.location && (
          <div className="flex items-center gap-1.5 mb-3" style={{ fontSize: 12, color: '#a0a8c8' }}>
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#6b7280' }}>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            <span>{article.location}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" style={{ color: '#6b7280' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'var(--font-mono), monospace' }}>
              {article.publishedAt
                ? formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })
                : 'Recently'}
            </span>
          </div>
          <span className="flex items-center gap-1 transition-colors group-hover:text-blue-400"
            style={{ fontSize: 11, color: '#60a5fa', fontWeight: 600 }}>
            Read
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </span>
        </div>
      </div>
    </a>
  );
}
