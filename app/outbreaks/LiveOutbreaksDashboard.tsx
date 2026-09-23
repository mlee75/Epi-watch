'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { iso3ForName } from '@/lib/countryNames';
import type { Outbreak } from '@/lib/types';
import { SeverityBadge } from '@/components/SeverityBadge';
import { SEVERITY_LABEL, SEVERITY_ORDER, normalizeSeverity, severityRank } from '@/lib/severity';
import { REGION_LABEL, fmtCfr, fmtCount, fmtDate, fmtDateShort, regionLabel } from '@/lib/format';

interface Props {
  initialOutbreaks: Outbreak[];
  countries: string[];
  /** Rendered inside the outbreaks explorer, which has its own page header. */
  embedded?: boolean;
}

interface BriefItem {
  id: string;
  title: string;
  url: string;
  publisher: string;
  publishedAt: string | null;
  group: string;
}

type SortKey = 'severity' | 'cases' | 'deaths' | 'reported' | 'disease' | 'country';
type SourceFilter = 'ALL' | 'CURATED' | 'AUTOMATED';

const PAGE_SIZE = 50;

/**
 * Outbreak records as a filterable, sortable table.
 *
 * The previous version re-fetched every 30 seconds and rendered cards. Data is
 * ingested once a day, so the polling only put load on the database from every
 * open tab; it is gone, and the page states when data was last updated.
 */
