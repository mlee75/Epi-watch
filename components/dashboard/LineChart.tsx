'use client';

import { useRef, useState } from 'react';

export interface LinePoint {
  x: string; // ISO date
  y: number | null;
}

interface Props {
  points: LinePoint[];
  /** Accessible description; the chart's own title is rendered by the caller. */
  label: string;
  height?: number;
  /** Sparkline mode: no axes or labels, for use inside a table cell. */
  compact?: boolean;
  format?: (n: number) => string;
  formatX?: (iso: string) => string;
}

const defaultFormat = (n: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(n);
const defaultFormatX = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Rounds up to 1, 2, 2.5 or 5 × 10ⁿ so gridlines land on readable values. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/**
 * Single-series line chart, drawn to the dataviz mark spec: a 2px line on a
 * zero baseline, recessive gridlines, a crosshair and tooltip on hover, and
 * text in ink tokens rather than the series colour. One series per chart:
 * multiple pathogens are shown as small multiples, since their scales differ
 * by an order of magnitude and a shared axis would flatten the smaller ones.
 */
export function LineChart({ points, label, height = 140, compact = false, format = defaultFormat, formatX = defaultFormatX }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const values = points.map((p) => p.y).filter((v): v is number => v != null);
  if (points.length < 2 || values.length === 0) {
    return <div className="lc-empty" style={{ height: compact ? 28 : height }}>No data</div>;
  }

  const W = 100;
  const H = 100;
  const max = compact ? Math.max(...values) || 1 : niceMax(Math.max(...values));
  const xAt = (i: number) => (i / (points.length - 1)) * W;
  const yAt = (v: number) => H - (v / max) * H;

  // Break the line at gaps rather than drawing through missing weeks.
  const segments: string[] = [];
  let cur = '';
  points.forEach((p, i) => {
    if (p.y == null) {
      if (cur) segments.push(cur);
      cur = '';
      return;
    }
    cur += `${cur ? 'L' : 'M'}${xAt(i).toFixed(2)},${yAt(p.y).toFixed(2)}`;
  });
  if (cur) segments.push(cur);

  const lastIdx = points.map((p) => p.y != null).lastIndexOf(true);
  const active = hover;
  const hp = active != null ? points[active] : null;

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const i = Math.round(((e.clientX - r.left) / r.width) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };

  return (
    <div className={compact ? 'lc lc-compact' : 'lc'}>
      {!compact && (
        <div className="lc-y" aria-hidden="true">
          <span style={{ top: 0 }}>{format(max)}</span>
          <span style={{ top: '50%' }}>{format(max / 2)}</span>
          <span style={{ top: '100%' }}>0</span>
        </div>
      )}
      <div
        ref={ref}
        className="lc-plot"
        style={{ height: compact ? 28 : height }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={label}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="100%">
          {!compact && [0, 0.5].map((f) => (
            <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className="lc-grid" vectorEffect="non-scaling-stroke" />
          ))}
          <line x1="0" x2={W} y1={H} y2={H} className="lc-base" vectorEffect="non-scaling-stroke" />
          {segments.map((d, i) => (
            <path key={i} d={d} className="lc-line" vectorEffect="non-scaling-stroke" />
          ))}
          {hp && hp.y != null && (
            <line x1={xAt(active!)} x2={xAt(active!)} y1="0" y2={H} className="lc-cross" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        {/* Markers are HTML so they stay round under the stretched viewBox. */}
        {lastIdx >= 0 && points[lastIdx].y != null && (
          <span className="lc-dot" style={{ left: `${xAt(lastIdx)}%`, top: `${yAt(points[lastIdx].y!)}%` }} />
        )}
        {hp && hp.y != null && (
          <>
            <span className="lc-dot lc-dot-hover" style={{ left: `${xAt(active!)}%`, top: `${yAt(hp.y)}%` }} />
            <div className={`lc-tip ${active! > points.length / 2 ? 'lc-tip-left' : ''}`} style={{ left: `${xAt(active!)}%` }}>
              <strong>{format(hp.y)}</strong>
              <span>{formatX(hp.x)}</span>
            </div>
          </>
        )}
        {hp && hp.y == null && (
          <div className="lc-tip" style={{ left: `${xAt(active!)}%` }}>
            <strong>Not reported</strong>
            <span>{formatX(hp.x)}</span>
          </div>
        )}
      </div>
      {!compact && (
        <div className="lc-x" aria-hidden="true">
          <span>{formatX(points[0].x)}</span>
          <span>{formatX(points[points.length - 1].x)}</span>
        </div>
      )}
    </div>
  );
}
