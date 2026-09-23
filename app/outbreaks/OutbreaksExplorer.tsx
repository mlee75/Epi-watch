'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Outbreak } from '@/lib/types';
import { SeverityBadge } from '@/components/SeverityBadge';
import { UNSPECIFIED_KEY, canonicalCountry, diseaseInfo, diseaseKey, diseaseName } from '@/lib/diseases';
import { normalizeSeverity, severityRank, type SeverityLevel } from '@/lib/severity';
import { fmtCount, fmtDate, fmtDateShort } from '@/lib/format';
import LiveOutbreaksDashboard from './LiveOutbreaksDashboard';
import Link from 'next/link';
import { iso3ForName } from '@/lib/countryNames';

const LiveMap = dynamic(() => import('@/components/map/LiveMap'), {
  ssr: false,
  loading: () => <div style={{ height: 380, display: 'grid', placeItems: 'center' }} className="muted">Loading map…</div>,
});

interface Props {
  outbreaks: Outbreak[];
  countries: string[];
}

interface CountryRow {
  country: string;
  records: Outbreak[];
  severity: SeverityLevel;
  maxCases: number;
  maxDeaths: number;
  latest: string;
}

interface DiseaseGroup {
  key: string;
  name: string;
  records: Outbreak[];
  countries: CountryRow[];
  severity: SeverityLevel;
  latest: string;
  curated: number;
}

// Records whose place is not one country. They are listed, not mapped.
const NON_COUNTRY = new Set(['Multiple Countries', 'Global', 'Unknown']);

function groupByDisease(outbreaks: Outbreak[]): DiseaseGroup[] {
  const byKey = new Map<string, Outbreak[]>();
  for (const o of outbreaks) {
    const k = diseaseKey(o.disease);
    byKey.set(k, [...(byKey.get(k) ?? []), o]);
  }
  const groups: DiseaseGroup[] = [];
  for (const [key, records] of byKey) {
    const byCountry = new Map<string, Outbreak[]>();
    for (const o of records) {
      const c = canonicalCountry(o.country, o.disease);
      byCountry.set(c, [...(byCountry.get(c) ?? []), o]);
    }
    const countries: CountryRow[] = [...byCountry.entries()].map(([country, rs]) => ({
      country,
      records: rs.sort((a, b) => b.reportDate.localeCompare(a.reportDate)),
      severity: rs.map((r) => normalizeSeverity(r.severity)).sort((a, b) => severityRank(a) - severityRank(b))[0],
      maxCases: Math.max(0, ...rs.map((r) => r.cases ?? 0)),
      maxDeaths: Math.max(0, ...rs.map((r) => r.deaths ?? 0)),
      latest: rs.reduce((m, r) => (r.reportDate > m ? r.reportDate : m), ''),
    }));
    countries.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.records.length - a.records.length);
    groups.push({
      key,
      name: diseaseName(key),
      records,
      countries,
      severity: countries[0].severity,
      latest: countries.reduce((m, c) => (c.latest > m ? c.latest : m), ''),
      curated: records.filter((r) => r.verified).length,
    });
  }
  // Worst severity first, then most widespread; the unclassified group last.
  return groups.sort((a, b) =>
    a.key === UNSPECIFIED_KEY ? 1 : b.key === UNSPECIFIED_KEY ? -1
      : severityRank(a.severity) - severityRank(b.severity) || b.countries.length - a.countries.length || b.records.length - a.records.length
  );
}

