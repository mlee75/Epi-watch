'use client';

import { useState, useEffect } from 'react';
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
  onAskAI?: (question: string) => void;
}

const border = '#1e2749';
const cardBg = '#141938';

export function AIOverview({ outbreakId, onAskAI }: Props) {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const generate = async () => {
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
  };

  useEffect(() => { generate(); }, [outbreakId]);

  const timeAgo = overview?.generatedAt
    ? formatDistanceToNow(new Date(overview.generatedAt), { addSuffix: true })
    : null;

  if (error) return null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(96,165,250,0.06) 0%, rgba(59,130,246,0.04) 100%)',
      border: '1px solid rgba(96,165,250,0.25)',
      borderRadius: 10, padding: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
          }}>✨</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>AI Overview</span>
              {timeAgo && (
                <span style={{
                  fontSize: 9, fontFamily: 'var(--font-mono, monospace)',
                  color: '#60a5fa', background: 'rgba(96,165,250,0.1)',
                  border: '1px solid rgba(96,165,250,0.2)',
                  padding: '1px 6px', borderRadius: 10,
                }}>
                  {timeAgo}
                </span>
              )}
            </div>
            <div style={{ fontSize: 10, color: '#6b7280', fontFamily: 'var(--font-mono, monospace)', marginTop: 1 }}>
              claude-haiku-4-5{overview ? ` · ${overview.sourceCount} source${overview.sourceCount !== 1 ? 's' : ''}` : ''}
            </div>
          </div>
        </div>

        <button
          onClick={generate}
          disabled={loading}
          title="Regenerate"
          style={{
            color: '#6b7280', background: 'none', border: 'none', cursor: loading ? 'default' : 'pointer',
            padding: 4, opacity: loading ? 0.5 : 1, transition: 'all 0.15s',
          }}
          onMouseOver={(e) => { if (!loading) (e.currentTarget as HTMLElement).style.color = '#60a5fa'; }}
          onMouseOut={(e)  => { (e.currentTarget as HTMLElement).style.color = '#6b7280'; }}
        >
          <svg
            style={{ width: 14, height: 14, animation: loading ? 'spin 1s linear infinite' : undefined }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[80, 100, 60].map((w, i) => (
            <div key={i} className="animate-pulse" style={{ height: 12, background: cardBg, borderRadius: 6, width: `${w}%` }} />
          ))}
        </div>
      ) : overview ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Summary */}
          <p style={{ fontSize: 12, color: '#a0a8c8', lineHeight: 1.6 }}>{overview.summary}</p>

          {/* Key insights */}
          {overview.keyInsights.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontFamily: 'var(--font-mono, monospace)' }}>
                Key Insights
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {overview.keyInsights.map((insight, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6 }}>
                    <span style={{ color: '#60a5fa', fontSize: 12, flexShrink: 0, marginTop: 1 }}>•</span>
                    <span style={{ fontSize: 12, color: '#a0a8c8', lineHeight: 1.5 }}>{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trend */}
          {overview.trendAnalysis && (
            <div style={{ background: 'rgba(20,25,56,0.6)', border: `1px solid ${border}`, borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontFamily: 'var(--font-mono, monospace)' }}>
                📈 Trend
              </div>
              <p style={{ fontSize: 12, color: '#a0a8c8', lineHeight: 1.5 }}>{overview.trendAnalysis}</p>
            </div>
          )}

          {/* Risk */}
          {overview.riskAssessment && (
            <div style={{ background: 'rgba(20,25,56,0.6)', border: `1px solid ${border}`, borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontFamily: 'var(--font-mono, monospace)' }}>
                ⚠ Risk
              </div>
              <p style={{ fontSize: 12, color: '#a0a8c8', lineHeight: 1.5 }}>{overview.riskAssessment}</p>
            </div>
          )}

          {/* Footer actions */}
          {onAskAI && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid rgba(96,165,250,0.15)' }}>
              <button
                onClick={() => onAskAI(`Tell me more about this outbreak`)}
                style={{
                  fontSize: 11, color: '#60a5fa', background: 'none', border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  fontFamily: 'inherit', transition: 'color 0.15s',
                }}
                onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.color = '#3b82f6'; }}
                onMouseOut={(e)  => { (e.currentTarget as HTMLElement).style.color = '#60a5fa'; }}
              >
                Ask AI about this
                <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      ) : null}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
