/**
 * Display formatting shared across the dashboard.
 *
 * A stored count of 0 means the source stated no figure, not that the true
 * figure is zero (see the ingest's headline-only extraction), so counts render
 * as an en dash when absent. Every table and tile uses these helpers so that
 * convention cannot drift between pages.
 */

const NUMBER = new Intl.NumberFormat('en-GB');

export const UNREPORTED = '–';

export function fmtCount(n: number | null | undefined): string {
  return n && n > 0 ? NUMBER.format(n) : UNREPORTED;
}

export function fmtNumber(n: number): string {
  return NUMBER.format(n);
}

/** Case fatality ratio — only meaningful when both figures were reported. */
export function fmtCfr(cases: number, deaths: number): string {
  if (!cases || cases <= 0 || !deaths || deaths <= 0) return UNREPORTED;
  const pct = (deaths / cases) * 100;
  return `${pct < 0.1 ? '<0.1' : pct.toFixed(1)}%`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export const REGION_LABEL: Record<string, string> = {
  AFRO: 'Africa',
  AMRO: 'Americas',
  EMRO: 'Eastern Mediterranean',
  EURO: 'Europe',
  SEARO: 'South-East Asia',
  WPRO: 'Western Pacific',
  OTHER: 'Multi-country or unattributed',
};

export function regionLabel(code: string): string {
  return REGION_LABEL[code] ?? code;
}
