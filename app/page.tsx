import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { Header } from '@/components/Header';
import { HowItWorks } from '@/components/HowItWorks';
import { Footer } from '@/components/Footer';
import TravelRiskCalculator from '@/components/TravelRiskCalculator';
import prisma from '@/lib/db';
import type { Outbreak, OutbreakStats } from '@/lib/types';

const fmtNum = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// 3D Globe — dynamically imported, browser-only (Three.js requires window)
const GlobeScene = dynamic(() => import('@/components/GlobeScene'), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full flex items-center justify-center bg-black"
    >
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-slate-400 text-sm font-mono tracking-widest">
          INITIALIZING GLOBE…
        </p>
      </div>
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

export default async function HomePage() {
  const { outbreaks, stats } = await getInitialData();

  return (
    <div className="min-h-screen">
      <Header />

      <main>
        {/* ═══════════════════════════════════════════════════════════════════
            FULL-SCREEN GLOBE HERO
        ═══════════════════════════════════════════════════════════════════ */}
        <section id="map" className="relative w-full" style={{ height: '100vh' }}>

          {/* Globe fills entire viewport */}
          <div className="absolute inset-0">
            <Suspense>
              <GlobeScene outbreaks={outbreaks} />
            </Suspense>
          </div>

          {/* Gradient fade at top for header readability */}
          <div
            className="absolute top-0 left-0 right-0 pointer-events-none"
            style={{ height: 120, background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)' }}
          />

          {/* ── Compact Stats Bar — bottom overlay ─────────────────────── */}
          <div className="absolute bottom-0 left-0 right-0 z-10">
            <div style={{
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 py-4">
                <div className="flex items-center justify-between">

                  {/* Live indicator + updated time */}
                  <div className="flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
                        <span className="animate-ping" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#ef4444', opacity: 0.75 }} />
                        <span style={{ position: 'relative', width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                      </span>
                      <span style={{
                        fontSize: 10, color: 'rgba(255,255,255,0.5)',
                        fontFamily: 'var(--font-mono), monospace',
                        letterSpacing: '0.12em', textTransform: 'uppercase',
                      }}>
                        Live Global Surveillance
                      </span>
                    </div>
                    <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 4, paddingLeft: 20 }}>
                      Updated {(() => {
                        const mins = Math.max(1, Math.round((Date.now() - new Date(stats.lastUpdated).getTime()) / 60000));
                        return mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)}h ago`;
                      })()}
                    </p>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-6 lg:gap-8">

                    {/* Critical */}
                    <div className="flex items-center gap-3">
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: 'rgba(239,68,68,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      </div>
                      <div>
                        <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1, fontFamily: 'var(--font-mono), monospace' }}>
                          {stats.critical}
                        </p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Critical</p>
                        <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>&gt;10K cases each</p>
                      </div>
                    </div>

                    <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.08)' }} />

                    {/* High Risk */}
                    <div className="flex items-center gap-3">
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: 'rgba(249,115,22,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
                          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                          <polyline points="17 6 23 6 23 12" />
                        </svg>
                      </div>
                      <div>
                        <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1, fontFamily: 'var(--font-mono), monospace' }}>
                          {stats.high}
                        </p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>High Risk</p>
                        <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>&gt;1K cases each</p>
                      </div>
                    </div>

                    <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.08)' }} />

                    {/* Active Outbreaks */}
                    <div className="flex items-center gap-3">
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: 'rgba(96,165,250,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                      </div>
                      <div>
                        <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1, fontFamily: 'var(--font-mono), monospace' }}>
                          {stats.total}
                        </p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Active Outbreaks</p>
                        <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>All severity levels</p>
                      </div>
                    </div>

                    <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.08)' }} />

                    {/* Countries */}
                    <div className="flex items-center gap-3">
                      <div style={{
                        width: 40, height: 40, borderRadius: 10,
                        background: 'rgba(168,85,247,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="2" y1="12" x2="22" y2="12" />
                          <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                        </svg>
                      </div>
                      <div>
                        <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1, fontFamily: 'var(--font-mono), monospace' }}>
                          {stats.countriesAffected}
                        </p>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Countries</p>
                        <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>Worldwide distribution</p>
                      </div>
                    </div>
                  </div>

                  {/* Info tooltip */}
                  <div className="flex-shrink-0 hidden md:block" style={{ position: 'relative' }}>
                    <div className="group" style={{ cursor: 'pointer' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </div>
                      {/* Tooltip on hover */}
                      <div className="hidden group-hover:block" style={{
                        position: 'absolute', bottom: '100%', right: 0, marginBottom: 8,
                        width: 260, padding: '12px 14px',
                        background: 'rgba(15,23,42,0.95)',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 10,
                        fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5,
                      }}>
                        <p style={{ fontWeight: 600, color: '#fff', marginBottom: 6, fontSize: 11 }}>Severity Thresholds</p>
                        <p><span style={{ color: '#ef4444', fontWeight: 600 }}>Critical</span> — &gt;10,000 cases or &gt;5% fatality rate</p>
                        <p><span style={{ color: '#f97316', fontWeight: 600 }}>High</span> — &gt;1,000 cases or &gt;1% fatality rate</p>
                        <p><span style={{ color: '#eab308', fontWeight: 600 }}>Medium</span> — &gt;100 cases or emerging threat</p>
                        <p><span style={{ color: '#22c55e', fontWeight: 600 }}>Low</span> — &lt;100 cases, contained</p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            BELOW THE FOLD — detailed content
        ═══════════════════════════════════════════════════════════════════ */}

        {/* ── Travel Risk Assessment ────────────────────────────────────── */}
        <TravelRiskCalculator />

        <HowItWorks />
      </main>

      <Footer />
    </div>
  );
}
