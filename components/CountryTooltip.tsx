'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface CountryOutbreak {
  disease: string;
  severity: string;
  cases: number;
  deaths: number;
}

interface HealthArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
}

interface CountryData {
  name: string;
  flag: string;
  threatLevel: string | null;
  outbreaks: CountryOutbreak[];
  articles: HealthArticle[];
  loading: boolean;
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#ff0000',
  HIGH:     '#ff6b00',
  MEDIUM:   '#ffd700',
  LOW:      '#00ff00',
};

const SEV_BG: Record<string, string> = {
  CRITICAL: 'rgba(255,0,0,0.08)',
  HIGH:     'rgba(255,107,0,0.08)',
  MEDIUM:   'rgba(255,215,0,0.08)',
  LOW:      'rgba(0,255,0,0.06)',
};

const fmtNum = (n: number) =>
  n > 0 ? n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '—';

// ── Inline travel-risk score (same logic as /api/travel/risk-assessment) ────
const REGION_HEALTHCARE: Record<string, number> = {
  EURO: 8, AMRO: 7, WPRO: 7, EMRO: 5, SEARO: 4, AFRO: 3,
};

function computeTravelRisk(
  outbreaks: CountryOutbreak[],
  threatLevel: string | null,
): { score: number; level: string } {
  let diseaseRisk = 1;
  for (const o of outbreaks) {
    if (o.severity === 'CRITICAL') diseaseRisk += 3;
    else if (o.severity === 'HIGH') diseaseRisk += 2;
    else if (o.severity === 'MEDIUM') diseaseRisk += 1;
    else diseaseRisk += 0.5;
  }
  diseaseRisk = Math.min(10, Math.round(diseaseRisk));

  // Approximate healthcare from threat level if we don't know region
  const hc = threatLevel === 'CRITICAL' ? 3 : threatLevel === 'HIGH' ? 4 : threatLevel === 'MEDIUM' ? 6 : 7;
  const raw = (diseaseRisk / 10) * 50 + ((10 - hc) / 10) * 30 + 5; // 7-day default
  const score = Math.min(100, Math.max(5, Math.round(raw)));
  const level = score >= 70 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW';
  return { score, level };
}

const RISK_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH:     '#f97316',
  MEDIUM:   '#eab308',
  LOW:      '#22c55e',
};

// Country name → flag emoji
function countryFlag(name: string): string {
  const flags: Record<string, string> = {
    'United States': '🇺🇸', 'Brazil': '🇧🇷', 'India': '🇮🇳', 'China': '🇨🇳',
    'Russia': '🇷🇺', 'Germany': '🇩🇪', 'France': '🇫🇷', 'United Kingdom': '🇬🇧',
    'Japan': '🇯🇵', 'Australia': '🇦🇺', 'Canada': '🇨🇦', 'Mexico': '🇲🇽',
    'Nigeria': '🇳🇬', 'Ethiopia': '🇪🇹', 'Egypt': '🇪🇬', 'South Africa': '🇿🇦',
    'Kenya': '🇰🇪', 'Tanzania': '🇹🇿', 'Uganda': '🇺🇬', 'Ghana': '🇬🇭',
    'Democratic Republic of Congo': '🇨🇩', 'Cameroon': '🇨🇲',
    'Pakistan': '🇵🇰', 'Bangladesh': '🇧🇩', 'Indonesia': '🇮🇩',
    'Philippines': '🇵🇭', 'Vietnam': '🇻🇳', 'Thailand': '🇹🇭',
    'Saudi Arabia': '🇸🇦', 'Iraq': '🇮🇶', 'Iran': '🇮🇷', 'Afghanistan': '🇦🇫',
    'Ukraine': '🇺🇦', 'Poland': '🇵🇱', 'Turkey': '🇹🇷', 'Spain': '🇪🇸',
    'Italy': '🇮🇹', 'Colombia': '🇨🇴', 'Venezuela': '🇻🇪', 'Peru': '🇵🇪',
    'Argentina': '🇦🇷', 'Chile': '🇨🇱', 'Cuba': '🇨🇺', 'Haiti': '🇭🇹',
    'Yemen': '🇾🇪', 'Syria': '🇸🇾', 'Somalia': '🇸🇴', 'Sudan': '🇸🇩',
    'Zimbabwe': '🇿🇼', 'Zambia': '🇿🇲', 'Mozambique': '🇲🇿',
    'Guinea': '🇬🇳', 'Sierra Leone': '🇸🇱', 'Liberia': '🇱🇷',
    'Ivory Coast': '🇨🇮', 'Senegal': '🇸🇳', 'Mali': '🇲🇱',
    'Morocco': '🇲🇦', 'Algeria': '🇩🇿', 'Libya': '🇱🇾',
    'Bolivia': '🇧🇴', 'Paraguay': '🇵🇾', 'Ecuador': '🇪🇨',
    'Guatemala': '🇬🇹', 'Honduras': '🇭🇳', 'Nicaragua': '🇳🇮',
    'Multiple Countries': '🌍',
  };
  return flags[name] || '🏴';
}

