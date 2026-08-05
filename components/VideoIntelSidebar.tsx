'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface SidebarVideo {
  id: string;
  authority: string;
  sourceType: string;
  channelName: string;
  title: string;
  url: string;
  embedUrl: string;
  thumbnailUrl: string | null;
  language: string;
  publishedAt: string;
  disease: string | null;
  country: string | null;
}

const mono = 'var(--font-mono), Space Mono, monospace';

const AUTHORITY_COLOR: Record<string, string> = {
  WHO: '#4a9eff',
  'WHO EMRO': '#4a9eff',
  'WHO WPRO': '#4a9eff',
  CDC: '#5fd3a6',
  PAHO: '#c084fc',
};

const LANG_LABEL: Record<string, string> = {
  en: 'EN', es: 'ES', ar: 'AR', fr: 'FR', pt: 'PT', ja: 'JA',
};

/**
 * Compact video rail for the news page. Deliberately shows the tier on every
 * item: an "official" badge on a newsroom clip would misrepresent reporting as
 * public health guidance.
 */
export function VideoIntelSidebar() {
  const [videos, setVideos] = useState<SidebarVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<'ALL' | 'authority' | 'news'>('ALL');
  const [playing, setPlaying] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '12' });
      if (tier !== 'ALL') params.set('sourceType', tier);
      const res = await fetch(`/api/videos?${params}`);
      if (!res.ok) return;
      const json = await res.json();
      setVideos(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [tier]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  return (
    <aside
      className="rounded-xl overflow-hidden"
      style={{ background: '#0d1129', border: '1px solid #1e2749' }}
      aria-label="Verified video intelligence"
    >
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid #1e2749' }}>
        <div className="flex items-center justify-between mb-1">
          <h2 style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.14em', color: '#ff4d4d' }}>
            VERIFIED VIDEO
          </h2>
          <Link
            href="/videos"
            style={{ fontFamily: mono, fontSize: 10, color: '#4a9eff', textDecoration: 'none' }}
          >
            view all →
          </Link>
        </div>
        <p style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>
          From an allowlist of health authorities and newsrooms. Attests to the publisher,
          not the contents.
        </p>

        <div className="flex gap-1.5 mt-3">
          {(['ALL', 'authority', 'news'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTier(t)}
              style={{
                fontFamily: mono,
                fontSize: 9,
                padding: '3px 7px',
                borderRadius: 5,
                cursor: 'pointer',
                background: tier === t ? '#1a2140' : 'transparent',
                border: `1px solid ${tier === t ? '#3a4470' : '#1e2749'}`,
                color: tier === t ? '#e8ecf8' : '#6b7280',
              }}
            >
              {t === 'ALL' ? 'ALL' : t === 'authority' ? 'OFFICIAL' : 'NEWS'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 flex flex-col gap-3" style={{ maxHeight: 720, overflowY: 'auto' }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: 92, borderRadius: 8, background: '#0a0e20' }} />
          ))
        ) : videos.length === 0 ? (
          <p style={{ fontSize: 12, color: '#6b7280', padding: '12px 4px' }}>
            No video from these sources yet.
          </p>
        ) : (
          videos.map((v) => (
            <article key={v.id} className="rounded-lg overflow-hidden" style={{ background: '#0a0e20' }}>
              {playing === v.id ? (
                <div style={{ position: 'relative', aspectRatio: '16 / 9' }}>
                  <iframe
                    src={`${v.embedUrl}?autoplay=1`}
                    title={v.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                    allowFullScreen
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setPlaying(v.id)}
                  aria-label={`Play: ${v.title}`}
                  className="w-full flex gap-2.5 text-left"
                  style={{ padding: 8, background: 'transparent', border: 0, cursor: 'pointer' }}
                >
                  <div
                    style={{
                      position: 'relative', width: 104, flexShrink: 0,
                      aspectRatio: '16 / 9', borderRadius: 6, overflow: 'hidden', background: '#070a18',
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
                        width: 24, height: 24, borderRadius: '50%',
                        background: 'rgba(255,77,77,0.92)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <span
                        style={{
                          width: 0, height: 0, marginLeft: 2,
                          borderTop: '5px solid transparent',
                          borderBottom: '5px solid transparent',
                          borderLeft: '8px solid #fff',
                        }}
                      />
                    </span>
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="flex items-center gap-1 mb-1 flex-wrap">
                      <span
                        style={{
                          fontFamily: mono, fontSize: 8, padding: '1px 4px', borderRadius: 3,
                          color: v.sourceType === 'authority'
                            ? (AUTHORITY_COLOR[v.authority] ?? '#5fd3a6')
                            : '#f0a868',
                          border: `1px solid ${
                            v.sourceType === 'authority'
                              ? `${AUTHORITY_COLOR[v.authority] ?? '#5fd3a6'}55`
                              : '#f0a86855'
                          }`,
                        }}
                      >
                        {v.sourceType === 'authority' ? 'OFFICIAL' : 'NEWS'}
                      </span>
                      <span style={{ fontFamily: mono, fontSize: 8, color: '#6b7280' }}>
                        {v.authority} · {LANG_LABEL[v.language] ?? v.language.toUpperCase()}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 12, lineHeight: 1.35, color: '#e8ecf8',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {v.title}
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: '#6b7280', marginTop: 3 }}>
                      {v.disease ? `${v.disease} · ` : ''}
                      {formatDistanceToNow(new Date(v.publishedAt), { addSuffix: true })}
                    </div>
                  </div>
                </button>
              )}
            </article>
          ))
        )}
      </div>
    </aside>
  );
}
