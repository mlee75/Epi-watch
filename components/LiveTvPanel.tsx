'use client';

import { useState } from 'react';
import { LIVE_CHANNELS, liveEmbedUrlFor } from '@/lib/videoSources';

/**
 * Regional news streams, pinned to the top-left of the map panel.
 *
 * Collapsed until opened: the map is the primary content and an autoplaying
 * stream would compete with it. Nothing loads from the video host until a
 * region is chosen, so viewing the page sets no third-party cookies.
 */
export function LiveTvPanel() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>(LIVE_CHANNELS[0]?.region ?? '');

  const channel = LIVE_CHANNELS.find((c) => c.region === active) ?? null;

  return (
    <div className="ltv">
      <button
        className="ltv-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Regional news streams
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="ltv-body">
          <div className="ltv-tabs" role="tablist" aria-label="Region">
            {LIVE_CHANNELS.map((c) => (
              <button
                key={c.region}
                role="tab"
                aria-selected={active === c.region}
                className="chip"
                aria-pressed={active === c.region}
                onClick={() => setActive(c.region)}
                title={c.channelName}
              >
                {c.label}
              </button>
            ))}
          </div>

          {channel && (
            <>
              <div className="ltv-player">
                <iframe
                  key={channel.channelId}
                  src={liveEmbedUrlFor(channel.channelId)}
                  title={`${channel.channelName} live stream`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <p className="ltv-note">
                {channel.channelName} — general news, not outbreak coverage. The stream may be
                off air.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
