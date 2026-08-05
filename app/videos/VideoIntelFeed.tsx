'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface LinkedOutbreak {
  id: string;
  disease: string;
  country: string;
  severity: string;
}

interface IntelVideo {
  id: string;
  videoId: string;
  authority: string;
  sourceType: string;
  channelName: string;
  title: string;
  description: string | null;
  url: string;
  embedUrl: string;
  thumbnailUrl: string | null;
  language: string;
  publishedAt: string;
  disease: string | null;
  country: string | null;
  region: string | null;
  outbreak: LinkedOutbreak | null;
}

interface VerifiedSource {
  authority: string;
  sourceType: string;
  channelName: string;
  channelId: string;
  language: string;
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#ff3b3b',
  HIGH: '#ff8a3b',
  MEDIUM: '#ffcc3b',
  LOW: '#3bd16f',
};

const AUTHORITY_COLOR: Record<string, string> = {
  WHO: '#4a9eff',
  CDC: '#5fd3a6',
  PAHO: '#c084fc',
  'WHO EMRO': '#4a9eff',
};

const LANG_LABEL: Record<string, string> = {
  en: 'EN', es: 'ES', ar: 'AR', fr: 'FR', pt: 'PT',
};

const mono = 'var(--font-mono), Space Mono, monospace';

