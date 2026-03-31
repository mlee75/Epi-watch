'use client';

import { useEffect, useState } from 'react';
import type { OutbreakStats } from '@/lib/types';

interface BreakdownSectionsProps { initialStats: OutbreakStats; }

export function BreakdownSections({ initialStats }: BreakdownSectionsProps) {
  const [stats, setStats] = useState<OutbreakStats>(initialStats);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats');
        if (res.ok) { const json = await res.json(); setStats(json.data); }
      } catch { /* silently fail */ }
    };
    const id = setInterval(fetchStats, 60_000);
    return () => clearInterval(id);
  }, []);

  const total = stats.total || 1;
  const regions = stats.regionBreakdown ?? [];

  if (regions.length === 0 && stats.total === 0) return null;

  const severities = [
    { label: 'Critical', count: stats.critical, color: '#ef4444', description: '>10K cases' },
    { label: 'High',     count: stats.high,     color: '#f97316', description: '>1K cases'  },
    { label: 'Medium',   count: stats.medium,   color: '#eab308', description: '>100 cases' },
    { label: 'Low',      count: stats.low,       color: '#22c55e', description: '<100 cases' },
  ];

  return (
    <div
      style={{
        background: 'rgba(2,8,23,0.4)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="breakdown-grid">

        {/* Severity Distribution */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 24,
          padding: '40px',
        }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', marginBottom: 36, letterSpacing: '-0.01em' }}>
            Severity Distribution
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {severities.map(({ label, count, color, description }) => {
              const pct = Math.round((count / total) * 100);
              return (
                <div key={label}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>{label}</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{description}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', width: 32, textAlign: 'right' }}>
                        {pct}%
                      </span>
                      <span style={{
                        fontSize: 24, fontWeight: 700, color: '#ffffff',
                        width: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                      }}>
                        {count}
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      background: color, borderRadius: 99,
                      transition: 'width 0.7s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Regional Distribution */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 24,
          padding: '40px',
        }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', marginBottom: 36, letterSpacing: '-0.01em' }}>
            Regional Distribution
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {regions.map(({ region, count }) => {
              const pct = Math.round((count / total) * 100);
              return (
                <div key={region} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>{region}</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct}%`,
                        background: '#60a5fa', borderRadius: 99,
                        transition: 'width 0.7s ease',
                      }} />
                    </div>
                  </div>
                  <span style={{
                    fontSize: 24, fontWeight: 700, color: '#ffffff',
                    width: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                  }}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
