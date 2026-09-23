import { SEVERITY_COLOR, SEVERITY_LABEL, normalizeSeverity } from '@/lib/severity';

interface SeverityBadgeProps {
  severity: string;
  size?: 'sm' | 'md';
  /** Accepted for compatibility; the pulsing animation was removed with the redesign. */
  pulse?: boolean;
}

/**
 * A colour swatch plus the level name. The label always renders, so severity
 * is never communicated by colour alone.
 */
export function SeverityBadge({ severity, size = 'md' }: SeverityBadgeProps) {
  const level = normalizeSeverity(severity);
  return (
    <span
      className="sev"
      style={{
        ['--sev-color' as string]: SEVERITY_COLOR[level],
        fontSize: size === 'sm' ? 12 : 12.5,
      }}
    >
      {SEVERITY_LABEL[level]}
    </span>
  );
}
