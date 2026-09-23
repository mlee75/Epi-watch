'use client';

import { useMemo, useState } from 'react';
import { LineChart } from '@/components/dashboard/LineChart';
import { Trend } from '@/components/Trend';
import type { NhsnData, NhsnWeek, SariCountry, SariData, UkData } from '@/lib/live/hospital';
import { SARI_MIN_BASE, SARI_SETTLE_DAYS } from '@/lib/live/hospital';
import { fmtDateShort, fmtNumber } from '@/lib/format';

interface Props {
  sari: SariData;
  nhsn: NhsnData;
  uk: UkData;
  /** When the server rendered the page; used instead of the client clock so SSR and hydration agree. */
  generatedAt: string;
}

const WHO_REGION: Record<string, string> = {
  AFR: 'Africa',
  AMR: 'Americas',
  EMR: 'Eastern Mediterranean',
  EUR: 'Europe',
  SEAR: 'South-East Asia',
  WPR: 'Western Pacific',
};

const US_STATE: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  PR: 'Puerto Rico', GU: 'Guam', VI: 'US Virgin Islands', AS: 'American Samoa', MP: 'Northern Mariana Islands',
};

const fmtInt = (n: number) => fmtNumber(Math.round(n));

type SariSort = 'country' | 'change' | 'latest';

function SourceError({ name, error }: { name: string; error?: string }) {
  return (
    <div className="note note-error">
      {name} could not be reached{error ? ` (${error})` : ''}. The rest of the page is unaffected; this section
      will fill in on the next refresh.
    </div>
  );
}

