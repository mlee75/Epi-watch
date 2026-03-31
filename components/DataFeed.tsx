'use client';

import { useEffect, useState } from 'react';

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface Props { lastUpdated: string; }

export default function DataFeed({ lastUpdated }: Props) {
  // Re-render every minute so the relative time stays fresh
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="px-12 pb-12">
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl px-8 py-5 flex items-center justify-between">

        <div className="flex items-center gap-4">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <div>
            <p className="text-sm font-semibold text-white">Live Data Feed</p>
            <p className="text-xs text-white/50">
              Updated {formatTimeAgo(lastUpdated)} · Auto-refresh from WHO, CDC, ProMED
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full">
          <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Live</span>
        </div>

      </div>
    </section>
  );
}