export default function LiveOutbreaksDashboard({ initialOutbreaks, countries, embedded = false }: Props) {
  const outbreaks = initialOutbreaks;
  // Other pages link here as /outbreaks?search=<disease>.
  const params = useSearchParams();

  const [search, setSearch] = useState(() => params.get('search') ?? '');
  const [severity, setSeverity] = useState<string>('ALL');
  const [region, setRegion] = useState('ALL');
  const [country, setCountry] = useState('ALL');
  const [source, setSource] = useState<SourceFilter>('ALL');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'severity', dir: 1 });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);

  const [articles, setArticles] = useState<BriefItem[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);

  useEffect(() => {
    if (country === 'ALL') {
      setArticles([]);
      return;
    }
    const iso3 = iso3ForName(country);
    if (!iso3) { setArticles([]); return; }
    setLoadingArticles(true);
    // Verified reporting only (see lib/live/countryBrief.ts).
    fetch(`/api/live/country-brief?iso3=${iso3}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setArticles((data.items ?? []).slice(0, 10)))
      .catch(() => setArticles([]))
      .finally(() => setLoadingArticles(false));
  }, [country]);

  const regions = useMemo(
    () => Array.from(new Set(outbreaks.map((o) => o.region || 'OTHER'))).sort(),
    [outbreaks]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = outbreaks.filter((o) => {
      if (severity !== 'ALL' && normalizeSeverity(o.severity) !== severity) return false;
      if (region !== 'ALL' && (o.region || 'OTHER') !== region) return false;
      if (country !== 'ALL' && o.country !== country) return false;
      if (source === 'CURATED' && !o.verified) return false;
      if (source === 'AUTOMATED' && o.verified) return false;
      if (q) {
        const hay = `${o.disease} ${o.pathogen ?? ''} ${o.country} ${o.summary ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const { key, dir } = sort;
    return rows.sort((a, b) => {
      let d = 0;
      switch (key) {
        case 'severity':
          // Within a level, larger reported counts first; unreported sink.
          d = severityRank(a.severity) - severityRank(b.severity) || (b.cases ?? 0) - (a.cases ?? 0);
          break;
        case 'cases': d = (b.cases ?? 0) - (a.cases ?? 0); break;
        case 'deaths': d = (b.deaths ?? 0) - (a.deaths ?? 0); break;
        case 'reported': d = new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime(); break;
        case 'disease': d = a.disease.localeCompare(b.disease); break;
        case 'country': d = a.country.localeCompare(b.country); break;
      }
      return d * dir;
    });
  }, [outbreaks, search, severity, region, country, source, sort]);

  useEffect(() => setPage(1), [search, severity, region, country, source, sort]);

  const pageRows = filtered.slice(0, page * PAGE_SIZE);
  const curatedCount = outbreaks.filter((o) => o.verified).length;
  const lastUpdated = outbreaks.reduce((m, o) => (o.updatedAt > m ? o.updatedAt : m), '');

  const levelCounts = SEVERITY_ORDER.map((lvl) => ({
    lvl,
    n: filtered.filter((o) => normalizeSeverity(o.severity) === lvl).length,
  }));

  const hasFilters =
    search || severity !== 'ALL' || region !== 'ALL' || country !== 'ALL' || source !== 'ALL';

  const sortBy = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));

  // A render helper rather than a component declared inside render: a nested
  // component gets a new identity each render, remounting the header buttons
  // and dropping keyboard focus every time the sort changes.
  const th = (k: SortKey, label: string, num?: boolean) => (
    <th
      className={num ? 'num' : undefined}
      aria-sort={sort.key === k ? (sort.dir === 1 ? 'descending' : 'ascending') : undefined}
    >
      <button type="button" onClick={() => sortBy(k)}>
        {label}
        {sort.key === k ? (sort.dir === 1 ? ' ↓' : ' ↑') : ''}
      </button>
    </th>
  );

  return (
    <div className={embedded ? undefined : 'page'}>
      {!embedded && (
        <header className="page-head">
          <h1 className="page-title">Outbreak records</h1>
          <p className="page-lede">
            {outbreaks.length} records — {curatedCount} curated from agency reporting and{' '}
            {outbreaks.length - curatedCount} from the daily automated ingest, which have not been
            reviewed. {lastUpdated && <>Last updated {fmtDate(lastUpdated)}.</>}
          </p>
        </header>
      )}

      <div className="ob-toolbar">
        <input
          className="input ob-search"
          type="search"
          placeholder="Search disease, pathogen, country"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search records"
        />
        <select className="select" value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Severity">
          <option value="ALL">All severities</option>
          {SEVERITY_ORDER.map((l) => <option key={l} value={l}>{SEVERITY_LABEL[l]}</option>)}
        </select>
        <select className="select" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="WHO region">
          <option value="ALL">All regions</option>
          {regions.map((r) => <option key={r} value={r}>{REGION_LABEL[r] ?? r}</option>)}
        </select>
        <select className="select" value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country">
          <option value="ALL">All countries</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="ob-seg" role="group" aria-label="Record source">
          {(['ALL', 'CURATED', 'AUTOMATED'] as SourceFilter[]).map((s) => (
            <button key={s} type="button" className="chip" aria-pressed={source === s} onClick={() => setSource(s)}>
              {s === 'ALL' ? 'All sources' : s === 'CURATED' ? 'Curated' : 'Automated'}
            </button>
          ))}
        </div>
        {hasFilters && (
          <button
            type="button"
            className="link ob-clear"
            onClick={() => {
              setSearch(''); setSeverity('ALL'); setRegion('ALL'); setCountry('ALL'); setSource('ALL');
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="ob-summary">
        <span><strong>{filtered.length}</strong> of {outbreaks.length} records</span>
        <span className="ob-levels">
          {levelCounts.map(({ lvl, n }) => (
            <span key={lvl} className="ob-level">
              <SeverityBadge severity={lvl} size="sm" />
              <span className="tabular-nums">{n}</span>
            </span>
          ))}
        </span>
      </div>

      <div className={country !== 'ALL' ? 'ob-layout with-side' : 'ob-layout'}>
        <section className="panel" aria-label="Records">
          <div className="table-wrap">
            <table className="dt">
              <thead>
                <tr>
                  {th('disease', 'Disease')}
                  {th('country', 'Country')}
                  <th>Region</th>
                  {th('cases', 'Cases', true)}
                  {th('deaths', 'Deaths', true)}
                  <th className="num">CFR</th>
                  {th('severity', 'Severity')}
                  {th('reported', 'Reported')}
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((o) => (
                  <Fragment key={o.id}>
                    <tr onClick={() => setOpen(open === o.id ? null : o.id)} style={{ cursor: 'pointer' }}>
                      <td>
                        {o.disease}
                        {o.pathogen && <span className="sub">{o.pathogen}</span>}
                      </td>
                      <td>{o.country}</td>
                      <td className="muted">{regionLabel(o.region || 'OTHER')}</td>
                      <td className="num">{fmtCount(o.cases)}</td>
                      <td className="num">{fmtCount(o.deaths)}</td>
                      <td className="num muted">{fmtCfr(o.cases, o.deaths)}</td>
                      <td><SeverityBadge severity={o.severity} size="sm" /></td>
                      <td className="muted tabular-nums" style={{ whiteSpace: 'nowrap' }}>{fmtDateShort(o.reportDate)}</td>
                      <td>
                        {o.sourceName}
                        <span className="sub">{o.verified ? 'Curated' : 'Automated'}</span>
                      </td>
                    </tr>
                    {open === o.id && (
                      <tr className="ob-detail">
                        <td colSpan={9}>
                          {o.summary && <p>{o.summary}</p>}
                          <p className="muted" style={{ fontSize: 12.5 }}>
                            Reported {fmtDate(o.reportDate)} ·{' '}
                            <a className="link" href={o.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                              Open source report
                            </a>
                            {!o.verified && ' · Extracted automatically from a headline; not reviewed.'}
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {pageRows.length === 0 && (
                  <tr><td colSpan={9} className="muted" style={{ padding: 24, textAlign: 'center' }}>No records match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="panel-foot" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span>– means the source stated no figure. CFR shown only when both cases and deaths were reported.</span>
            {pageRows.length < filtered.length && (
              <button type="button" className="btn" onClick={() => setPage((p) => p + 1)}>
                Show {Math.min(PAGE_SIZE, filtered.length - pageRows.length)} more
              </button>
            )}
          </div>
        </section>

        {country !== 'ALL' && (
          <aside className="panel" aria-label={`News for ${country}`}>
            <div className="panel-header">
              <h2 className="panel-title">Verified reporting: {country}</h2>
              {iso3ForName(country) && (
                <Link href={`/countries/${iso3ForName(country)}`} className="link" style={{ fontSize: 12.5 }}>Country brief</Link>
              )}
            </div>
            <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
              {loadingArticles && <p className="muted">Loading…</p>}
              {!loadingArticles && articles.length === 0 && <p className="muted">No recent reports from verified sources.</p>}
              {articles.map((a) => (
                <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="ob-article">
                  <span>{a.title}</span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {a.publisher}{a.publishedAt ? ` · ${fmtDateShort(a.publishedAt)}` : ''}
                  </span>
                </a>
              ))}
              <p className="muted" style={{ fontSize: 11.5 }}>
                National health authority, WHO and agencies, humanitarian organisations and established press only.
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
