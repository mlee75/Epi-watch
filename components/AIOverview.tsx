'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface OverviewData {
  summary: string;
  keyInsights: string[];
  trendAnalysis: string;
  riskAssessment: string;
  generatedAt: string;
  sourceCount: number;
}

interface Props {
  outbreakId: string;
}

/**
 * Model-written summary of a record. Labelled as generated text, with its
 * inputs, so it isn't mistaken for agency reporting. Only mounted when the
 * server has an Anthropic key; without one the endpoint always failed.
 */
export function AIOverview({ outbreakId }: Props) {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/ai/overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outbreakId }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setOverview(json.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [outbreakId]);

  useEffect(() => { generate(); }, [generate]);

  if (error) return null;

  return (
    <section className="drawer-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <h3 className="ct-h">Generated summary</h3>
        <button type="button" className="link ob-clear" onClick={generate} disabled={loading}>
          {loading ? 'Generating…' : 'Regenerate'}
        </button>
      </div>
      {loading ? (
        <p className="muted" style={{ fontSize: 12.5 }}>Generating…</p>
      ) : overview ? (
        <div style={{ display: 'grid', gap: 10, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
          <p>{overview.summary}</p>
          {overview.keyInsights.length > 0 && (
            <ul className="trc-list">
              {overview.keyInsights.map((k, i) => <li key={i}>{k}</li>)}
            </ul>
          )}
          {overview.trendAnalysis && <p><strong style={{ color: 'var(--ink-1)' }}>Trend.</strong> {overview.trendAnalysis}</p>}
          {overview.riskAssessment && <p><strong style={{ color: 'var(--ink-1)' }}>Risk.</strong> {overview.riskAssessment}</p>}
          <p className="muted" style={{ fontSize: 11.5 }}>
            Written by a language model from {overview.sourceCount} source
            {overview.sourceCount !== 1 ? 's' : ''}
            {overview.generatedAt && `, ${formatDistanceToNow(new Date(overview.generatedAt), { addSuffix: true })}`}.
            It can be wrong; check the source reports.
          </p>
        </div>
      ) : null}
    </section>
  );
}
