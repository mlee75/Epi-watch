/**
 * Severity — the single source of truth for how a severity level looks and
 * what it means. Eight components previously carried their own colour maps,
 * which is why severity colours disagreed across pages.
 *
 * Colours were chosen with the dataviz validator against the dark chart
 * surface (#1a1a19), on ALL pairs, because the globe can place any two
 * severities on neighbouring countries:
 *
 *   worst CVD ΔE 12.0 (target ≥ 8) · worst normal-vision ΔE 16.3 (floor 15)
 *   · every step ≥ 3:1 contrast against the surface
 *
 * The previous amber/orange pair measured ΔE 13.6 — below the floor, so
 * MEDIUM and HIGH countries were hard to tell apart even with full colour
 * vision.
 *
 * LOW is deliberately neutral grey rather than green. Green reads as "safe",
 * and a low-severity outbreak is still an outbreak. Because hue alone never
 * carries the level, every use pairs the colour with its text label.
 */

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export const SEVERITY_ORDER: SeverityLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export const SEVERITY_COLOR: Record<SeverityLevel, string> = {
  CRITICAL: '#c93545',
  HIGH: '#ec7a3c',
  MEDIUM: '#e8c547',
  LOW: '#8a8f99',
};

export const SEVERITY_LABEL: Record<SeverityLevel, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

/**
 * Mirrors classifySeverity() in lib/classifiers.ts. Severity is triggered by
 * cases OR deaths — the old legend quoted case thresholds only, which
 * misdescribed any record classified on deaths.
 */
export const SEVERITY_RULE: Record<SeverityLevel, string> = {
  CRITICAL: '> 10,000 cases or > 1,000 deaths',
  HIGH: '> 1,000 cases or > 100 deaths',
  MEDIUM: '> 100 cases or > 10 deaths',
  LOW: 'Below medium, or figures unreported',
};

/** Colour for countries with no active record — sits well below every level. */
export const NO_RECORD_COLOR = '#2c2c2a';

export function normalizeSeverity(value: string | null | undefined): SeverityLevel {
  const v = (value ?? '').toUpperCase();
  if (v === 'CRITICAL' || v === 'HIGH' || v === 'MEDIUM' || v === 'LOW') return v;
  if (v === 'MODERATE') return 'MEDIUM';
  return 'LOW';
}

export function severityColor(value: string | null | undefined): string {
  return SEVERITY_COLOR[normalizeSeverity(value)];
}

export function severityRank(value: string | null | undefined): number {
  return SEVERITY_ORDER.indexOf(normalizeSeverity(value));
}

/** Hex → rgba, for fills that need translucency over the globe texture. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
