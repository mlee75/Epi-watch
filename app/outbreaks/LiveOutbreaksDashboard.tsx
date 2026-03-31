'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { OutbreakCard } from '@/components/OutbreakCard';
import { SeverityBadge } from '@/components/SeverityBadge';
import type { Outbreak, Severity } from '@/lib/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_OPTIONS: { value: Severity | 'ALL'; label: string }[] = [
  { value: 'ALL',      label: 'All Severities' },
  { value: 'CRITICAL', label: 'Critical'        },
  { value: 'HIGH',     label: 'High'            },
  { value: 'MEDIUM',   label: 'Medium'          },
  { value: 'LOW',      label: 'Low'             },
];

const REGION_OPTIONS = [
  { value: 'ALL',   label: 'All Regions'              },
  { value: 'AFRO',  label: 'Africa (AFRO)'            },
  { value: 'AMRO',  label: 'Americas (AMRO)'          },
  { value: 'EMRO',  label: 'E. Mediterranean (EMRO)'  },
  { value: 'EURO',  label: 'Europe (EURO)'             },
  { value: 'SEARO', label: 'S-E Asia (SEARO)'          },
  { value: 'WPRO',  label: 'W. Pacific (WPRO)'         },
];

const SORT_OPTIONS = [
  { value: 'recent'   as const, label: 'Most Recent'      },
  { value: 'severity' as const, label: 'Highest Severity' },
  { value: 'cases'    as const, label: 'Most Cases'       },
  { value: 'deaths'   as const, label: 'Most Deaths'      },
];

const SEV_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const fmtNum = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

interface HealthArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  color: '#ffffff',
  fontSize: 13,
  padding: '8px 12px',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  initialOutbreaks: Outbreak[];
  countries: string[];
}