export default function HospitalDashboard({ sari, nhsn, uk, generatedAt }: Props) {
  // ── SARI table state ──
  const [region, setRegion] = useState('ALL');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SariSort>('change');

  const regions = useMemo(() => [...new Set(sari.countries.map((c) => c.whoRegion))].sort(), [sari.countries]);
  const staleCutoff = new Date(new Date(generatedAt).getTime() - 42 * 86_400_000).toISOString().slice(0, 10);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = sari.countries.filter(
      (c) => (region === 'ALL' || c.whoRegion === region) && (!q || c.country.toLowerCase().includes(q))
    );
    const byChange = (a: SariCountry, b: SariCountry) => {
      // Countries without a comparable change sort after those with one.
      if (a.change == null && b.change == null) return a.country.localeCompare(b.country);
      if (a.change == null) return 1;
      if (b.change == null) return -1;
      return b.change - a.change;
    };
    return [...list].sort(
      sort === 'change' ? byChange
        : sort === 'latest' ? (a, b) => b.latest.week.localeCompare(a.latest.week) || a.country.localeCompare(b.country)
        : (a, b) => a.country.localeCompare(b.country)
    );
  }, [sari.countries, region, query, sort]);

  const rising = sari.countries.filter((c) => c.change != null && c.change >= 25 && c.latest.week >= staleCutoff).length;
  const reportingRecent = sari.countries.filter((c) => c.latest.week >= staleCutoff).length;

  // ── US state selector ──
  const [jur, setJur] = useState('USA');
  const usSeries: NhsnWeek[] =
    (jur === 'USA' ? nhsn.national?.weeks : nhsn.states.find((s) => s.code === jur)?.weeks) ?? [];
  const usLatest = usSeries[usSeries.length - 1];
  const usPrev = usSeries[usSeries.length - 2];
  const wk = (w: NhsnWeek | undefined, k: 'covid' | 'flu' | 'rsv') => w?.[k] ?? null;
  const pctChange = (a: number | null, b: number | null) => (a == null || b == null || b === 0 ? null : ((a - b) / b) * 100);

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Hospital admissions</h1>
        <p className="page-lede">
          Hospital intake from national surveillance systems, fetched from each publisher every hour. These systems
          publish weekly or daily with a reporting lag of one to three weeks, so the newest week shown is the newest
          week published, and the most recent weeks can still be revised upwards.
        </p>
      </header>

      <section className="kpi-row" aria-label="Summary">
        <div className="kpi">
          <div className="kpi-label">Countries reporting SARI</div>
          <div className="kpi-value">{reportingRecent}</div>
          <div className="kpi-note">Data in the last 6 weeks · WHO FluID</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Rising ≥ 25%</div>
          <div className="kpi-value">{rising}</div>
          <div className="kpi-note">Newest settled week vs prior 4-week mean</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">US new admissions</div>
          <div className="kpi-value">
            {nhsn.national?.weeks.length
              ? fmtInt((wk(nhsn.national.weeks.at(-1), 'covid') ?? 0) + (wk(nhsn.national.weeks.at(-1), 'flu') ?? 0) + (wk(nhsn.national.weeks.at(-1), 'rsv') ?? 0))
              : '–'}
          </div>
          <div className="kpi-note">
            COVID-19 + flu + RSV, week to {nhsn.national?.weeks.length ? fmtDateShort(nhsn.national.weeks.at(-1)!.week) : '–'}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">US inpatient beds occupied</div>
          <div className="kpi-value">
            {nhsn.national?.weeks.at(-1)?.bedOccPct != null ? `${nhsn.national.weeks.at(-1)!.bedOccPct!.toFixed(1)}%` : '–'}
          </div>
          <div className="kpi-note">All causes · CDC NHSN</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">England COVID-19 admissions</div>
          <div className="kpi-value">
            {(() => {
              const s = uk.series.find((x) => x.key === 'covid');
              return s?.points.length ? fmtInt(s.points.at(-1)!.value) : '–';
            })()}
          </div>
          <div className="kpi-note">
            {(() => {
              const s = uk.series.find((x) => x.key === 'covid');
              return s?.points.length ? `Patients admitted on ${fmtDateShort(s.points.at(-1)!.date)} · UKHSA` : 'UKHSA';
            })()}
          </div>
        </div>
      </section>

      {/* ── WHO FluID SARI ── */}
      <section className="panel" style={{ marginTop: 24 }}>
        <div className="panel-header">
          <h2 className="panel-title">Severe acute respiratory infection (SARI) admissions by country</h2>
          <span className="panel-meta">WHO FluID · weekly</span>
        </div>
        {!sari.ok ? (
          <div className="panel-body"><SourceError name="WHO FluID" error={sari.error} /></div>
        ) : (
          <>
            <div className="panel-body" style={{ paddingBottom: 0 }}>
              <div className="ob-toolbar">
                <input className="input ob-search" type="search" placeholder="Search country" value={query}
                  onChange={(e) => setQuery(e.target.value)} aria-label="Search country" />
                <select className="select" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="WHO region">
                  <option value="ALL">All WHO regions</option>
                  {regions.map((r) => <option key={r} value={r}>{WHO_REGION[r] ?? r}</option>)}
                </select>
                <select className="select" value={sort} onChange={(e) => setSort(e.target.value as SariSort)} aria-label="Sort">
                  <option value="change">Sort: largest increase</option>
                  <option value="latest">Sort: most recently reported</option>
                  <option value="country">Sort: country A–Z</option>
                </select>
              </div>
            </div>
            <div className="table-wrap">
              <table className="dt">
                <thead>
                  <tr>
                    <th>Country</th>
                    <th>WHO region</th>
                    <th>Settled week</th>
                    <th className="num">SARI cases</th>
                    <th className="num">Prior 4-wk mean</th>
                    <th className="num">Change</th>
                    <th style={{ width: 150 }}>Last 16 weeks</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const stale = c.latest.week < staleCutoff;
                    return (
                      <tr key={c.iso3}>
                        <td>{c.country}</td>
                        <td className="muted">{WHO_REGION[c.whoRegion] ?? c.whoRegion}</td>
                        <td className={stale ? 'muted' : undefined} style={{ whiteSpace: 'nowrap' }}>
                          {c.reference ? fmtDateShort(c.reference.week) : '–'}
                          {stale ? (
                            <span className="sub">Not recent</span>
                          ) : c.provisionalWeeks > 0 ? (
                            <span className="sub">+{c.provisionalWeeks} provisional</span>
                          ) : null}
                        </td>
                        <td className="num">{c.reference?.cases != null ? fmtInt(c.reference.cases) : '–'}</td>
                        <td className="num muted">{c.priorMean != null ? fmtInt(c.priorMean) : '–'}</td>
                        <td className="num">
                          {c.change != null ? <Trend pct={c.change} context="vs prior 4-week mean" /> : <span className="muted" title={`Prior mean below ${SARI_MIN_BASE}`}>–</span>}
                        </td>
                        <td>
                          <LineChart compact label={`Weekly SARI cases in ${c.country}`} format={fmtInt}
                            points={c.weeks.map((w) => ({ x: w.week, y: w.cases }))} />
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr><td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 24 }}>No countries match.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="panel-foot">
              SARI cases are patients admitted to sentinel hospitals with severe respiratory infection of any cause.
              Sentinel networks differ in size, so compare a country with its own past weeks, not with other countries.
              Weeks less than {SARI_SETTLE_DAYS / 7} weeks old are still being reported and usually undercount, so change
              compares the newest settled week with the mean of the four before it; provisional weeks appear only in
              the sparkline. Change is shown only when that mean is at least {SARI_MIN_BASE} cases. &ldquo;Not
              recent&rdquo; means no report in the last six weeks.
            </p>
          </>
        )}
      </section>

      {/* ── US NHSN ── */}
      <section className="panel" style={{ marginTop: 24 }}>
        <div className="panel-header">
          <h2 className="panel-title">United States: new hospital admissions</h2>
          <span className="panel-meta">CDC NHSN · weekly</span>
        </div>
        {!nhsn.ok ? (
          <div className="panel-body"><SourceError name="CDC NHSN" error={nhsn.error} /></div>
        ) : (
          <div className="panel-body" style={{ display: 'grid', gap: 16 }}>
            <div className="ob-toolbar" style={{ marginBottom: 0 }}>
              <select className="select" value={jur} onChange={(e) => setJur(e.target.value)} aria-label="Jurisdiction">
                <option value="USA">United States (national)</option>
                {nhsn.states.map((s) => <option key={s.code} value={s.code}>{US_STATE[s.code] ?? s.code}</option>)}
              </select>
              {usLatest && (
                <span className="muted" style={{ fontSize: 12.5 }}>
                  Week to {fmtDateShort(usLatest.week)}
                  {usLatest.reportingPct != null && ` · ${Math.round(usLatest.reportingPct)}% of hospitals reported`}
                  {usLatest.bedOccPct != null && ` · inpatient beds ${usLatest.bedOccPct.toFixed(1)}% occupied`}
                  {usLatest.icuOccPct != null && ` · ICU ${usLatest.icuOccPct.toFixed(1)}%`}
                </span>
              )}
            </div>
            <div className="hx-multiples">
              {(['covid', 'flu', 'rsv'] as const).map((k) => {
                const name = k === 'covid' ? 'COVID-19' : k === 'flu' ? 'Influenza' : 'RSV';
                const latest = wk(usLatest, k);
                const chg = pctChange(latest, wk(usPrev, k));
                return (
                  <div key={k} className="hx-chart">
                    <div className="hx-chart-head">
                      <span className="hx-chart-title">{name}</span>
                      <span className="hx-chart-value">
                        {latest != null ? fmtInt(latest) : '–'}
                        <span className="muted"> /wk</span>
                        {chg != null && <> <Trend pct={chg} context="vs prior week" /></>}
                      </span>
                    </div>
                    <LineChart label={`Weekly new ${name} admissions, ${jur === 'USA' ? 'United States' : US_STATE[jur] ?? jur}`}
                      format={fmtInt} points={usSeries.map((w) => ({ x: w.week, y: w[k] }))} />
                  </div>
                );
              })}
            </div>
            <details className="rb-table">
              <summary>Show as table</summary>
              <div className="table-wrap">
                <table className="dt">
                  <thead><tr><th>Week ending</th><th className="num">COVID-19</th><th className="num">Influenza</th><th className="num">RSV</th><th className="num">Beds occupied</th><th className="num">Hospitals reporting</th></tr></thead>
                  <tbody>
                    {[...usSeries].reverse().map((w) => (
                      <tr key={w.week}>
                        <td>{fmtDateShort(w.week)}</td>
                        <td className="num">{w.covid != null ? fmtInt(w.covid) : '–'}</td>
                        <td className="num">{w.flu != null ? fmtInt(w.flu) : '–'}</td>
                        <td className="num">{w.rsv != null ? fmtInt(w.rsv) : '–'}</td>
                        <td className="num">{w.bedOccPct != null ? `${w.bedOccPct.toFixed(1)}%` : '–'}</td>
                        <td className="num">{w.reportingPct != null ? `${Math.round(w.reportingPct)}%` : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <p className="muted" style={{ fontSize: 12 }}>
              Laboratory-confirmed admissions reported by hospitals to CDC&rsquo;s National Healthcare Safety Network.
              Totals depend on how many hospitals reported that week, shown above.
            </p>
          </div>
        )}
      </section>

      {/* ── England UKHSA ── */}
      <section className="panel" style={{ marginTop: 24 }}>
        <div className="panel-header">
          <h2 className="panel-title">England: hospital admissions</h2>
          <span className="panel-meta">UKHSA data dashboard</span>
        </div>
        {!uk.ok ? (
          <div className="panel-body"><SourceError name="UKHSA" error={uk.error} /></div>
        ) : (
          <div className="panel-body" style={{ display: 'grid', gap: 16 }}>
            <div className="hx-multiples">
              {uk.series.map((s) => {
                const pts = s.key === 'covid' ? s.points.slice(-120) : s.points.slice(-40);
                const last = pts.at(-1);
                return (
                  <div key={s.key} className="hx-chart">
                    <div className="hx-chart-head">
                      <span className="hx-chart-title">{s.label}</span>
                      <span className="hx-chart-value">
                        {last ? fmtNumber(last.value) : '–'}
                        <span className="muted"> {s.unit}</span>
                      </span>
                    </div>
                    <LineChart label={`${s.label}, England, ${s.unit}`} points={pts.map((p) => ({ x: p.date, y: p.value }))} />
                    <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                      {s.cadence}{last && ` · latest ${fmtDateShort(last.date)}`}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="muted" style={{ fontSize: 12 }}>
              Influenza and RSV admission rates are published during the winter season only, so outside it the
              latest point can be months old.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
