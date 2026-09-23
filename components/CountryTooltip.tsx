'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { SeverityBadge } from './SeverityBadge';
import { LineChart } from './dashboard/LineChart';
import { fmtCount, fmtDateShort, fmtNumber } from '@/lib/format';

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

interface HospitalSummary {
  sari: {
    latestWeek: string;
    settledWeek: string | null;
    settledCases: number | null;
    provisionalWeeks: number;
    cases: number | null;
    priorMean: number | null;
    change: number | null;
    weeks: { week: string; cases: number | null }[];
  } | null;
  us: { week: string; covid: number | null; flu: number | null; rsv: number | null; bedOccPct: number | null }[] | null;
}

interface Props {
  countryName: string;
  iso3?: string;
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
export function CountryTooltip({ countryName, iso3, threatLevel, outbreaks, onClose, onViewFull }: Props) {
  const [articles, setArticles] = useState<HealthArticle[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [hospital, setHospital] = useState<HospitalSummary | null>(null);

  useEffect(() => {
    setHospital(null);
    if (!iso3 || !/^[A-Z]{3}$/i.test(iso3)) return;
    const ctrl = new AbortController();
    fetch(`/api/live/country?iso3=${iso3}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setHospital(d))
      .catch(() => {});
    return () => ctrl.abort();
  }, [iso3]);

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

        {hospital?.sari && (
          <section>
            <h3 className="ct-h">
              Hospital SARI admissions <span className="muted" style={{ fontWeight: 400 }}>· WHO FluID</span>
            </h3>
            <div className="ct-hosp">
              <div>
                <div className="ct-hosp-value">
                  {hospital.sari.settledCases != null ? fmtNumber(hospital.sari.settledCases) : '–'}
                </div>
                <div className="muted" style={{ fontSize: 11.5 }}>
                  {hospital.sari.settledWeek ? `Week of ${fmtDateShort(hospital.sari.settledWeek)}` : 'No settled week yet'}
                  {hospital.sari.change != null &&
                    ` · ${hospital.sari.change > 0 ? '+' : ''}${Math.round(hospital.sari.change)}% vs prior 4 weeks`}
                  {hospital.sari.provisionalWeeks > 0 && ` · ${hospital.sari.provisionalWeeks} newer week(s) provisional`}
                </div>
              </div>
              <div style={{ width: 110 }}>
                <LineChart compact label={`Weekly SARI admissions, ${countryName}`}
                  points={hospital.sari.weeks.map((w) => ({ x: w.week, y: w.cases }))} />
              </div>
            </div>
          </section>
        )}
        {hospital?.us && hospital.us.length > 0 && (() => {
          const w = hospital.us[hospital.us.length - 1];
          return (
            <section>
              <h3 className="ct-h">
                New hospital admissions <span className="muted" style={{ fontWeight: 400 }}>· CDC NHSN, week to {fmtDateShort(w.week)}</span>
              </h3>
              <dl className="drawer-facts" style={{ fontSize: 12.5 }}>
                <dt>COVID-19</dt><dd>{w.covid != null ? fmtNumber(w.covid) : '–'}</dd>
                <dt>Influenza</dt><dd>{w.flu != null ? fmtNumber(w.flu) : '–'}</dd>
                <dt>RSV</dt><dd>{w.rsv != null ? fmtNumber(w.rsv) : '–'}</dd>
                {w.bedOccPct != null && (<><dt>Beds occupied</dt><dd>{w.bedOccPct.toFixed(1)}%</dd></>)}
              </dl>
            </section>
          );
        })()}
        {(hospital?.sari || (hospital?.us && hospital.us.length > 0)) && (
          <Link href="/hospitals" className="link" style={{ fontSize: 12 }}>All hospital data</Link>
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
