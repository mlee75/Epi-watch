/**
 * Direction-of-change badge used wherever a figure is compared with an
 * earlier one (hospital admissions, SARI cases).
 *
 * Rule, site-wide: an increase is shown in red, a decrease in blue, and a
 * change within ±STABLE_BAND percent in grey as "stable". Colour is never the
 * only cue: every badge also carries an arrow and a signed percentage. The
 * red/blue pair is the validated diverging pair (distinct under colour-vision
 * deficiency); red/green would not be.
 */

export const STABLE_BAND = 5;

interface Props {
  /** Percent change; null renders a dash. */
  pct: number | null;
  /** Accessible context, e.g. "vs prior 4-week mean". */
  context?: string;
}

export function Trend({ pct, context }: Props) {
  if (pct == null || !Number.isFinite(pct)) return <span className="muted">–</span>;
  const dir = Math.abs(pct) < STABLE_BAND ? 'flat' : pct > 0 ? 'up' : 'down';
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '→';
  const label = `${pct > 0 ? '+' : ''}${Math.round(pct)}%`;
  const word = dir === 'up' ? 'Up' : dir === 'down' ? 'Down' : 'Stable';
  return (
    <span className={`trend trend-${dir}`} title={`${word} ${label}${context ? ` ${context}` : ''}`}>
      <span aria-hidden="true">{arrow}</span> {label}
    </span>
  );
}
