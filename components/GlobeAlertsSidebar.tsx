'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Outbreak } from '@/lib/types';

const fmtNum = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const SEV_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  HIGH:     { bg: 'rgba(249,115,22,0.15)', text: '#f97316', border: 'rgba(249,115,22,0.3)' },
};

export default function GlobeAlertsSidebar({ outbreaks }: { outbreaks: Outbreak[] }) {
  const [open, setOpen] = useState(true);

  // Show CRITICAL + HIGH outbreaks, sorted by severity then cases
  const alerts = outbreaks
    .filter((o) => o.severity === 'CRITICAL' || o.severity === 'HIGH')
    .sort((a, b) => {
      if (a.severity === 'CRITICAL' && b.severity !== 'CRITICAL') return -1;
      if (b.severity === 'CRITICAL' && a.severity !== 'CRITICAL') return 1;
      return (b.cases ?? 0) - (a.cases ?? 0);
    })
    .slice(0, 12);

  if (alerts.length === 0) return null;

  // Collapsed — floating badge
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'absolute', right: 20, top: 80, zIndex: 20,
          width: 44, height: 44, borderRadius: '50%',
          background: '#ef4444', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(239,68,68,0.4)',
          transition: 'transform 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        {/* Count badge */}
        <span style={{
          position: 'absolute', top: -4, right: -4,
          width: 20, height: 20, borderRadius: '50%',
          background: '#fff', color: '#ef4444',
          fontSize: 11, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {alerts.length}
        </span>
      </button>
    );
  }

  // Expanded sidebar
  return (
    <div
      style={{
        position: 'absolute', right: 20, top: 76, bottom: 90, zIndex: 20,
        width: 300, display: 'flex', flexDirection: 'column',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16, overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ position: 'relative', display: 'inline-flex', width: 7, height: 7 }}>
            <span className="animate-ping" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#ef4444', opacity: 0.75 }} />
            <span style={{ position: 'relative', width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
          </span>
          <span style={{
            fontSize: 11, fontWeight: 800, color: '#fff',
            fontFamily: 'var(--font-mono), monospace',
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            Urgent Alerts
          </span>
        </div>
        <button
          onClick={() => setOpen(false)}
          style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'rgba(255,255,255,0.08)', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Scrollable alerts */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {alerts.map((alert) => {
          const sev = SEV_STYLES[alert.severity] ?? SEV_STYLES.HIGH;
          return (
            <Link
              key={alert.id}
              href={`/outbreaks/${alert.id}`}
              style={{
                display: 'block', padding: '10px 12px', borderRadius: 10,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                textDecoration: 'none', transition: 'all 0.15s', cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
              }}
            >
              {/* Top row: disease + severity */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                    {alert.disease}
                  </p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                    {alert.country}
                  </p>
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                  color: sev.text, background: sev.bg, border: `1px solid ${sev.border}`,
                  fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.06em',
                  flexShrink: 0,
                }}>
                  {alert.severity}
                </span>
              </div>

              {/* Bottom row: cases + deaths */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                  {fmtNum(alert.cases ?? 0)} cases
                </span>
                {(alert.deaths ?? 0) > 0 && (
                  <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                    {fmtNum(alert.deaths ?? 0)} deaths
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: 10, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Link
          href="/outbreaks"
          style={{
            display: 'block', width: '100%', padding: '8px 0',
            background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.25)',
            borderRadius: 8, textAlign: 'center', textDecoration: 'none',
            fontSize: 11, fontWeight: 700, color: '#60a5fa',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(96,165,250,0.2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(96,165,250,0.12)'; }}
        >
          View All Outbreaks →
        </Link>
      </div>
    </div>
  );
}
