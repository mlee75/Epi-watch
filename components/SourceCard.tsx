'use client';

import { formatDistanceToNow } from 'date-fns';
import type { OutbreakSource } from '@/lib/types';

const SOURCE_TYPE_LABEL: Record<string, string> = {
  official: 'Health agency',
  'major-news': 'Media',
  academic: 'Academic',
  'local-news': 'Local media',
  news: 'Media',
};

interface Props {
  source: OutbreakSource;
  expanded?: boolean;
}

// No reliability stars: the score defaults to 3 in the schema, so stars
// could show a rating nobody had assigned.
export function SourceCard({ source, expanded = false }: Props) {
  const timeAgo = source.publishedAt
    ? formatDistanceToNow(new Date(source.publishedAt), { addSuffix: true })
    : null;
  const translated = source.sourceLanguage && source.sourceLanguage !== 'en';

  return (
    <div className="src-card">
      <a className="src-title" href={source.articleUrl} target="_blank" rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}>
        {source.articleTitle}
      </a>
      {source.articleExcerpt && (
        <p className={expanded ? 'src-excerpt' : 'src-excerpt line-clamp-2'}>{source.articleExcerpt}</p>
      )}
      <div className="news-meta">
        <span>{source.sourceName}</span>
        <span className="tag">{SOURCE_TYPE_LABEL[source.sourceType] ?? 'Media'}</span>
        {translated && <span className="tag">Translated from {source.sourceLanguage.toUpperCase()}</span>}
        <span>{timeAgo ?? 'Date unknown'}</span>
      </div>
    </div>
  );
}
