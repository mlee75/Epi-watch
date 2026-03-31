'use client';

import { useEffect, useState } from 'react';
import type { OutbreakStats } from '@/lib/types';

interface StatsBarProps { initialStats: OutbreakStats; }

export function StatsBar({ initialStats }: StatsBarProps) {
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

  const criticalPct = Math.min(100, (stats.critical / Math.max(stats.total, 1)) * 100);
  const highPct     = Math.min(100, (stats.high     / Math.max(stats.total, 1)) * 100);
  const countryPct  = Math.min(100, (stats.countriesAffected / 195) * 100);
  const totalPct    = Math.min(100, (stats.total / 100) * 100); // visual fill

  const cards = [
    {
      label: 'Critical Situations',
      value: stats.critical,
      suffix: stats.high > 0 ? `+${stats.high}` : null,
      suffixColor: '#f97316',
      sub: 'Require immediate international response',
      barColor: '#ef4444',
      barPct: criticalPct,
    },
    {
      label: 'High Risk Outbreaks',
      value: stats.high,
      suffix: null,
      suffixColor: null,
      sub: 'Significant threat level',
      barColor: '#f97316',
      barPct: highPct,
    },
    {
      label: 'Global Reach',
      value: stats.countriesAffected,
      valueSuffix: '/195',
      suffix: null,
      suffixColor: null,
      sub: 'Countries with active outbreaks',
      barColor: '#60a5fa',
      barPct: countryPct,
    },
    {
      label: 'Active Outbreaks',
      value: stats.total,
      suffix: null,
      suffixColor: null,
      sub: 'Tracked globally',
      barColor: '#22c55e',
      barPct: totalPct,
    },
  ];

  return (
    <div
      id="stats"
      style={{
        background: 'rgba(2,8,23,0.5)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="stats-grid">
        {cards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  valueSuffix?: string;
  suffix: string | null;
  suffixColor: string | null;
  sub: string;
  barColor: string;
  barPct: number;
}

function MetricCard({ label, value, valueSuffix, suffix, suffixColor, sub, barColor, barPct }: MetricCardProps) {
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
        cursor: 'default',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Label */}
      <p style={{
        fontSize: 10, fontWeight: 600,
        color: 'rgba(255,255,255,0.4)',
        textTransform: 'uppercase', letterSpacing: '0.16em',
        marginBottom: 24,
        fontFamily: 'var(--font-mono), Space Mono, monospace',
      }}>
        {label}
      </p>

      {/* Number */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8, flex: 1 }}>
        <span style={{
          fontSize: 64, fontWeight: 700, color: '#ffffff',
          lineHeight: 1, letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {value}
        </span>
        {valueSuffix && (
          <span style={{ fontSize: 28, color: 'rgba(255,255,255,0.2)', fontWeight: 500 }}>
            {valueSuffix}
          </span>
        )}
        {suffix && (
          <span style={{ fontSize: 18, fontWeight: 600, color: suffixColor ?? '#ffffff' }}>
            {suffix}
          </span>
        )}
      </div>

      {/* Sub */}
      <p style={{
        fontSize: 13, color: 'rgba(255,255,255,0.45)',
        lineHeight: 1.4, marginBottom: 24,
      }}>
        {sub}
      </p>

      {/* Bar */}
      <div style={{
        height: 3, background: 'rgba(255,255,255,0.07)',
        borderRadius: 99, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${barPct}%`,
          background: barColor,
          borderRadius: 99,
          transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  );
}
