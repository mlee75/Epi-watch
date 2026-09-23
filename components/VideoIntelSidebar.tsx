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

type Tier = 'ALL' | 'authority' | 'news';

const TIERS: { value: Tier; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'authority', label: 'Health agencies' },
  { value: 'news', label: 'Newsrooms' },
];

/**
 * Compact video rail for the news page. Every item names its tier: an
 * "agency" label on a newsroom clip would misrepresent reporting as public
 * health guidance.
 */
export function VideoIntelSidebar() {
  const [videos, setVideos] = useState<SidebarVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<Tier>('ALL');
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
    <aside className="panel vid-rail" aria-label="Video from listed channels">
      <div className="panel-header">
        <h2 className="panel-title">Video</h2>
        <Link href="/videos" className="link" style={{ fontSize: 12.5 }}>View all</Link>
      </div>
      <div className="panel-body" style={{ paddingBottom: 10 }}>
        <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 10 }}>
          From a fixed list of health-agency and newsroom channels. The list vouches for the
          publisher, not for what a video says.
        </p>
        <div className="ob-seg" role="group" aria-label="Channel type">
          {TIERS.map((t) => (
            <button key={t.value} type="button" className="chip" aria-pressed={tier === t.value}
              onClick={() => setTier(t.value)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="vid-rail-list">
        {loading ? (
          <p className="muted" style={{ fontSize: 12.5, padding: '8px 16px 16px' }}>Loading…</p>
        ) : videos.length === 0 ? (
          <p className="muted" style={{ fontSize: 12.5, padding: '8px 16px 16px' }}>
            No video from these channels yet.
          </p>
        ) : (
          videos.map((v) => (
            <article key={v.id} className="vid-item">
              {playing === v.id ? (
                <div className="vid-frame">
                  <iframe
                    src={`${v.embedUrl}?autoplay=1`}
                    title={v.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <button type="button" className="vid-row" onClick={() => setPlaying(v.id)}
                  aria-label={`Play: ${v.title}`}>
                  <span className="vid-thumb">
                    {v.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.thumbnailUrl} alt="" loading="lazy" />
                    )}
                    <span className="vid-play" aria-hidden="true" />
                  </span>
                  <span className="vid-text">
                    <span className="vid-title">{v.title}</span>
                    <span className="vid-meta">
                      <span className="tag">{v.sourceType === 'authority' ? 'Agency' : 'News'}</span>
                      {v.authority} · {v.language.toUpperCase()} ·{' '}
                      {formatDistanceToNow(new Date(v.publishedAt), { addSuffix: true })}
                    </span>
                  </span>
                </button>
              )}
            </article>
          ))
        )}
      </div>
    </aside>
  );
}
