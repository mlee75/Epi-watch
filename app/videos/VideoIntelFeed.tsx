'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { SeverityBadge } from '@/components/SeverityBadge';

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
      setError(err instanceof Error ? err.message : 'Could not load videos.');
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

  const channels = [...sources].sort((a, b) => a.sourceType.localeCompare(b.sourceType));

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Video</h1>
        <p className="page-lede">
          Outbreak briefings, epidemiological updates and news coverage, including reporting in
          other languages. Only channels on a fixed list are collected; nothing comes from open
          search.
        </p>
      </header>

      <details className="panel vid-sources">
        <summary className="panel-header">
          <span className="panel-title">What the channel list does and does not check</span>
          <span className="panel-meta">{sources.length} channels</span>
        </summary>
        <div className="panel-body">
          <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 12 }}>
            Every video was published by one of the channels below. That establishes{' '}
            <strong style={{ color: 'var(--ink-1)' }}>who published it</strong>, not whether its
            contents are correct, and disease and country labels are inferred from titles.{' '}
            <em>Agency</em> marks a public health body. <em>News</em> marks a news organisation;
            its clips are reporting rather than official guidance, and are admitted only when the
            headline is about health.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {channels.map((s) => (
              <span key={s.channelId} className="tag"
                title={`${s.sourceType === 'authority' ? 'Health agency' : 'News organisation'} · ${s.language.toUpperCase()}`}>
                {s.channelName}
                <span className="muted"> · {s.sourceType === 'authority' ? 'Agency' : 'News'}</span>
              </span>
            ))}
          </div>
        </div>
      </details>

      <div className="ob-toolbar" style={{ marginTop: 16 }}>
        <div className="ob-seg" role="group" aria-label="Publisher" style={{ flexWrap: 'wrap' }}>
          {authorities.map((a) => (
            <button key={a} type="button" className="chip" aria-pressed={authority === a}
              onClick={() => setAuthority(a)}>
              {a === 'ALL' ? 'All publishers' : a}
            </button>
          ))}
        </div>
        <button type="button" className="chip" aria-pressed={linkedOnly}
          onClick={() => setLinkedOnly((v) => !v)}>
          Matched to a record
        </button>
      </div>

      <div className="ob-summary">
        <span><strong>{videos.length}</strong> videos</span>
      </div>

      {error && <div className="note" style={{ marginBottom: 16 }}>{error}</div>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : videos.length === 0 ? (
        <div className="panel"><p className="muted" style={{ padding: 20 }}>No videos match these filters.</p></div>
      ) : (
        <div className="vid-grid">
          {videos.map((v) => (
            <article key={v.id} className="panel vid-card">
              {/* Nothing loads from the video host until the reader clicks, so
                  viewing the page sets no third-party cookies. */}
              <div className="vid-frame">
                {playing === v.id ? (
                  <iframe
                    src={`${v.embedUrl}?autoplay=1`}
                    title={v.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <button type="button" className="vid-poster" onClick={() => setPlaying(v.id)}
                    aria-label={`Play: ${v.title}`}>
                    {v.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.thumbnailUrl} alt="" loading="lazy" />
                    )}
                    <span className="vid-play vid-play-lg" aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="vid-card-body">
                <div className="vid-meta">
                  <span className="tag">{v.sourceType === 'authority' ? 'Agency' : 'News'}</span>
                  <span>{v.authority}</span>
                  <span>{v.language.toUpperCase()}</span>
                  {v.disease && <span className="tag">{v.disease}</span>}
                </div>
                <h2 className="vid-card-title">{v.title}</h2>
                {v.outbreak && (
                  <a className="vid-linked"
                    href={`/outbreaks?search=${encodeURIComponent(v.outbreak.disease)}`}>
                    <SeverityBadge severity={v.outbreak.severity} size="sm" />
                    <span>Record: {v.outbreak.disease}, {v.outbreak.country}</span>
                  </a>
                )}
                <div className="vid-card-foot">
                  <span title={v.channelName}>
                    {formatDistanceToNow(new Date(v.publishedAt), { addSuffix: true })}
                  </span>
                  <a className="link" href={v.url} target="_blank" rel="noopener noreferrer">
                    Open on YouTube
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
