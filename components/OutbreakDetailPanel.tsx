'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { SeverityBadge } from './SeverityBadge';
import { SourceCard } from './SourceCard';
import { SourcesModal } from './SourcesModal';
import { AIOverview } from './AIOverview';
import type { Outbreak, Severity, OutbreakSource } from '@/lib/types';

const TREND_ICON:  Record<string, string> = { increasing: '↑', decreasing: '↓', stable: '→' };
const TREND_COLOR: Record<string, string> = { increasing: '#ff0000', decreasing: '#00ff00', stable: '#a0a8c8' };

const LANG_FLAG: Record<string, string> = {
  en: '🇬🇧', fr: '🇫🇷', es: '🇪🇸', pt: '🇧🇷', ar: '🇸🇦', zh: '🇨🇳',
  ru: '🇷🇺', de: '🇩🇪', ja: '🇯🇵', ko: '🇰🇷', hi: '🇮🇳', sw: '🇰🇪',
};

const fmtNum = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

interface Props { outbreak: Outbreak | null; onClose: () => void; }

export function OutbreakDetailPanel({ outbreak, onClose }: Props) {
  const [sources, setSources] = useState<OutbreakSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Fetch sources whenever the outbreak changes
  useEffect(() => {
    if (!outbreak) { setSources([]); return; }
    setSourcesLoading(true);
    setSources([]);
    fetch(`/api/outbreaks/${outbreak.id}/sources`)
      .then((r) => r.json())
      .then((j) => setSources(j.data ?? []))
      .catch(() => setSources([]))
      .finally(() => setSourcesLoading(false));
  }, [outbreak?.id]);

  if (!outbreak) return null;

  const o = outbreak as Outbreak & { verified?: boolean; language?: string; titleOrig?: string; pathogen?: string };
  const isVerified = o.verified !== false;
  const lang = o.language || 'en';
  const cfr  = o.cases > 0 ? ((o.deaths / o.cases) * 100).toFixed(2) : '0';
  const timeAgo = formatDistanceToNow(new Date(o.reportDate), { addSuffix: true });

  const sourceDomain = (() => {
    try { return new URL(o.sourceUrl).hostname.replace('www.', ''); }
    catch { return o.sourceName; }
  })();

  const panelBg     = '#0d1129';
  const border      = '#1e2749';
  const cardBg      = '#141938';

  // Show up to 3 sources in the panel; rest available in modal
  const previewSources = sources.slice(0, 3);

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <aside
        style={{
          position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 50,
          width: '100%', maxWidth: 440,
          background: panelBg, borderLeft: `1px solid ${border}`,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'slideInRight 0.25s ease-out both',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <SeverityBadge severity={o.severity as Severity} pulse />
                {!isVerified && (
                  <span style={{
                    fontSize: 10, fontFamily: 'var(--font-mono, monospace)', fontWeight: 700,
                    color: '#ffd700', background: 'rgba(255,215,0,0.08)',
                    border: '1px solid rgba(255,215,0,0.3)',
                    padding: '2px 8px', borderRadius: 4, letterSpacing: '0.1em',
                  }}>⚠ UNVERIFIED</span>
                )}
                {isVerified && (
                  <span style={{
                    fontSize: 10, fontFamily: 'var(--font-mono, monospace)', fontWeight: 700,
                    color: '#00ff00', background: 'rgba(0,255,0,0.06)',
                    border: '1px solid rgba(0,255,0,0.25)',
                    padding: '2px 8px', borderRadius: 4, letterSpacing: '0.1em',
                  }}>✓ VERIFIED</span>
                )}
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', lineHeight: 1.2, letterSpacing: '0.02em' }}>
                {o.disease}
              </h2>
            </div>
            <button
              onClick={onClose}
              style={{
                marginLeft: 12, flexShrink: 0, color: '#6b7280', background: 'none',
                border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4,
                transition: 'color 0.15s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.color = '#ffffff'; }}
              onMouseOut={(e)  => { e.currentTarget.style.color = '#6b7280'; }}
            >
              <svg style={{ width: 20, height: 20 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Location */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#a0a8c8' }}>
            <svg style={{ width: 16, height: 16, color: '#6b7280', flexShrink: 0 }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            <span style={{ fontWeight: 600, color: '#ffffff' }}>{o.country}</span>
            {o.subregion && <span style={{ color: '#6b7280' }}>· {o.subregion}</span>}
            {o.region && o.region !== 'OTHER' && (
              <span style={{
                fontSize: 11, color: '#6b7280', background: cardBg,
                border: `1px solid ${border}`, padding: '1px 6px', borderRadius: 4,
                fontFamily: 'var(--font-mono, monospace)',
              }}>{o.region}</span>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              { label: 'Cases',  value: fmtNum(o.cases),  color: '#ffffff' },
              { label: 'Deaths', value: fmtNum(o.deaths), color: '#ff0000' },
              { label: 'CFR',    value: `${cfr}%`,        color: '#ff6b00' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: 'var(--font-mono, monospace)' }}>{value}</div>
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2, letterSpacing: '0.05em' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Trend + pathogen */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {o.trend && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: cardBg, border: `1px solid ${border}`, borderRadius: 8, padding: '6px 12px' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: TREND_COLOR[o.trend] ?? '#a0a8c8' }}>
                  {TREND_ICON[o.trend] ?? '→'}
                </span>
                <span style={{ fontSize: 12, color: '#a0a8c8', textTransform: 'capitalize' }}>{o.trend}</span>
              </div>
            )}
            {o.pathogen && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: cardBg, border: `1px solid ${border}`, borderRadius: 8, padding: '6px 12px' }}>
                <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.05em' }}>PATHOGEN</span>
                <span style={{ fontSize: 12, color: '#a0a8c8', fontFamily: 'var(--font-mono, monospace)', fontStyle: 'italic' }}>{o.pathogen}</span>
              </div>
            )}
          </div>

          {/* Non-English headline */}
          {o.titleOrig && lang !== 'en' && (
            <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>{LANG_FLAG[lang] ?? '🌐'}</span>
                <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Original source ({lang.toUpperCase()})
                </span>
              </div>
              <p style={{ fontSize: 12, color: '#a0a8c8', fontStyle: 'italic', lineHeight: 1.5 }}>{o.titleOrig}</p>
            </div>
          )}

          {/* AI Summary */}
          {o.summary && (
            <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 8, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <svg style={{ width: 14, height: 14, color: '#60a5fa' }} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                </svg>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, color: '#60a5fa', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Intelligence Summary
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#a0a8c8', lineHeight: 1.6 }}>{o.summary}</p>
            </div>
          )}

          {/* ── AI OVERVIEW ────────────────────────────────── */}
          <AIOverview outbreakId={o.id} />

          {/* ── SOURCE ATTRIBUTION ─────────────────────────── */}
          <div>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg style={{ width: 13, height: 13, color: '#60a5fa' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, color: '#60a5fa', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Source Reports
                </span>
                {!sourcesLoading && (
                  <span style={{
                    fontSize: 9, fontFamily: 'var(--font-mono, monospace)', color: '#6b7280',
                    background: cardBg, border: `1px solid ${border}`,
                    padding: '1px 5px', borderRadius: 3,
                  }}>
                    {sources.length}
                  </span>
                )}
              </div>
              {sources.length > 3 && (
                <button
                  onClick={() => setShowModal(true)}
                  style={{
                    fontSize: 11, color: '#60a5fa', background: 'none', border: 'none',
                    cursor: 'pointer', fontFamily: 'var(--font-mono, monospace)', padding: 0,
                    transition: 'color 0.15s',
                  }}
                  onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.color = '#3b82f6'; }}
                  onMouseOut={(e)  => { (e.currentTarget as HTMLElement).style.color = '#60a5fa'; }}
                >
                  View all {sources.length} →
                </button>
              )}
            </div>

            {/* Source cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sourcesLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="animate-pulse" style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 8, height: 72 }} />
                ))
              ) : previewSources.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '12px 0', color: '#6b7280', fontSize: 12, fontFamily: 'var(--font-mono, monospace)' }}>
                  No source records yet
                </div>
              ) : (
                previewSources.map((s) => <SourceCard key={s.id} source={s} />)
              )}
            </div>

            {/* View all button (when ≤ 3, show primary source link) */}
            {sources.length > 3 && (
              <button
                onClick={() => setShowModal(true)}
                style={{
                  marginTop: 10, width: '100%', padding: '8px 0',
                  background: 'rgba(96,165,250,0.05)', border: `1px solid rgba(96,165,250,0.2)`,
                  borderRadius: 8, color: '#60a5fa', fontSize: 12, cursor: 'pointer',
                  fontFamily: 'var(--font-mono, monospace)', fontWeight: 600,
                  transition: 'all 0.15s',
                }}
                onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(96,165,250,0.1)'; }}
                onMouseOut={(e)  => { (e.currentTarget as HTMLElement).style.background = 'rgba(96,165,250,0.05)'; }}
              >
                View All {sources.length} Reports →
              </button>
            )}
          </div>

          {/* Unverified warning */}
          {!isVerified && (
            <div style={{ background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.25)', borderRadius: 8, padding: 12 }}>
              <p style={{ fontSize: 12, color: 'rgba(255,215,0,0.9)', lineHeight: 1.5 }}>
                <strong>⚠ Unverified Report:</strong> Detected from news and social media — not yet confirmed by official health authorities. Treat as preliminary intelligence.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, fontSize: 11, fontFamily: 'var(--font-mono, monospace)' }}>
            <span style={{ color: '#6b7280' }}>{timeAgo}</span>
            <span style={{ color: '#6b7280', background: cardBg, border: `1px solid ${border}`, padding: '2px 8px', borderRadius: 4 }}>
              {o.sourceName}
            </span>
          </div>
          <a
            href={o.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.3)',
              borderRadius: 8, padding: '10px 16px', color: '#60a5fa', fontSize: 14,
              fontWeight: 600, textDecoration: 'none', transition: 'all 0.15s', width: '100%',
            }}
            onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(96,165,250,0.15)'; }}
            onMouseOut={(e)  => { (e.currentTarget as HTMLElement).style.background = 'rgba(96,165,250,0.08)'; }}
          >
            Read full report ↗ <span style={{ fontSize: 11, color: '#3b82f6' }}>{sourceDomain}</span>
          </a>
        </div>
      </aside>

      {/* Sources modal */}
      {showModal && (
        <SourcesModal
          outbreakId={o.id}
          disease={o.disease}
          country={o.country}
          onClose={() => setShowModal(false)}
        />
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
