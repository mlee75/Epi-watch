'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { SeverityBadge } from './SeverityBadge';
import { fmtCount } from '@/lib/format';

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

interface Props {
  countryName: string;
  threatLevel: string | null;
  outbreaks: CountryOutbreak[];
  onClose?: () => void;
  onViewFull?: () => void;
}

/**
 * Country card shown over the globe.
 *
 * Removed from the previous version: a "travel risk" score computed with a
 * different formula from the travel estimate tool (so the two disagreed for
 * the same country), a green "No Active Outbreaks" for countries that simply
 * have no records, a "30 days" label on search results that have no date
 * limit, and flag emoji.
 */
export function CountryTooltip({ countryName, threatLevel, outbreaks, onClose, onViewFull }: Props) {
  const [articles, setArticles] = useState<HealthArticle[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);

  useEffect(() => {
    setLoadingArticles(true);
    const gnewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(countryName + ' disease outbreak epidemic health')}&hl=en-US&gl=US&ceid=US:en`;
    fetch(`/api/news-proxy?url=${encodeURIComponent(gnewsUrl)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setArticles(data.articles ?? []))
      .catch(() => setArticles([]))
      .finally(() => setLoadingArticles(false));
  }, [countryName]);

  return (
    <div className="ct" role="dialog" aria-label={countryName}>
      <div className="ct-head">
        <div style={{ minWidth: 0 }}>
          <div className="ct-name">{countryName}</div>
          <div className="ct-sub">
            {threatLevel ? (
              <>Highest severity on record <SeverityBadge severity={threatLevel} size="sm" /></>
            ) : (
              'No records in Epi-watch'
            )}
          </div>
        </div>
        {onClose && (
          <button type="button" className="ct-close" onClick={onClose} aria-label="Close">×</button>
        )}
      </div>

      <div className="ct-body">
        {outbreaks.length > 0 ? (
          <section>
            <h3 className="ct-h">Records ({outbreaks.length})</h3>
            <table className="dt ct-table">
              <thead>
                <tr><th>Disease</th><th className="num">Cases</th><th className="num">Deaths</th><th>Severity</th></tr>
              </thead>
              <tbody>
                {outbreaks.slice(0, 5).map((o, i) => (
                  <tr key={i}>
                    <td>{o.disease}</td>
                    <td className="num">{fmtCount(o.cases)}</td>
                    <td className="num">{fmtCount(o.deaths)}</td>
                    <td><SeverityBadge severity={o.severity} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {outbreaks.length > 5 && (
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {outbreaks.length - 5} more on the records page.
              </p>
            )}
          </section>
        ) : (
          <p className="muted" style={{ fontSize: 12.5 }}>
            No record doesn&rsquo;t mean no disease activity — only that none of the monitored
            sources has produced one.
          </p>
        )}

        <section>
          <h3 className="ct-h">Recent coverage <span className="muted" style={{ fontWeight: 400 }}>· Google News</span></h3>
          {loadingArticles ? (
            <p className="muted" style={{ fontSize: 12.5 }}>Loading…</p>
          ) : articles.length > 0 ? (
            <ul className="ct-news">
              {articles.slice(0, 5).map((a, i) => (
                <li key={i}>
                  <a href={a.url} target="_blank" rel="noopener noreferrer">{a.title}</a>
                  <span className="muted">
                    {a.source}
                    {a.publishedAt && ` · ${formatDistanceToNow(new Date(a.publishedAt), { addSuffix: true })}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ fontSize: 12.5 }}>No results.</p>
          )}
        </section>
      </div>

      {onViewFull && outbreaks.length > 0 && (
        <div className="ct-foot">
          <button type="button" className="link ob-clear" onClick={onViewFull}>
            Open record details
          </button>
        </div>
      )}
    </div>
  );
}