export default function LiveOutbreaksDashboard({ initialOutbreaks, countries }: Props) {
  const [outbreaks, setOutbreaks] = useState(initialOutbreaks);
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState<Severity | 'ALL'>('ALL');
  const [region, setRegion] = useState('ALL');
  const [country, setCountry] = useState('ALL');
  const [sort, setSort] = useState<'recent' | 'severity' | 'cases' | 'deaths'>('severity');
  const [, startTransition] = useTransition();

  // Articles for selected country
  const [articles, setArticles] = useState<HealthArticle[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);

  // Live polling every 30s
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/outbreaks?limit=500&active=true');
        if (!res.ok) return;
        const json = await res.json();
        if (json.data) setOutbreaks(json.data);
      } catch { /* ignore */ }
    };
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  // Fetch articles when country changes
  useEffect(() => {
    if (country === 'ALL') {
      setArticles([]);
      return;
    }
    setLoadingArticles(true);
    const gnewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(country + ' disease outbreak epidemic health')}&hl=en-US&gl=US&ceid=US:en`;
    fetch(`/api/news-proxy?url=${encodeURIComponent(gnewsUrl)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setArticles(data.articles ?? []))
      .catch(() => setArticles([]))
      .finally(() => setLoadingArticles(false));
  }, [country]);

  // Filter + sort
  const filtered = (() => {
    let result = outbreaks;

    if (country !== 'ALL') {
      result = result.filter(o => o.country === country);
    }
    if (severity !== 'ALL') {
      result = result.filter(o => o.severity === severity);
    }
    if (region !== 'ALL') {
      result = result.filter(o => o.region === region);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(o =>
        o.disease.toLowerCase().includes(q) ||
        o.country.toLowerCase().includes(q) ||
        (o.summary ?? '').toLowerCase().includes(q) ||
        (o.pathogen ?? '').toLowerCase().includes(q)
      );
    }

    // Sort
    if (sort === 'severity') {
      result = [...result].sort((a, b) => (SEV_ORDER[a.severity] ?? 4) - (SEV_ORDER[b.severity] ?? 4));
    } else if (sort === 'cases') {
      result = [...result].sort((a, b) => b.cases - a.cases);
    } else if (sort === 'deaths') {
      result = [...result].sort((a, b) => b.deaths - a.deaths);
    } else {
      result = [...result].sort((a, b) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime());
    }

    return result;
  })();

  // Country stats
  const countryStats = country !== 'ALL' ? {
    total: filtered.length,
    critical: filtered.filter(o => o.severity === 'CRITICAL').length,
    high: filtered.filter(o => o.severity === 'HIGH').length,
    cases: filtered.reduce((s, o) => s + o.cases, 0),
    deaths: filtered.reduce((s, o) => s + o.deaths, 0),
  } : null;

  // Dynamic country list from available data based on other filters
  const availableCountries = (() => {
    let pool = outbreaks;
    if (severity !== 'ALL') pool = pool.filter(o => o.severity === severity);
    if (region !== 'ALL') pool = pool.filter(o => o.region === region);
    return [...new Set(pool.map(o => o.country))].sort();
  })();

  return (
    <>
      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(239,68,68,0.06) 0%, transparent 70%)' }}
        />
        <div className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{
                  fontSize: 10, fontFamily: 'var(--font-mono), Space Mono, monospace',
                  fontWeight: 700, color: '#ef4444', letterSpacing: '0.12em', textTransform: 'uppercase',
                }}>
                  Live Monitoring · {outbreaks.length} active events
                </span>
              </div>
              <h1 style={{
                fontSize: 40, fontWeight: 800, color: '#ffffff',
                letterSpacing: '0.01em', lineHeight: 1.1,
              }}>
                LIVE <span style={{ color: '#ef4444' }}>OUTBREAKS</span>
              </h1>
              <p style={{ fontSize: 14, color: 'rgba(148,163,184,0.8)', marginTop: 10, maxWidth: 520, lineHeight: 1.7 }}>
                Real-time disease outbreak reports with country-level filtering.
                Auto-updated every 30 seconds from WHO, CDC, ProMED, and multilingual feeds.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '6px 14px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 20,
              }}>
                <span style={{ position: 'relative', display: 'inline-flex', width: 10, height: 10 }}>
                  <span className="animate-ping" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#ef4444', opacity: 0.75 }} />
                  <span style={{ position: 'relative', width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                </span>
                <span style={{
                  fontSize: 13, color: '#ef4444', fontWeight: 800,
                  fontFamily: 'var(--font-mono), Space Mono, monospace',
                  letterSpacing: '0.12em',
                }}>
                  LIVE
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* ── Left sidebar: Country selector + articles ───────────────── */}
          <aside className="lg:w-80 flex-shrink-0">
            <div className="lg:sticky lg:top-20 space-y-5">

              {/* Country selector */}
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  backdropFilter: 'blur(16px)',
                }}
              >
                <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: '#60a5fa',
                    fontFamily: 'var(--font-mono), monospace',
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}>
                    Filter by Country
                  </span>
                </div>
                <div style={{ maxHeight: 360, overflowY: 'auto', padding: '6px' }}>
                  <button
                    onClick={() => startTransition(() => setCountry('ALL'))}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '8px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: country === 'ALL' ? 700 : 400,
                      color: country === 'ALL' ? '#ffffff' : '#a0a8c8',
                      background: country === 'ALL' ? 'rgba(96,165,250,0.15)' : 'transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    All Countries ({outbreaks.length})
                  </button>
                  {availableCountries.map(c => {
                    const count = outbreaks.filter(o => o.country === c).length;
                    const isActive = country === c;
                    return (
                      <button
                        key={c}
                        onClick={() => startTransition(() => setCountry(c))}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', textAlign: 'left',
                          padding: '7px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                          fontSize: 13, fontWeight: isActive ? 700 : 400,
                          color: isActive ? '#ffffff' : '#a0a8c8',
                          background: isActive ? 'rgba(96,165,250,0.15)' : 'transparent',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span>{c}</span>
                        <span style={{
                          fontSize: 11, color: '#6b7280',
                          fontFamily: 'var(--font-mono), monospace',
                        }}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Country stats card */}
              {countryStats && (
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  <div style={{
                    fontSize: 9, fontWeight: 700, color: '#60a5fa',
                    fontFamily: 'var(--font-mono), monospace',
                    letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10,
                  }}>
                    {country} Summary
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono), monospace' }}>Outbreaks</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{countryStats.total}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono), monospace' }}>Critical</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444' }}>{countryStats.critical}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono), monospace' }}>Cases</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono), monospace' }}>{fmtNum(countryStats.cases)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono), monospace' }}>Deaths</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444', fontFamily: 'var(--font-mono), monospace' }}>{fmtNum(countryStats.deaths)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Latest articles for country */}
              {country !== 'ALL' && (
                <div
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: '#60a5fa',
                      fontFamily: 'var(--font-mono), monospace',
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                    }}>
                      Latest Reports · {country}
                    </span>
                  </div>
                  <div style={{ padding: '10px' }}>
                    {loadingArticles ? (
                      <div className="space-y-2">
                        {[70, 90, 80, 60].map((w, i) => (
                          <div key={i} style={{
                            height: 52, background: '#141938', borderRadius: 6,
                            width: `${w}%`, animation: 'pulse 1.5s ease-in-out infinite',
                          }} />
                        ))}
                      </div>
                    ) : articles.length > 0 ? (
                      <div className="space-y-2">
                        {articles.slice(0, 8).map((a, i) => (
                          <a
                            key={i}
                            href={a.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-lg p-3 transition-colors"
                            style={{
                              background: '#0d1129',
                              border: '1px solid #1e2749',
                              textDecoration: 'none',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#1e2749')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#0d1129')}
                          >
                            <div style={{
                              fontSize: 12, color: '#ffffff', lineHeight: 1.4,
                              display: '-webkit-box', WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical', overflow: 'hidden',
                              marginBottom: 4,
                            }}>
                              {a.title}
                            </div>
                            <div className="flex items-center justify-between">
                              <span style={{ fontSize: 10, color: '#60a5fa', fontFamily: 'var(--font-mono), monospace' }}>
                                {a.source}
                              </span>
                              {a.publishedAt && (
                                <span style={{ fontSize: 10, color: '#6b7280' }}>
                                  {formatDistanceToNow(new Date(a.publishedAt), { addSuffix: true })}
                                </span>
                              )}
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', padding: '16px 0' }}>
                        No recent health reports found
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* ── Right: Filters + outbreak grid ──────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* Filter bar */}
            <div
              className="rounded-xl p-4 mb-6"
              style={{
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.07)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
              }}
            >
              <div className="flex flex-wrap gap-3 items-center">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
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
                    value={search}
                    onChange={(e) => startTransition(() => setSearch(e.target.value))}
                    placeholder="Search disease, country, pathogen…"
                    style={{ ...inputStyle, paddingLeft: 36, width: '100%' }}
                  />
                </div>

                <select
                  value={severity}
                  onChange={(e) => startTransition(() => setSeverity(e.target.value as Severity | 'ALL'))}
                  style={{ ...inputStyle, cursor: 'pointer', minWidth: 150 }}
                >
                  {SEVERITY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                <select
                  value={region}
                  onChange={(e) => startTransition(() => setRegion(e.target.value))}
                  style={{ ...inputStyle, cursor: 'pointer', minWidth: 190 }}
                >
                  {REGION_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                <select
                  value={sort}
                  onChange={(e) => startTransition(() => setSort(e.target.value as typeof sort))}
                  style={{ ...inputStyle, cursor: 'pointer', minWidth: 150 }}
                >
                  {SORT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                <div
                  className="ml-auto whitespace-nowrap"
                  style={{ fontSize: 12, color: '#6b7280', fontFamily: 'var(--font-mono), monospace' }}
                >
                  <span style={{ color: '#a0a8c8', fontWeight: 700 }}>{filtered.length}</span>
                  {' '}of{' '}
                  <span style={{ color: '#a0a8c8', fontWeight: 700 }}>{outbreaks.length}</span>
                </div>
              </div>
            </div>

            {/* Severity summary bar */}
            <div className="flex gap-3 mb-6 overflow-x-auto pb-1">
              {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as Severity[]).map(sev => {
                const count = filtered.filter(o => o.severity === sev).length;
                const colors: Record<string, string> = {
                  CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e',
                };
                return (
                  <button
                    key={sev}
                    onClick={() => startTransition(() => setSeverity(severity === sev ? 'ALL' : sev))}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all whitespace-nowrap"
                    style={{
                      background: severity === sev ? `${colors[sev]}15` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${severity === sev ? `${colors[sev]}40` : 'rgba(255,255,255,0.07)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: colors[sev], display: 'inline-block',
                    }} />
                    <span style={{ fontSize: 12, color: colors[sev], fontWeight: 700, fontFamily: 'var(--font-mono), monospace' }}>
                      {count}
                    </span>
                    <span style={{ fontSize: 11, color: '#a0a8c8' }}>{sev}</span>
                  </button>
                );
              })}
            </div>

            {/* Outbreak grid */}
            {filtered.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map(o => (
                  <OutbreakCard key={o.id} outbreak={o} />
                ))}
              </div>
            ) : (
              <div
                className="rounded-xl p-12 text-center"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <p style={{ fontSize: 16, color: '#6b7280', marginBottom: 6 }}>No outbreaks match your filters</p>
                <p style={{ fontSize: 13, color: '#4b5563' }}>Try adjusting your search or filter criteria</p>
              </div>
            )}
          </div>
        </div>
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