interface Props {
  countryName: string;
  threatLevel: string | null;
  outbreaks: CountryOutbreak[];
  onClose?: () => void;
  onViewFull?: () => void;
}

export function CountryTooltip({ countryName, threatLevel, outbreaks, onClose, onViewFull }: Props) {
  const [articles, setArticles] = useState<HealthArticle[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);

  useEffect(() => {
    setLoadingArticles(true);
    // Fetch Google News RSS for this country via our existing route
    const gnewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(countryName + ' disease outbreak epidemic health')}&hl=en-US&gl=US&ceid=US:en`;

    fetch(`/api/news-proxy?url=${encodeURIComponent(gnewsUrl)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setArticles(data.articles ?? []))
      .catch(() => setArticles([]))
      .finally(() => setLoadingArticles(false));
  }, [countryName]);

  const flag = countryFlag(countryName);
  const color = threatLevel ? SEV_COLOR[threatLevel] : '#4b5563';
  const bg = threatLevel ? SEV_BG[threatLevel] : 'rgba(75,85,99,0.08)';

  return (
    <div style={{
      position: 'absolute',
      top: 80, right: 12,
      width: 380,
      maxHeight: 'calc(100% - 100px)',
      background: 'rgba(10,14,39,0.97)',
      backdropFilter: 'blur(20px)',
      border: `1px solid ${color}44`,
      borderRadius: 12,
      boxShadow: `0 0 40px ${color}20, 0 16px 48px rgba(0,0,0,0.8)`,
      zIndex: 20,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column' as const,
      fontFamily: 'var(--font-inter, system-ui)',
    }}>
      {/* Header */}
      <div style={{
        background: bg,
        borderBottom: `1px solid ${color}30`,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 26 }}>{flag}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', lineHeight: 1.2 }}>
              {countryName}
            </div>
            <div style={{
              fontSize: 9, fontWeight: 700, color: color,
              fontFamily: 'var(--font-mono, monospace)',
              letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2,
            }}>
              {threatLevel ? `${threatLevel} THREAT` : 'MONITORING'}
            </div>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px' }}
          >
            ×
          </button>
        )}
      </div>

      <div style={{ padding: '12px 14px', maxHeight: 360, overflowY: 'auto' }}>
        {/* Active Outbreaks */}
        {outbreaks.length > 0 ? (
          <div style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, color: '#ff0000',
              fontFamily: 'var(--font-mono, monospace)',
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6,
            }}>
              ⚠ Active Outbreaks ({outbreaks.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {outbreaks.slice(0, 3).map((o, i) => (
                <div key={i} style={{
                  background: '#141938',
                  border: `1px solid ${SEV_COLOR[o.severity] ?? '#1e2749'}44`,
                  borderRadius: 8,
                  padding: '8px 10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>{o.disease}</span>
                    <span style={{
                      fontSize: 8, fontWeight: 700,
                      color: SEV_COLOR[o.severity] ?? '#6b7280',
                      fontFamily: 'var(--font-mono, monospace)',
                      letterSpacing: '0.08em',
                      background: `${SEV_COLOR[o.severity] ?? '#6b7280'}18`,
                      border: `1px solid ${SEV_COLOR[o.severity] ?? '#6b7280'}33`,
                      borderRadius: 4, padding: '1px 5px',
                    }}>
                      {o.severity}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span style={{ fontSize: 10, color: '#a0a8c8' }}>
                      📊 {fmtNum(o.cases)} cases
                    </span>
                    <span style={{ fontSize: 10, color: '#a0a8c8' }}>
                      💀 {fmtNum(o.deaths)} deaths
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{
            background: 'rgba(0,255,0,0.04)',
            border: '1px solid rgba(0,255,0,0.2)',
            borderRadius: 8,
            padding: '8px 12px',
            marginBottom: 14,
            textAlign: 'center',
          }}>
            <span style={{ fontSize: 12, color: '#00ff00', fontWeight: 600 }}>
              ✓ No Active Outbreaks
            </span>
          </div>
        )}

        {/* Recent Health News */}
        <div>
          <div style={{
            fontSize: 9, fontWeight: 700, color: '#60a5fa',
            fontFamily: 'var(--font-mono, monospace)',
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>📰 Health Reports</span>
            <span style={{ color: '#6b7280', fontWeight: 400 }}>30 days</span>
          </div>

          {loadingArticles ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[70, 90, 80].map((w, i) => (
                <div key={i} style={{
                  height: 44, background: '#141938', borderRadius: 6,
                  width: `${w}%`, animation: 'pulse 1.5s ease-in-out infinite',
                }} />
              ))}
            </div>
          ) : articles.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {articles.slice(0, 5).map((a, i) => (
                <a
                  key={i}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    background: '#141938',
                    border: '1px solid #1e2749',
                    borderRadius: 7,
                    padding: '7px 9px',
                    textDecoration: 'none',
                    cursor: 'pointer',
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = '#1e2749')}
                  onMouseOut={e => (e.currentTarget.style.background = '#141938')}
                >
                  <div style={{
                    fontSize: 11, color: '#ffffff', lineHeight: 1.4,
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    marginBottom: 4,
                  }}>
                    {a.title}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: '#60a5fa', fontFamily: 'var(--font-mono, monospace)' }}>
                      {a.source}
                    </span>
                    {a.publishedAt && (
                      <span style={{ fontSize: 9, color: '#6b7280' }}>
                        {formatDistanceToNow(new Date(a.publishedAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', padding: '10px 0' }}>
              No recent health reports
            </div>
          )}
        </div>
      </div>

      {/* Travel Risk Score */}
      {(() => {
        const risk = computeTravelRisk(outbreaks, threatLevel);
        const riskColor = RISK_COLORS[risk.level] ?? '#6b7280';
        return (
          <div style={{
            borderTop: '1px solid #1e2749',
            padding: '10px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: `${riskColor}08`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#6b7280', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Travel Risk
              </span>
              <span style={{
                fontSize: 8, fontWeight: 700, color: riskColor,
                fontFamily: 'var(--font-mono, monospace)',
                letterSpacing: '0.08em',
                background: `${riskColor}18`,
                border: `1px solid ${riskColor}33`,
                borderRadius: 4, padding: '1px 5px',
              }}>
                {risk.level}
              </span>
            </div>
            <span style={{
              fontSize: 18, fontWeight: 800, color: riskColor,
              fontFamily: 'var(--font-mono, monospace)',
            }}>
              {risk.score}<span style={{ fontSize: 10, color: '#6b7280' }}>/100</span>
            </span>
          </div>
        );
      })()}

      {/* Footer */}
      {onViewFull && (
        <div style={{
          borderTop: '1px solid #1e2749',
          padding: '8px 14px',
          textAlign: 'center',
        }}>
          <button
            onClick={onViewFull}
            style={{
              fontSize: 11, color: '#60a5fa', background: 'none', border: 'none',
              cursor: 'pointer', fontWeight: 700, letterSpacing: '0.02em',
            }}
            onMouseOver={e => (e.currentTarget.style.color = '#93c5fd')}
            onMouseOut={e => (e.currentTarget.style.color = '#60a5fa')}
          >
            View Full Intelligence Report →
          </button>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
