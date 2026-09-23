'use client';

import { useState } from 'react';
import {
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  SEVERITY_ORDER,
  type SeverityLevel,
} from '@/lib/severity';

export interface RegionRow {
  code: string;
  label: string;
  counts: Record<SeverityLevel, number>;
  total: number;
}

interface Tip {
  x: number;
  y: number;
  region: string;
  level: SeverityLevel;
  n: number;
  total: number;
}

/**
 * Records per WHO region, stacked by severity.
 *
 * Built to the dataviz mark spec: one axis, segments ordered most-severe
 * first, a 2px surface gap between fills, a legend (two or more series) plus a
 * direct total on each row, a per-segment hover tooltip, and a table view so
 * the numbers are never carried by colour alone.
 */
export function RegionBars({ rows }: { rows: RegionRow[] }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.total));

  return (
    <div className="rb">
      <div className="rb-legend" aria-hidden="true">
        {SEVERITY_ORDER.map((lvl) => (
          <span key={lvl} className="sev" style={{ ['--sev-color' as string]: SEVERITY_COLOR[lvl] }}>
            {SEVERITY_LABEL[lvl]}
          </span>
        ))}
      </div>

      <div className="rb-rows" role="img" aria-label="Records by WHO region, stacked by severity. A table view follows.">
        {rows.map((r) => (
          <div key={r.code} className="rb-row">
            <div className="rb-label" title={r.label}>{r.label}</div>
            <div className="rb-track">
              <div className="rb-bar" style={{ width: `${(r.total / max) * 100}%` }}>
                {SEVERITY_ORDER.filter((lvl) => r.counts[lvl] > 0).map((lvl) => (
                  <span
                    key={lvl}
                    className="rb-seg"
                    style={{ flexGrow: r.counts[lvl], background: SEVERITY_COLOR[lvl] }}
                    onMouseMove={(e) => {
                      const host = (e.currentTarget.closest('.rb') as HTMLElement).getBoundingClientRect();
                      setTip({
                        x: e.clientX - host.left,
                        y: e.clientY - host.top,
                        region: r.label,
                        level: lvl,
                        n: r.counts[lvl],
                        total: r.total,
                      });
                    }}
                    onMouseLeave={() => setTip(null)}
                  />
                ))}
              </div>
            </div>
            <div className="rb-total">{r.total}</div>
          </div>
        ))}
      </div>

      {tip && (
        <div className="rb-tip" style={{ left: tip.x + 12, top: tip.y - 8 }}>
          <div style={{ color: 'var(--ink-1)', fontWeight: 600 }}>{tip.region}</div>
          <div className="sev" style={{ ['--sev-color' as string]: SEVERITY_COLOR[tip.level] }}>
            {SEVERITY_LABEL[tip.level]}: {tip.n} of {tip.total} records
          </div>
        </div>
      )}

      <details className="rb-table">
        <summary>Show as table</summary>
        <div className="table-wrap">
          <table className="dt">
            <thead>
              <tr>
                <th>Region</th>
                {SEVERITY_ORDER.map((lvl) => (
                  <th key={lvl} className="num">{SEVERITY_LABEL[lvl]}</th>
                ))}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code}>
                  <td>{r.label}</td>
                  {SEVERITY_ORDER.map((lvl) => (
                    <td key={lvl} className="num">{r.counts[lvl]}</td>
                  ))}
                  <td className="num">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