export default function VideoIntelFeed() {
  const [videos, setVideos] = useState<IntelVideo[]>([]);
  const [sources, setSources] = useState<VerifiedSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authority, setAuthority] = useState('ALL');
  const [linkedOnly, setLinkedOnly] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '48' });
      if (authority !== 'ALL') params.set('authority', authority);
      if (linkedOnly) params.set('linked', 'true');

      const res = await fetch(`/api/videos?${params}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);

      const json = await res.json();
      setVideos(json.data ?? []);
      setSources(json.meta?.verifiedSources ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load video intelligence');
    } finally {
      setLoading(false);
    }
  }, [authority, linkedOnly]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const authorities = useMemo(
    () => ['ALL', ...Array.from(new Set(sources.map((s) => s.authority)))],
    [sources]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-6">
        <div
          className="mb-2"
          style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.18em', color: '#ff4d4d' }}
        >
          VIDEO INTELLIGENCE · {videos.length} ITEMS
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold mb-3">
          VERIFIED <span style={{ color: '#ff4d4d' }}>VIDEO</span>
        </h1>
        <p style={{ color: '#a0a8c8', maxWidth: 720, lineHeight: 1.6 }}>
          Outbreak briefings, epidemiological reports and field coverage — including
          foreign-language reporting. Sourced only from channels on an explicit allowlist;
          nothing is pulled from open search.
        </p>
      </div>

      {/* Provenance disclosure. The verification claim is narrow, so it is
          stated plainly rather than implied by a badge alone. */}
      <div
        className="mb-6 rounded-xl p-4"
        style={{ background: '#0d1129', border: '1px solid #1e2749' }}
      >
        <div
          className="mb-2"
          style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.14em', color: '#6b7280' }}
        >
          WHAT &ldquo;VERIFIED&rdquo; MEANS HERE
        </div>
        <p style={{ fontSize: 13, color: '#a0a8c8', lineHeight: 1.6, marginBottom: 10 }}>
          Every item was published by one of the channels listed below. This attests to{' '}
          <strong style={{ color: '#e8ecf8' }}>who published a video</strong> — it is not a
          fact-check of its contents, and topic labels are inferred from titles.{' '}
          <strong style={{ color: '#5fd3a6' }}>OFFICIAL</strong> marks a public health
          authority; <strong style={{ color: '#f0a868' }}>NEWS</strong> marks a news
          organisation, whose clips are reporting rather than official guidance and are
          admitted only when the headline itself is about health.
        </p>
        <div className="flex flex-wrap gap-2">
          {[...sources].sort((a, b) => a.sourceType.localeCompare(b.sourceType)).map((s) => (
            <span
              key={s.channelId}
              className="rounded-md px-2 py-1"
              style={{
                fontFamily: mono,
                fontSize: 10,
                background: '#0a0e20',
                border: '1px solid #1e2749',
                color: s.sourceType === 'authority'
                  ? (AUTHORITY_COLOR[s.authority] ?? '#5fd3a6')
                  : '#f0a868',
              }}
              title={`${s.sourceType === 'authority' ? 'Health authority' : 'News organisation'} · channel ${s.channelId}`}
            >
              {s.channelName}
            </span>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {authorities.map((a) => (
          <button
            key={a}
            onClick={() => setAuthority(a)}
            className="rounded-lg px-3 py-1.5"
            style={{
              fontFamily: mono,
              fontSize: 11,
              cursor: 'pointer',
              background: authority === a ? '#1a2140' : '#0d1129',
              border: `1px solid ${authority === a ? '#3a4470' : '#1e2749'}`,
              color: authority === a ? '#e8ecf8' : '#a0a8c8',
            }}
          >
            {a === 'ALL' ? 'ALL SOURCES' : a}
          </button>
        ))}
        <button
          onClick={() => setLinkedOnly((v) => !v)}
          className="rounded-lg px-3 py-1.5"
          style={{
            fontFamily: mono,
            fontSize: 11,
            cursor: 'pointer',
            background: linkedOnly ? '#1a2140' : '#0d1129',
            border: `1px solid ${linkedOnly ? '#3a4470' : '#1e2749'}`,
            color: linkedOnly ? '#e8ecf8' : '#a0a8c8',
          }}
        >
          LINKED TO OUTBREAK
        </button>
      </div>

      {error && (
        <div
          className="rounded-xl p-4 mb-6"
          style={{ background: '#2a1015', border: '1px solid #5a2028', color: '#ff8a8a', fontSize: 13 }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl"
              style={{ height: 260, background: '#0d1129', border: '1px solid #1e2749' }}
            />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: '#0d1129', border: '1px solid #1e2749', color: '#6b7280' }}
        >
          No video intelligence matches these filters.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <article
              key={v.id}
              className="rounded-xl overflow-hidden flex flex-col"
              style={{ background: '#0d1129', border: '1px solid #1e2749' }}
            >
              {/* Player / thumbnail. Nothing loads from the video host until the
                  user clicks, so the page sets no third-party cookies on view. */}
              <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#070a18' }}>
                {playing === v.id ? (
                  <iframe
                    src={`${v.embedUrl}?autoplay=1`}
                    title={v.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                    allowFullScreen
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                  />
                ) : (
                  <button
                    onClick={() => setPlaying(v.id)}
                    aria-label={`Play: ${v.title}`}
                    style={{
                      position: 'absolute', inset: 0, width: '100%', height: '100%',
                      padding: 0, border: 0, cursor: 'pointer', background: 'transparent',
                    }}
                  >
                    {v.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.thumbnailUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
                      />
                    )}
                    <span
                      style={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 52, height: 52, borderRadius: '50%',
                        background: 'rgba(255,77,77,0.92)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 18px rgba(0,0,0,0.5)',
                      }}
                    >
                      <span
                        style={{
                          width: 0, height: 0, marginLeft: 4,
                          borderTop: '9px solid transparent',
                          borderBottom: '9px solid transparent',
                          borderLeft: '15px solid #fff',
                        }}
                      />
                    </span>
                  </button>
                )}
              </div>

              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className="rounded px-1.5 py-0.5"
                    style={{
                      fontFamily: mono, fontSize: 9, letterSpacing: '0.08em',
                      color: v.sourceType === 'authority' ? '#5fd3a6' : '#f0a868',
                      border: `1px solid ${v.sourceType === 'authority' ? '#5fd3a6' : '#f0a868'}55`,
                    }}
                  >
                    {v.sourceType === 'authority' ? 'OFFICIAL' : 'NEWS'}
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5"
                    style={{
                      fontFamily: mono, fontSize: 9, letterSpacing: '0.08em',
                      color: AUTHORITY_COLOR[v.authority] ?? '#a0a8c8',
                      border: `1px solid ${AUTHORITY_COLOR[v.authority] ?? '#a0a8c8'}44`,
                    }}
                  >
                    {v.authority}
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5"
                    style={{
                      fontFamily: mono, fontSize: 9, color: '#6b7280', border: '1px solid #1e2749',
                    }}
                  >
                    {LANG_LABEL[v.language] ?? v.language.toUpperCase()}
                  </span>
                  {v.disease && (
                    <span
                      className="rounded px-1.5 py-0.5"
                      style={{
                        fontFamily: mono, fontSize: 9, color: '#ffcc3b',
                        border: '1px solid #ffcc3b44',
                      }}
                    >
                      {v.disease}
                    </span>
                  )}
                </div>

                <h2
                  style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, marginBottom: 8, color: '#e8ecf8' }}
                >
                  {v.title}
                </h2>

                {v.outbreak && (
                  <a
                    href={`/outbreaks?search=${encodeURIComponent(v.outbreak.disease)}`}
                    className="rounded-md px-2 py-1.5 mb-3 inline-flex items-center gap-2"
                    style={{
                      background: '#0a0e20',
                      border: `1px solid ${SEV_COLOR[v.outbreak.severity] ?? '#1e2749'}55`,
                      textDecoration: 'none',
                      fontFamily: mono,
                      fontSize: 10,
                      color: SEV_COLOR[v.outbreak.severity] ?? '#a0a8c8',
                    }}
                  >
                    ↳ {v.outbreak.disease} · {v.outbreak.country}
                  </a>
                )}

                <div
                  className="flex items-center justify-between mt-auto pt-2"
                  style={{ fontFamily: mono, fontSize: 10, color: '#6b7280', borderTop: '1px solid #1e2749' }}
                >
                  <span title={v.channelName}>
                    {formatDistanceToNow(new Date(v.publishedAt), { addSuffix: true })}
                  </span>
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#4a9eff', textDecoration: 'none' }}
                  >
                    source ↗
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
