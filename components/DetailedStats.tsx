'use client';

import { useEffect, useState } from 'react';
import type { OutbreakStats } from '@/lib/types';

interface DetailedStatsProps { initialStats: OutbreakStats; }

const fmtNum = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function DetailedStats({ initialStats }: DetailedStatsProps) {
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

  const coveragePct = Math.round((stats.countriesAffected / 195) * 100);

  return (
    <div
      style={{
        background: 'rgba(2,8,23,0.4)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="detailed-stats-grid">

        {/* Most Active Disease */}
        <GlassCard>
          <CardLabel>Most Active Disease</CardLabel>
          <h3 style={{
            fontSize: 36, fontWeight: 700, color: '#ffffff',
            marginBottom: 8, lineHeight: 1.1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {stats.topDisease?.name ?? '—'}
          </h3>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 28 }}>
            {stats.topDisease
              ? `${stats.topDisease.count} active outbreak${stats.topDisease.count !== 1 ? 's' : ''}`
              : 'No data'}
          </p>
          <div style={{
            paddingTop: 20,
            borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
          }}>
            <div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Cases
              </p>
              <p style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                {stats.topDisease ? fmtNum(stats.topDisease.cases) : '—'}
              </p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Deaths
              </p>
              <p style={{ fontSize: 22, fontWeight: 700, color: 'rgba(239,68,68,0.9)', fontVariantNumeric: 'tabular-nums' }}>
                {stats.topDisease ? fmtNum(stats.topDisease.deaths) : '—'}
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Global Impact */}
        <GlassCard>
          <CardLabel>Global Impact</CardLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Total Cases
              </p>
              <p style={{ fontSize: 40, fontWeight: 700, color: '#ffffff', lineHeight: 1, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
                {fmtNum(stats.totalCases)}
              </p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Total Deaths
              </p>
              <p style={{ fontSize: 32, fontWeight: 700, color: 'rgba(239,68,68,0.9)', lineHeight: 1, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
                {fmtNum(stats.totalDeaths)}
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Regional Coverage */}
        <GlassCard>
          <CardLabel>Regional Coverage</CardLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <StatRow label="WHO Regions" value={`${stats.regionsAffected}/7`} />
            <StatRow label="Countries" value={`${stats.countriesAffected}/195`} />
            <div style={{
              paddingTop: 20,
              borderTop: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>Coverage</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#60a5fa' }}>
                {coveragePct}%
              </span>
            </div>
          </div>
        </GlassCard>

      </div>
    </div>
  );
}

function GlassCard({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 24,
        padding: '32px',
        transition: 'all 0.25s ease',
      }}
    >
      {children}
    </div>
  );
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 600,
      color: 'rgba(255,255,255,0.4)',
      textTransform: 'uppercase', letterSpacing: '0.16em',
      marginBottom: 20,
      fontFamily: 'var(--font-mono), Space Mono, monospace',
    }}>
      {children}
    </p>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{label}</span>
      <span style={{ fontSize: 28, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
        {value}
      </span>
    </div>
  );
}
