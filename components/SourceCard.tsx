'use client';

import { formatDistanceToNow } from 'date-fns';
import type { OutbreakSource } from '@/lib/types';

const SOURCE_TYPE_LABEL: Record<string, string> = {
  official:   'OFFICIAL',
  'major-news': 'PRESS',
  academic:   'ACADEMIC',
  'local-news': 'LOCAL',
  news:       'NEWS',
};

const LANG_FLAG: Record<string, string> = {
  en: '🇬🇧', fr: '🇫🇷', es: '🇪🇸', pt: '🇧🇷', ar: '🇸🇦', zh: '🇨🇳',
  ru: '🇷🇺', de: '🇩🇪', ja: '🇯🇵', ko: '🇰🇷', hi: '🇮🇳', sw: '🇰🇪',
};

interface Props {
  source: OutbreakSource;
  expanded?: boolean;
}

export function SourceCard({ source, expanded = false }: Props) {
  const cardBg = '#0d1129';
  const border = '#1e2749';

  const timeAgo = source.publishedAt
    ? formatDistanceToNow(new Date(source.publishedAt), { addSuffix: true })
    : null;

  const reliabilityFilled = Math.round(source.reliabilityScore);
  const stars = '★'.repeat(reliabilityFilled) + '☆'.repeat(5 - reliabilityFilled);
  const starColor = reliabilityFilled >= 4 ? '#ffd700' : reliabilityFilled >= 3 ? '#ff6b00' : '#6b7280';

  const isNonEnglish = source.sourceLanguage && source.sourceLanguage !== 'en';

  return (
    <div
      style={{
        background: cardBg, border: `1px solid ${border}`, borderRadius: 8,
        padding: 12, position: 'relative', transition: 'border-color 0.15s',
      }}
      onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(96,165,250,0.4)'; }}
      onMouseOut={(e)  => { (e.currentTarget as HTMLElement).style.borderColor = border; }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {/* Source name */}
          <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>
            {source.sourceName}
          </span>
          {/* Source type badge */}
          <span style={{
            fontSize: 9, fontFamily: 'var(--font-mono, monospace)', fontWeight: 700,
            color: source.sourceType === 'official' ? '#60a5fa' : '#6b7280',
            background: source.sourceType === 'official' ? 'rgba(96,165,250,0.08)' : 'rgba(107,114,128,0.08)',
            border: `1px solid ${source.sourceType === 'official' ? 'rgba(96,165,250,0.25)' : 'rgba(107,114,128,0.2)'}`,
            padding: '1px 5px', borderRadius: 3, letterSpacing: '0.06em',
          }}>
            {SOURCE_TYPE_LABEL[source.sourceType] ?? 'NEWS'}
          </span>
          {/* Language badge */}
          {isNonEnglish && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono, monospace)', color: '#a0a8c8',
              background: '#141938', border: `1px solid ${border}`,
              padding: '1px 5px', borderRadius: 3,
            }}>
              {LANG_FLAG[source.sourceLanguage] ?? '🌐'} {source.sourceLanguage.toUpperCase()} → EN
            </span>
          )}
          {/* Verified badge */}
          {source.isVerified && (
            <span style={{ fontSize: 10, color: '#00ff00' }}>✓</span>
          )}
        </div>
        {/* Stars */}
        <span style={{ fontSize: 11, color: starColor, fontFamily: 'var(--font-mono, monospace)', flexShrink: 0 }}>
          {stars}
        </span>
      </div>

      {/* Article title (clickable link) */}
      <a
        href={source.articleUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'block', fontSize: 13, fontWeight: 600, color: '#60a5fa',
          textDecoration: 'none', lineHeight: 1.4, marginBottom: 6,
          transition: 'color 0.15s',
        }}
        onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.color = '#3b82f6'; (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
        onMouseOut={(e)  => { (e.currentTarget as HTMLElement).style.color = '#60a5fa'; (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
      >
        {source.articleTitle}
        <svg style={{ display: 'inline', marginLeft: 4, width: 11, height: 11, verticalAlign: 'middle' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>

      {/* Excerpt */}
      {source.articleExcerpt && (
        <p style={{
          fontSize: 11, color: '#a0a8c8', lineHeight: 1.5, marginBottom: 6,
          overflow: expanded ? undefined : 'hidden',
          display: expanded ? undefined : '-webkit-box',
          WebkitLineClamp: expanded ? undefined : 2,
          WebkitBoxOrient: expanded ? undefined : 'vertical' as const,
        }}>
          {source.articleExcerpt}
        </p>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: '#6b7280', fontFamily: 'var(--font-mono, monospace)' }}>
        <span>{timeAgo ?? 'Date unknown'}</span>
        {source.verifiedBy && (
          <span style={{ color: '#00ff00' }}>✓ {source.verifiedBy}</span>
        )}
      </div>
    </div>
  );
}
