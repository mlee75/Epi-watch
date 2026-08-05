'use client';

import { useState } from 'react';
import { LIVE_CHANNELS, liveEmbedUrlFor } from '@/lib/videoSources';

const mono = 'var(--font-mono), Space Mono, monospace';

/**
 * Small live-news rail pinned to the top-left of the globe.
 *
 * Collapsed by default: the globe is the primary content, and an autoplaying
 * video would compete with it. Nothing loads from the video host until a
 * region is opened, so the page sets no third-party cookies on view.
 */
export function LiveTvPanel() {
  const [active, setActive] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const channel = LIVE_CHANNELS.find((c) => c.region === active) ?? null;

  return (
    // top offset clears the fixed site header, which overlaps the globe.
    <div
      className="absolute z-20"
      style={{ top: 72, left: 16, width: collapsed ? 'auto' : 232 }}
    >
      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: 'rgba(13,17,41,0.82)',
          border: '1px solid #1e2749',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Header */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="w-full flex items-center gap-1.5 px-2.5 py-1.5"
          style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Show live TV' : 'Hide live TV'}
        >
          <span
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#ff4d4d', flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: mono, fontSize: 9, letterSpacing: '0.14em',
              color: '#e8ecf8', whiteSpace: 'nowrap',
            }}
          >
            LIVE TV
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: mono, fontSize: 9, color: '#6b7280' }}>
            {collapsed ? '+' : '−'}
          </span>
        </button>

        {!collapsed && (
          <>
            {/* Region selector */}
            <div className="flex flex-wrap gap-1 px-2 pb-2">
              {LIVE_CHANNELS.map((c) => (
                <button
                  key={c.region}
                  onClick={() => setActive(active === c.region ? null : c.region)}
                  title={`${c.channelName} — live`}
                  style={{
                    fontFamily: mono,
                    fontSize: 8.5,
                    padding: '2.5px 5px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: active === c.region ? '#1a2140' : 'transparent',
                    border: `1px solid ${active === c.region ? '#3a4470' : '#1e2749'}`,
                    color: active === c.region ? '#e8ecf8' : '#8b93b0',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {channel && (
              <div>
                <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#070a18' }}>
                  <iframe
                    key={channel.channelId}
                    src={liveEmbedUrlFor(channel.channelId)}
                    title={`${channel.channelName} live`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                    allowFullScreen
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                  />
                </div>
                <div
                  className="px-2.5 py-1.5"
                  style={{ fontFamily: mono, fontSize: 8, color: '#6b7280', lineHeight: 1.4 }}
                >
                  {channel.channelName} · general news, may be off air
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
