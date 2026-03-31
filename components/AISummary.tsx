'use client';

import { useState, useEffect, useCallback } from 'react';

interface SummaryData {
  executive: string;
  keyPoints: Array<{ icon: string; title: string; description: string }>;
  recommendations: string[];
}

export function AISummary() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/ai/summary');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSummary(data.summary);
      setGeneratedAt(data.generatedAt);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const openChat = (question?: string) => {
    window.dispatchEvent(new CustomEvent('open-ai-chat', { detail: { question } }));
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: '1px solid rgba(96,165,250,0.15)',
      borderRadius: 16,
      padding: '20px 24px',
      marginBottom: 32,
      boxShadow: '0 8px 40px rgba(0,0,0,0.4), 0 0 60px rgba(59,130,246,0.05)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11,
            background: 'linear-gradient(135deg, rgba(59,130,246,0.8) 0%, rgba(139,92,246,0.8) 100%)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
            boxShadow: '0 0 20px rgba(96,165,250,0.3)',
          }}>✦</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', letterSpacing: '0.02em' }}>
              AI Intelligence Briefing
            </div>
            <div style={{
              fontSize: 10, color: '#60a5fa',
              fontFamily: 'var(--font-mono), Space Mono, monospace',
              letterSpacing: '0.08em',
            }}>
              Powered by Claude · Auto-updated every 30 min
            </div>
          </div>
        </div>
        <button
          onClick={fetchSummary}
          disabled={loading}
          style={{
            padding: '6px 14px', fontSize: 11, fontWeight: 600,
            color: loading ? 'rgba(148,163,184,0.4)' : '#60a5fa',
            background: loading ? 'rgba(255,255,255,0.02)' : 'rgba(96,165,250,0.08)',
            border: `1px solid ${loading ? 'rgba(255,255,255,0.06)' : 'rgba(96,165,250,0.2)'}`,
            borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-mono), Space Mono, monospace',
            letterSpacing: '0.06em',
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.15s',
          }}
        >
          <span style={{ display: 'inline-block', animation: loading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
          {loading ? 'Generating…' : 'Regenerate'}
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[100, 85, 70].map((w, i) => (
            <div key={i} style={{
              height: 13,
              background: 'linear-gradient(90deg, rgba(96,165,250,0.06) 0%, rgba(96,165,250,0.12) 50%, rgba(96,165,250,0.06) 100%)',
              backgroundSize: '200% 100%',
              borderRadius: 6, width: `${w}%`,
              animation: 'shimmer 2s linear infinite',
            }} />
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                flex: 1, height: 88,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
                borderRadius: 12,
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{ fontSize: 12, color: '#ef4444', padding: '8px 0' }}>
          Failed to generate briefing.{' '}
          <button onClick={fetchSummary} style={{
            color: '#60a5fa', background: 'none', border: 'none',
            cursor: 'pointer', fontSize: 12, fontWeight: 600,
          }}>
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && summary && (
        <div>
          {/* Executive summary */}
          <p style={{ fontSize: 13, color: 'rgba(203,213,225,0.9)', lineHeight: 1.7, marginBottom: 16 }}>
            {summary.executive}
          </p>

          {/* Key points */}
          {summary.keyPoints?.length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              {summary.keyPoints.map((point, i) => (
                <div key={i} style={{
                  flex: 1, minWidth: 200,
                  background: 'rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(96,165,250,0.12)',
                  borderRadius: 12, padding: '12px 14px',
                  transition: 'all 0.2s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{point.icon}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', marginBottom: 4 }}>
                        {point.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.8)', lineHeight: 1.55 }}>
                        {point.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {summary.recommendations?.length > 0 && (
            <div style={{
              background: 'rgba(139,92,246,0.05)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(139,92,246,0.15)',
              borderRadius: 12, padding: '12px 16px', marginBottom: 14,
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700, color: '#a78bfa',
                fontFamily: 'var(--font-mono), Space Mono, monospace',
                letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10,
              }}>
                📋 Key Recommendations
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {summary.recommendations.map((rec, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'rgba(196,181,253,0.9)' }}>
                    <span style={{ color: '#7c3aed', flexShrink: 0, fontWeight: 700 }}>→</span>
                    {rec}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            {generatedAt && (
              <span style={{
                fontSize: 10, color: 'rgba(71,85,105,0.8)',
                fontFamily: 'var(--font-mono), Space Mono, monospace',
              }}>
                Generated {new Date(generatedAt).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => openChat('Give me a detailed intelligence briefing on the current global disease situation')}
              style={{
                fontSize: 11, color: '#60a5fa', background: 'none', border: 'none',
                cursor: 'pointer', fontWeight: 600, letterSpacing: '0.04em',
                display: 'flex', alignItems: 'center', gap: 5,
                transition: 'color 0.15s',
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.color = '#93c5fd'; }}
              onMouseOut={(e)  => { (e.currentTarget as HTMLElement).style.color = '#60a5fa'; }}
            >
              💬 Ask AI for more details →
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </div>
  );
}
