import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Suspense } from 'react';
import { Header } from '@/components/Header';
import { LiveTvPanel } from '@/components/LiveTvPanel';
import { Footer } from '@/components/Footer';
import { SeverityBadge } from '@/components/SeverityBadge';
import { RegionBars, type RegionRow } from '@/components/dashboard/RegionBars';
import TravelRiskCalculator from '@/components/TravelRiskCalculator';
import prisma from '@/lib/db';
import type { Outbreak, OutbreakStats } from '@/lib/types';
import { SEVERITY_ORDER, SEVERITY_RULE, normalizeSeverity, severityRank, type SeverityLevel } from '@/lib/severity';
import { fmtCount, fmtDate, fmtDateShort, fmtNumber, regionLabel } from '@/lib/format';

// 3D Globe — dynamically imported, browser-only (Three.js requires window)
const GlobeScene = dynamic(() => import('@/components/GlobeScene'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <p className="muted" style={{ fontSize: 13 }}>Loading map…</p>
    </div>
  ),
});

async function getInitialData(): Promise<{
  outbreaks: Outbreak[];
  stats: OutbreakStats;
}> {
  try {
    const [rawOutbreaks, statsData] = await Promise.all([
      prisma.outbreak.findMany({
        where: { isActive: true },
        orderBy: [{ reportDate: 'desc' }],
        take: 500,
      }),
      Promise.all([
        prisma.outbreak.count({ where: { isActive: true } }),
        prisma.outbreak.count({ where: { isActive: true, severity: 'CRITICAL' } }),
        prisma.outbreak.count({ where: { isActive: true, severity: 'HIGH' } }),
        prisma.outbreak.count({ where: { isActive: true, severity: 'MEDIUM' } }),
        prisma.outbreak.count({ where: { isActive: true, severity: 'LOW' } }),
        prisma.outbreak.aggregate({ where: { isActive: true }, _sum: { cases: true } }),
        prisma.outbreak.aggregate({ where: { isActive: true }, _sum: { deaths: true } }),
        prisma.outbreak.findMany({
          where: { isActive: true },
          select: { country: true },
          distinct: ['country'],
        }),
        prisma.outbreak.findMany({
          where: { isActive: true },
          select: { region: true },
          distinct: ['region'],
        }),
        prisma.outbreak.findFirst({
          where: { isActive: true },
          orderBy: { updatedAt: 'desc' },
          select: { updatedAt: true },
        }),
      ]),
    ]);

    const outbreaks: Outbreak[] = rawOutbreaks.map((o) => ({
      ...o,
      pathogen: o.pathogen ?? null,
      subregion: o.subregion ?? null,
      lat: o.lat ?? null,
      lng: o.lng ?? null,
      summary: o.summary ?? null,
      trend: o.trend ?? null,
      titleOrig: o.titleOrig ?? null,
      severity: o.severity as Outbreak['severity'],
      reportDate: o.reportDate.toISOString(),
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    }));

    const [total, critical, high, medium, low, totalCases, totalDeaths, countries, regions, latest] =
      statsData;

    const diseaseCounts: Record<string, number> = {};
    for (const o of rawOutbreaks) {
      if (o.disease) diseaseCounts[o.disease] = (diseaseCounts[o.disease] ?? 0) + 1;
    }
    const topDiseaseEntry = Object.entries(diseaseCounts).sort((a, b) => b[1] - a[1])[0];
    const topDiseaseName = topDiseaseEntry?.[0];
    const topDiseaseOutbreaks = topDiseaseName
      ? rawOutbreaks.filter((o) => o.disease === topDiseaseName)
      : [];
    const topDisease = topDiseaseEntry ? {
      name: topDiseaseEntry[0],
      count: topDiseaseEntry[1],
      cases:  topDiseaseOutbreaks.reduce((s, o) => s + (o.cases  ?? 0), 0),
      deaths: topDiseaseOutbreaks.reduce((s, o) => s + (o.deaths ?? 0), 0),
    } : null;

    const stats: OutbreakStats = {
      total,
      critical,
      high,
      medium,
      low,
      totalCases: totalCases._sum.cases ?? 0,
      totalDeaths: totalDeaths._sum.deaths ?? 0,
      countriesAffected: countries.length,
      regionsAffected: regions.length,
      lastUpdated: latest?.updatedAt.toISOString() ?? new Date().toISOString(),
      topDisease,
    };

    return { outbreaks, stats };
  } catch (err) {
    console.error('[page] DB error:', err);
    return {
      outbreaks: [],
      stats: {
        total: 0, critical: 0, high: 0, medium: 0, low: 0,
        totalCases: 0, totalDeaths: 0,
        countriesAffected: 0, regionsAffected: 0,
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}

export const revalidate = 300;

/** Records per WHO region, stacked by severity; largest region first. */
function buildRegionRows(outbreaks: Outbreak[]): RegionRow[] {
  const byRegion = new Map<string, Record<SeverityLevel, number>>();
  for (const o of outbreaks) {
    const code = o.region || 'OTHER';
    const counts = byRegion.get(code) ?? { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    counts[normalizeSeverity(o.severity)] += 1;
    byRegion.set(code, counts);
  }
  return Array.from(byRegion.entries())
    .map(([code, counts]) => ({
      code,
      label: regionLabel(code),
      counts,
      total: SEVERITY_ORDER.reduce((n, l) => n + counts[l], 0),
    }))
    // The unattributed bucket goes last whatever its size, so it cannot
    // present itself as the region with the most outbreaks.
    .sort((a, b) => (a.code === 'OTHER' ? 1 : b.code === 'OTHER' ? -1 : b.total - a.total));
}

export default async function HomePage() {
  const { outbreaks, stats } = await getInitialData();

  const curated = outbreaks.filter((o) => o.verified).length;
  const automated = outbreaks.length - curated;
  const unreported = outbreaks.filter((o) => !o.cases).length;
  const withFigures = outbreaks.length - unreported;
  const recent30 = outbreaks.filter(
    (o) => Date.now() - new Date(o.createdAt).getTime() < 30 * 86_400_000
  ).length;

  // Ranked by severity, then reported cases. Records with no reported figures
  // sink to the bottom of their level rather than tying with real counts.
  const ranked = [...outbreaks]
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || (b.cases ?? 0) - (a.cases ?? 0))
    .slice(0, 12);

  const recent = [...outbreaks]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  const regionRows = buildRegionRows(outbreaks);

  return (
    <div className="min-h-screen">
      <Header />

      <main className="page">
        <header className="page-head">
          <h1 className="page-title">Global outbreak overview</h1>
          <p className="page-lede">
            {fmtNumber(stats.total)} outbreak records across {stats.countriesAffected} countries.{' '}
            {curated} are curated from WHO, CDC, PAHO, UKHSA and UNICEF reporting; {automated}{' '}
            come from a daily automated scan of news and agency feeds and have not been reviewed.
            Records are reports, not confirmed distinct outbreaks — the same event can appear more
            than once.
          </p>
        </header>

        {/* Headline figures. Each tile says what it counts; sums of reported
            figures state how many records reported nothing. */}
        <section className="kpi-row" aria-label="Headline figures">
          <div className="kpi">
            <div className="kpi-label">Records</div>
            <div className="kpi-value">{fmtNumber(stats.total)}</div>
            <div className="kpi-note">{curated} curated · {automated} automated</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Countries</div>
            <div className="kpi-value">{stats.countriesAffected}</div>
            <div className="kpi-note">With at least one record</div>
          </div>
          {/* No summed case or death totals: records overlap (one event can be
              several records) and mix outbreak counts with endemic annual burden,
              so a sum was dominated by a single malaria record and meant nothing. */}
          <div className="kpi">
            <div className="kpi-label">With case figures</div>
            <div className="kpi-value">{withFigures}</div>
            <div className="kpi-note">{unreported} records state no case count</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Added in last 30 days</div>
            <div className="kpi-value">{recent30}</div>
            <div className="kpi-note">By date first recorded</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Critical severity</div>
            <div className="kpi-value">{stats.critical}</div>
            <div className="kpi-note">{SEVERITY_RULE.CRITICAL}</div>
          </div>
        </section>

        <div className="home-grid" style={{ marginTop: 20 }}>
          <section className="panel home-map" aria-labelledby="map-title">
            <div className="panel-header">
              <h2 id="map-title" className="panel-title">Map</h2>
              <span className="panel-meta">Country shading = highest severity on record</span>
            </div>
            <div className="home-map-canvas">
              <Suspense>
                <GlobeScene outbreaks={outbreaks} aiEnabled={Boolean(process.env.ANTHROPIC_API_KEY)} />
              </Suspense>
              <LiveTvPanel />
            </div>
          </section>

          <section className="panel" aria-labelledby="ranked-title">
            <div className="panel-header">
              <h2 id="ranked-title" className="panel-title">Highest severity</h2>
              <Link href="/outbreaks" className="link" style={{ fontSize: 12.5 }}>All records</Link>
            </div>
            <div className="table-wrap">
              <table className="dt">
                <thead>
                  <tr>
                    <th>Disease · country</th>
                    <th className="num">Cases</th>
                    <th className="num">Deaths</th>
                    <th>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((o) => (
                    <tr key={o.id}>
                      <td>
                        {o.disease}
                        <span className="sub">
                          {o.country}
                          {!o.verified && ' · automated'}
                        </span>
                      </td>
                      <td className="num">{fmtCount(o.cases)}</td>
                      <td className="num">{fmtCount(o.deaths)}</td>
                      <td><SeverityBadge severity={o.severity} size="sm" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="panel-foot">– means the source stated no figure, not zero.</div>
          </section>
        </div>

        <div className="home-grid-2" style={{ marginTop: 20 }}>
          <section className="panel" aria-labelledby="region-title">
            <div className="panel-header">
              <h2 id="region-title" className="panel-title">Records by WHO region</h2>
              <span className="panel-meta">{fmtNumber(stats.total)} records</span>
            </div>
            <div className="panel-body">
              <RegionBars rows={regionRows} />
            </div>
          </section>

          <section className="panel" aria-labelledby="recent-title">
            <div className="panel-header">
              <h2 id="recent-title" className="panel-title">Recently added</h2>
              <span className="panel-meta">Last updated {fmtDate(stats.lastUpdated)}</span>
            </div>
            <div className="table-wrap">
              <table className="dt">
                <thead>
                  <tr>
                    <th>Added</th>
                    <th>Record</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((o) => (
                    <tr key={o.id}>
                      <td className="muted tabular-nums" style={{ whiteSpace: 'nowrap' }}>{fmtDateShort(o.createdAt)}</td>
                      <td>
                        {o.disease}
                        <span className="sub">{o.country}</span>
                      </td>
                      <td>
                        <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className="link">
                          {o.sourceName}
                        </a>
                        <span className="sub">{o.verified ? 'Curated' : 'Automated, unreviewed'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <TravelRiskCalculator />

        <section className="panel" style={{ marginTop: 20 }} aria-labelledby="method-title">
          <div className="panel-header">
            <h2 id="method-title" className="panel-title">How the data is built</h2>
            <Link href="/faq" className="link" style={{ fontSize: 12.5 }}>Full methodology</Link>
          </div>
          <div className="panel-body method-grid">
            <div>
              <h3>Sources</h3>
              <p>
                A curated set of records compiled from WHO, CDC, PAHO, UKHSA and UNICEF
                reporting, and a daily automated ingest at 06:00 UTC that reads the CDC
                US outbreaks feed, Outbreak News Today and a Google News outbreak query.
              </p>
            </div>
            <div>
              <h3>Extraction</h3>
              <p>
                Disease, country and figures are read from each headline by pattern matching,
                not by a model. A figure is recorded only if the headline states it; otherwise
                it is left blank rather than estimated.
              </p>
            </div>
            <div>
              <h3>Severity</h3>
              <p>
                A mechanical threshold on reported cases or deaths. It is not an
                epidemiological assessment, and a record with no reported figures shows as Low
                however serious the underlying event.
              </p>
            </div>
            <div>
              <h3>Limits</h3>
              <p>
                Automated records are news reports and are not deduplicated by event, so one
                outbreak can appear several times. Treat this as an index of reporting, and
                use WHO or CDC for decisions.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <style>{`
        .home-grid { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: 20px; align-items: start; }
        .home-grid-2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; align-items: start; }
        .home-map-canvas { position: relative; height: 560px; }
        @media (max-width: 960px) {
          .home-grid, .home-grid-2 { grid-template-columns: minmax(0, 1fr); }
          .home-map-canvas { height: 460px; }
        }
        .method-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 24px; }
        .method-grid h3 { font-size: 13px; font-weight: 600; margin-bottom: 6px; }
        .method-grid p { font-size: 13px; color: var(--ink-2); line-height: 1.6; }
        @media (max-width: 1000px) { .method-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 560px) { .method-grid { grid-template-columns: minmax(0, 1fr); } }
      `}</style>
    </div>
  );
}