export default function OutbreaksExplorer({ outbreaks, countries }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const groups = useMemo(() => groupByDisease(outbreaks), [outbreaks]);

  // ?disease=<key> selects a disease; ?search=<text> (older links) opens the
  // records table with that search applied.
  const [view, setView] = useState<'disease' | 'records'>(params.get('search') ? 'records' : 'disease');
  const [selectedKey, setSelectedKey] = useState<string>(() => {
    const q = params.get('disease');
    return q && groups.some((g) => g.key === q) ? q : groups[0]?.key ?? '';
  });
  const [query, setQuery] = useState('');
  const [openCountry, setOpenCountry] = useState<string | null>(null);

  const selected = groups.find((g) => g.key === selectedKey) ?? groups[0];
  const info = selected ? diseaseInfo(selected.key) : null;

  useEffect(() => setOpenCountry(null), [selectedKey]);

  const choose = (key: string) => {
    setSelectedKey(key);
    const sp = new URLSearchParams(params.toString());
    sp.set('disease', key);
    sp.delete('search');
    router.replace(`/outbreaks?${sp}`, { scroll: false });
  };

  const highlight = useMemo(() => {
    const h: Record<string, SeverityLevel> = {};
    for (const c of selected?.countries ?? []) if (!NON_COUNTRY.has(c.country)) h[c.country] = c.severity;
    return h;
  }, [selected]);

  const list = groups.filter((g) => !query.trim() || g.name.toLowerCase().includes(query.trim().toLowerCase()));
  const curatedTotal = outbreaks.filter((o) => o.verified).length;
  const lastUpdated = outbreaks.reduce((m, o) => (o.updatedAt > m ? o.updatedAt : m), '');

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Outbreaks</h1>
        <p className="page-lede">
          {groups.length} diseases across {outbreaks.length} records ({curatedTotal} curated from agency reporting,{' '}
          {outbreaks.length - curatedTotal} from the automated ingest and not reviewed).
          {lastUpdated && <> Last updated {fmtDate(lastUpdated)}.</>} Select a disease to see where it is recorded.
        </p>
      </header>

      <div className="ob-seg" role="tablist" aria-label="View" style={{ marginBottom: 16 }}>
        <button type="button" role="tab" className="chip" aria-selected={view === 'disease'} aria-pressed={view === 'disease'} onClick={() => setView('disease')}>By disease</button>
        <button type="button" role="tab" className="chip" aria-selected={view === 'records'} aria-pressed={view === 'records'} onClick={() => setView('records')}>All records</button>
      </div>

      {view === 'records' ? (
        <LiveOutbreaksDashboard initialOutbreaks={outbreaks} countries={countries} embedded />
      ) : (
        <div className="dx">
          {/* ── Disease list ── */}
          <section className="panel dx-list" aria-label="Diseases">
            <div className="panel-body" style={{ paddingBottom: 8 }}>
              <input className="input" style={{ width: '100%' }} type="search" placeholder="Search diseases" value={query}
                onChange={(e) => setQuery(e.target.value)} aria-label="Search diseases" />
            </div>
            <ol className="dx-items">
              {list.map((g) => (
                <li key={g.key}>
                  <button type="button" className={g.key === selected?.key ? 'is-active' : ''} onClick={() => choose(g.key)}
                    aria-current={g.key === selected?.key ? 'true' : undefined}>
                    <span className="dx-name">{g.name}</span>
                    <span className="dx-meta">
                      <SeverityBadge severity={g.severity} size="sm" />
                      <span>{(() => {
                        const n = g.countries.filter((c) => !NON_COUNTRY.has(c.country)).length;
                        return n === 0 ? 'Multi-country' : n === 1 ? '1 country' : `${n} countries`;
                      })()}</span>
                      <span>{g.records.length === 1 ? '1 record' : `${g.records.length} records`}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          {/* ── Selected disease ── */}
          {selected && (
            <div className="dx-detail">
              <section className="panel">
                <div className="panel-header">
                  <h2 className="panel-title">{selected.name}</h2>
                  <span className="panel-meta">Latest report {fmtDateShort(selected.latest)}</span>
                </div>
                <div className="lm-embed">
                  <LiveMap mode="disease" outbreaks={selected.records} highlight={highlight} height={380}
                    onCountryClick={(name) => {
                      const hit = selected.countries.find((c) => c.country === name || name.startsWith(c.country) || c.country.startsWith(name));
                      if (hit) {
                        setOpenCountry(hit.country);
                        document.getElementById(`dx-c-${hit.country}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }} />
                </div>
                {info ? (
                  <div className="panel-body dx-info">
                    <dl>
                      <dt>Cause</dt><dd>{info.agent}</dd>
                      <dt>Symptoms</dt><dd>{info.symptoms}</dd>
                      <dt>How it spreads</dt><dd>{info.transmission}</dd>
                      <dt>Incubation</dt><dd>{info.incubation}</dd>
                    </dl>
                    <p className="muted" style={{ fontSize: 12 }}>
                      Summary of the <a className="link" href={info.source.url} target="_blank" rel="noopener noreferrer">{info.source.name}</a>.
                      General information, not medical advice. If you have symptoms, contact a health professional.
                    </p>
                  </div>
                ) : (
                  <div className="panel-body">
                    <p className="muted" style={{ fontSize: 13 }}>
                      The automated ingest could not identify the disease from these headlines (for example cyclosporiasis
                      or Vibrio stories filed under a generic name). Open a record to read the source.
                    </p>
                  </div>
                )}
              </section>

              <section className="panel" style={{ marginTop: 16 }}>
                <div className="panel-header">
                  <h2 className="panel-title">Where it is recorded</h2>
                  <span className="panel-meta">{selected.curated} curated · {selected.records.length - selected.curated} automated</span>
                </div>
                <div className="table-wrap">
                  <table className="dt">
                    <thead>
                      <tr>
                        <th>Country</th>
                        <th className="num">Records</th>
                        <th className="num">Largest case figure</th>
                        <th className="num">Largest death figure</th>
                        <th>Severity</th>
                        <th>Latest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.countries.map((c) => (
                        <Fragment key={c.country}>
                          <tr id={`dx-c-${c.country}`} className={openCountry === c.country ? 'is-open' : undefined}
                            onClick={() => setOpenCountry(openCountry === c.country ? null : c.country)} style={{ cursor: 'pointer' }}>
                            <td>
                              {NON_COUNTRY.has(c.country) ? 'Multiple or unspecified countries' : c.country}
                              <span className="sub">
                                {openCountry === c.country ? 'Hide reports' : 'Show reports'}
                                {iso3ForName(c.country) && (
                                  <> · <Link className="link" href={`/countries/${iso3ForName(c.country)}`} onClick={(e) => e.stopPropagation()}>Country brief</Link></>
                                )}
                              </span>
                            </td>
                            <td className="num">{c.records.length}</td>
                            <td className="num">{fmtCount(c.maxCases)}</td>
                            <td className="num">{fmtCount(c.maxDeaths)}</td>
                            <td><SeverityBadge severity={c.severity} size="sm" /></td>
                            <td className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtDateShort(c.latest)}</td>
                          </tr>
                          {openCountry === c.country && (
                            <tr className="ob-detail">
                              <td colSpan={6}>
                                <ul className="dx-reports">
                                  {c.records.map((r) => (
                                    <li key={r.id}>
                                      <a className="link" href={r.sourceUrl} target="_blank" rel="noopener noreferrer">{r.titleOrig || r.summary?.slice(0, 120) || `${r.disease}, ${r.country}`}</a>
                                      <span className="muted">
                                        {r.sourceName} · {fmtDateShort(r.reportDate)} · {r.verified ? 'Curated' : 'Automated'}
                                        {r.cases ? ` · ${fmtCount(r.cases)} cases` : ''}{r.deaths ? ` · ${fmtCount(r.deaths)} deaths` : ''}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="panel-foot">
                  Figures are the largest single figure any record for that country reported, not a sum: records overlap,
                  and the same event is often reported several times. – means no figure was stated.
                </p>
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
