'use client';

import { useState, useEffect } from 'react';
import { SourceCard } from './SourceCard';
import type { OutbreakSource } from '@/lib/types';

type FilterTab = 'all' | 'official' | 'news' | 'translated';

interface Props {
  outbreakId: string;
  disease: string;
  country: string;
  onClose: () => void;
}

export function SourcesModal({ outbreakId, disease, country, onClose }: Props) {
  const [sources, setSources] = useState<OutbreakSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('all');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    fetch(`/api/outbreaks/${outbreakId}/sources`)
      .then((r) => r.json())
      .then((j) => setSources(j.data ?? []))
      .catch(() => setSources([]))
      .finally(() => setLoading(false));
  }, [outbreakId]);

  const filtered = sources.filter((s) => {
    if (tab === 'official')   return s.sourceType === 'official';
    if (tab === 'news')       return s.sourceType !== 'official';
    if (tab === 'translated') return s.sourceLanguage !== 'en';
    return true;
  });

  const officialCount    = sources.filter((s) => s.sourceType === 'official').length;
  const newsCount        = sources.filter((s) => s.sourceType !== 'official').length;
  const translatedCount  = sources.filter((s) => s.sourceLanguage !== 'en').length;

  const panelBg = '#0a0e27';
  const border  = '#1e2749';
  const cardBg  = '#141938';

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: 'none',
    fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, letterSpacing: '0.05em',
    background: active ? cardBg : 'transparent',
    color: active ? '#ffffff' : '#6b7280',
    outline: active ? `1px solid ${border}` : 'none',
    transition: 'all 0.15s',
  });

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed', top: '50%', left: '50%', zIndex: 70,
          transform: 'translate(-50%, -50%)',
          width: '90vw', maxWidth: 720, maxHeight: '80vh',
          background: panelBg, border: `1px solid ${border}`, borderRadius: 12,
          display: 'flex', flexDirection: 'column',
          animation: 'fadeInScale 0.2s ease-out both',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', marginBottom: 4, letterSpacing: '0.02em' }}>
                All Sources: {disease}
              </h2>
              <p style={{ fontSize: 13, color: '#a0a8c8' }}>
                {country} · {sources.length} report{sources.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, marginLeft: 12, flexShrink: 0 }}
              onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.color = '#ffffff'; }}
              onMouseOut={(e)  => { (e.currentTarget as HTMLElement).style.color = '#6b7280'; }}
            >
              <svg style={{ width: 20, height: 20 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            <button style={tabStyle(tab === 'all')}        onClick={() => setTab('all')}>All ({sources.length})</button>
            {officialCount > 0   && <button style={tabStyle(tab === 'official')}   onClick={() => setTab('official')}>Official ({officialCount})</button>}
            {newsCount > 0       && <button style={tabStyle(tab === 'news')}        onClick={() => setTab('news')}>News ({newsCount})</button>}
            {translatedCount > 0 && <button style={tabStyle(tab === 'translated')} onClick={() => setTab('translated')}>Translated ({translatedCount})</button>}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse" style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 8, height: 90 }} />
            ))
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#6b7280', fontSize: 13 }}>
              No sources in this category
            </div>
          ) : (
            filtered.map((s) => <SourceCard key={s.id} source={s} expanded />)
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: `1px solid ${border}`, flexShrink: 0, textAlign: 'center', fontSize: 11, color: '#6b7280', fontFamily: 'var(--font-mono, monospace)' }}>
          Sources updated every 30 minutes from global health authorities and news outlets
        </div>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </>
  );
}
