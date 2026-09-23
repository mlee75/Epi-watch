import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SeverityBadge } from '@/components/SeverityBadge';
import { Trend } from '@/components/Trend';
import { LineChart } from '@/components/dashboard/LineChart';
import prisma from '@/lib/db';
import { canonicalCountry, diseaseKey, diseaseName } from '@/lib/diseases';
import { fetchCountryBrief } from '@/lib/live/countryBrief';
import { countryNames } from '@/lib/countryNames';
import { fetchSari } from '@/lib/live/hospital';
import { normalizeSeverity, severityRank, type SeverityLevel } from '@/lib/severity';
import { fmtCount, fmtDateShort } from '@/lib/format';
import CountryReports from './CountryReports';

export const revalidate = 1800;
export const maxDuration = 60;

export async function generateMetadata({ params }: { params: { iso3: string } }) {
  const ref = countryNames(params.iso3.toUpperCase());
  return {
    title: ref ? `${ref.name} | Epi-watch` : 'Country | Epi-watch',
    description: ref ? `Outbreak records, hospital admissions and verified health reporting for ${ref.name}.` : undefined,
  };
}

async function recordsFor(names: string[]) {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  try {
    const rows = await prisma.outbreak.findMany({ where: { isActive: true }, orderBy: { reportDate: 'desc' }, take: 500 });
    return rows.filter((o) => wanted.has(canonicalCountry(o.country, o.disease).toLowerCase()));
  } catch {
    return [];
  }
}

export default async function CountryPage({ params }: { params: { iso3: string } }) {
  const iso3 = params.iso3.toUpperCase();
  const ref = countryNames(iso3);
  if (!ref) notFound();

  const [records, brief, sari] = await Promise.all([recordsFor(ref.names), fetchCountryBrief(iso3), fetchSari()]);
  const sariCountry = sari.ok ? sari.countries.find((c) => c.iso3 === iso3) ?? null : null;
  const worst = records.reduce<SeverityLevel | null>((m, o) => {
    const s = normalizeSeverity(o.severity);
    return !m || severityRank(s) < severityRank(m) ? s : m;
  }, null);
  const diseases = [...new Set(records.map((o) => diseaseKey(o.disease)))];

  return (
    <div className="min-h-screen">
      <Header />
      <main className="page">
        <header className="page-head">
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>
            <Link href="/" className="link">Map</Link> / Country
          </p>
          <h1 className="page-title">{ref.name}</h1>
          <p className="page-lede">
            Outbreak records, hospital admissions and health reporting for {ref.name}, from verified publishers only:
            the national health authority, WHO and other international agencies, vetted humanitarian organisations and
            established press. Every item links to its source.
          </p>
        </header>

        <section className="kpi-row" aria-label="Summary">
          <div className="kpi">
            <div className="kpi-label">Outbreak records</div>
            <div className="kpi-value">{records.length}</div>
            <div className="kpi-note">{records.filter((o) => o.verified).length} curated</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Highest severity</div>
            <div className="kpi-value" style={{ fontSize: 18, paddingTop: 6 }}>{worst ? <SeverityBadge severity={worst} /> : '–'}</div>
            <div className="kpi-note">Across all records</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Diseases on record</div>
            <div className="kpi-value">{diseases.length}</div>
            <div className="kpi-note">After merging name variants</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">SARI hospital admissions</div>
            <div className="kpi-value">{sariCountry?.reference?.cases != null ? fmtCount(sariCountry.reference.cases) : '–'}</div>
            <div className="kpi-note">
              {sariCountry?.reference ? <>Week of {fmtDateShort(sariCountry.reference.week)} <Trend pct={sariCountry.change} context="vs prior 4 weeks" /></> : 'Not reported to WHO FluID'}
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Verified reports</div>
            <div className="kpi-value">{brief?.items.length ?? 0}</div>
            <div className="kpi-note">{brief ? `${brief.sources.filter((s) => s.ok).length} of ${brief.sources.length} sources reached` : 'Sources unreachable'}</div>
          </div>
        </section>

        <div className="cx">
          <div>
            {brief && <CountryReports brief={brief} />}
          </div>

          <aside style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
            <section className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Outbreak records</h2>
                <Link href="/outbreaks" className="link" style={{ fontSize: 12.5 }}>All</Link>
              </div>
              {records.length === 0 ? (
                <p className="panel-body muted" style={{ fontSize: 13 }}>No records in Epi-watch. That does not mean no disease activity.</p>
              ) : (
                <ul className="cx-records">
                  {records.slice(0, 25).map((o) => (
                    <li key={o.id}>
                      <div className="cx-rec-head">
                        <Link className="link" href={`/outbreaks?disease=${diseaseKey(o.disease)}`}>{diseaseName(diseaseKey(o.disease)).replace(/ \(.*\)$/, '')}</Link>
                        <SeverityBadge severity={o.severity} size="sm" />
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {fmtDateShort(o.reportDate.toISOString())} · {fmtCount(o.cases)} cases · {fmtCount(o.deaths)} deaths ·{' '}
                        <a className="link" href={o.sourceUrl} target="_blank" rel="noopener noreferrer">{o.sourceName}</a>
                        {!o.verified && ' · automated'}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {sariCountry && (
              <section className="panel">
                <div className="panel-header">
                  <h2 className="panel-title">Hospital SARI admissions</h2>
                  <span className="panel-meta">WHO FluID · weekly</span>
                </div>
                <div className="panel-body">
                  <LineChart label={`Weekly SARI admissions, ${ref.name}`} height={120}
                    points={sariCountry.weeks.map((w) => ({ x: w.week, y: w.cases }))} />
                  <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
                    Sentinel hospitals only. Weeks under three weeks old are still being reported.{' '}
                    <Link className="link" href="/hospitals">All hospital data</Link>
                  </p>
                </div>
              </section>
            )}
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
