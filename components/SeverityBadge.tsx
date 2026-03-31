'use client';

import type { Severity } from '@/lib/types';

const SEV_CFG: Record<Severity, { label: string; color: string; bg: string; border: string; glow: string }> = {
  CRITICAL: { label: 'CRITICAL', color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  glow: 'rgba(239,68,68,0.4)'  },
  HIGH:     { label: 'HIGH',     color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)', glow: 'rgba(249,115,22,0.35)' },
  MEDIUM:   { label: 'MEDIUM',   color: '#eab308', bg: 'rgba(234,179,8,0.1)',  border: 'rgba(234,179,8,0.3)',  glow: 'rgba(234,179,8,0.35)'  },
  LOW:      { label: 'LOW',      color: '#22c55e', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.25)', glow: 'rgba(34,197,94,0.35)'  },
};

interface SeverityBadgeProps {
  severity: Severity;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export function SeverityBadge({ severity, size = 'md', pulse = false }: SeverityBadgeProps) {
  const cfg = SEV_CFG[severity] ?? SEV_CFG.LOW;
  const dotSize  = size === 'sm' ? 6  : 8;
  const fontSize = size === 'sm' ? 10 : 11;
  const px       = size === 'sm' ? '6px 8px' : '4px 10px';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 5,
        padding: px,
        fontFamily: 'var(--font-mono), Space Mono, monospace',
        fontSize,
        fontWeight: 700,
        letterSpacing: '0.1em',
        color: cfg.color,
        textShadow: `0 0 8px ${cfg.glow}`,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          background: cfg.color,
          boxShadow: `0 0 6px ${cfg.glow}`,
          animation: pulse && severity === 'CRITICAL' ? 'pulse 2s infinite' : undefined,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
}
