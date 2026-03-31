'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { SeverityBadge } from './SeverityBadge';
import type { Outbreak, Severity } from '@/lib/types';

const SEV_BORDER: Record<Severity, string> = {
  CRITICAL: '#ef4444',
  HIGH:     '#f97316',
  MEDIUM:   '#eab308',
  LOW:      '#22c55e',
};

const TREND_ICON: Record<string, string>  = { increasing: '↑', decreasing: '↓', stable: '→' };
const TREND_COLOR: Record<string, string> = { increasing: '#ef4444', decreasing: '#22c55e', stable: '#94a3b8' };

const fmtNum = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

interface OutbreakCardProps { outbreak: Outbreak; }

export function OutbreakCard({ outbreak }: OutbreakCardProps) {
  const [expanded, setExpanded] = useState(false);

  const severity   = outbreak.severity as Severity;
  const borderColor = SEV_BORDER[severity] ?? '#a0a8c8';
  const cfr = outbreak.cases > 0
    ? ((outbreak.deaths / outbreak.cases) * 100).toFixed(1)
    : '0';

  const timeAgo = formatDistanceToNow(new Date(outbreak.reportDate), { addSuffix: true });

  const sourceDomain = (() => {
    try { return new URL(outbreak.sourceUrl).hostname.replace('www.', ''); }
    catch { return outbreak.sourceName; }
  })();

  return (
    <article
      onClick={() => setExpanded((e) => !e)}
      className="group relative rounded-xl overflow-hidden cursor-pointer select-none animate-fade-in"
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderLeft: `3px solid ${borderColor}`,
        transition: 'all 0.2s ease',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = 'rgba(255,255,255,0.05)';
        el.style.transform = 'translateY(-1px)';
        el.style.boxShadow = `0 8px 32px rgba(0,0,0,0.4), 0 0 20px ${borderColor}18`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = 'rgba(255,255,255,0.03)';
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';
      }}
    >
      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <SeverityBadge severity={severity} size="sm" pulse />
            {outbreak.verified === false && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-widest"
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  color: '#ffd700',
                  background: 'rgba(255,215,0,0.08)',
                  border: '1px solid rgba(255,215,0,0.3)',
                }}
              >
                ⚠ UNVERIFIED
              </span>
            )}
            {outbreak.language && outbreak.language !== 'en' && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded"
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  color: '#a0a8c8',
                  background: '#0d1129',
                  border: '1px solid #1e2749',
                }}
              >
                {outbreak.language.toUpperCase()}
              </span>
            )}
          </div>
          {outbreak.trend && (
            <span
              className="text-xs font-bold shrink-0"
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                color: TREND_COLOR[outbreak.trend] ?? '#a0a8c8',
              }}
              title={`Trend: ${outbreak.trend}`}
            >
              {TREND_ICON[outbreak.trend] ?? '→'} {outbreak.trend}
            </span>
          )}
        </div>

        {/* Disease name */}
        <h3
          className="font-bold leading-tight mb-1.5 transition-colors group-hover:text-white"
          style={{ fontSize: 16, color: '#ffffff', letterSpacing: '0.02em' }}
        >
          {outbreak.disease}
        </h3>

        {/* Location */}
        <div className="flex items-center gap-1.5 mb-3" style={{ fontSize: 13, color: '#a0a8c8' }}>
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#6b7280' }}>
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
          <span className="font-medium">{outbreak.country}</span>
          {outbreak.region && outbreak.region !== 'OTHER' && (
            <>
              <span style={{ color: '#1e2749' }}>·</span>
              <span style={{ fontSize: 11, color: '#6b7280' }}>{outbreak.region}</span>
            </>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Cases',  value: fmtNum(outbreak.cases),  color: '#ffffff' },
            { label: 'Deaths', value: fmtNum(outbreak.deaths), color: '#ff0000' },
            { label: 'CFR',    value: `${cfr}%`,               color: '#a0a8c8' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-md px-2 py-1.5"
              style={{ background: '#0d1129', border: '1px solid #1e2749' }}
            >
              <div
                className="uppercase mb-0.5"
                style={{ fontSize: 9, color: '#6b7280', letterSpacing: '0.1em', fontFamily: 'var(--font-mono, monospace)' }}
              >
                {label}
              </div>
              <div
                className="font-bold tabular-nums"
                style={{ fontSize: 13, color, fontFamily: 'var(--font-mono, monospace)' }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        {outbreak.summary && (
          <p
            className={`text-xs leading-relaxed mb-3 transition-all duration-200 ${expanded ? '' : 'line-clamp-2'}`}
            style={{ color: '#a0a8c8' }}
          >
            {outbreak.summary}
          </p>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-between pt-2"
          style={{ borderTop: '1px solid #1e2749' }}
        >
          <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'var(--font-mono, monospace)' }}>
            {timeAgo}
          </span>
          <div className="flex items-center gap-2">
            <span
              className="px-1.5 py-0.5 rounded"
              style={{ fontSize: 11, color: '#6b7280', background: '#0d1129', fontFamily: 'var(--font-mono, monospace)' }}
            >
              {outbreak.sourceName}
            </span>
            <a
              href={outbreak.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="transition-colors"
              style={{ fontSize: 11, color: '#60a5fa', fontFamily: 'var(--font-mono, monospace)' }}
              title={`Source: ${sourceDomain}`}
            >
              {sourceDomain} ↗
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
