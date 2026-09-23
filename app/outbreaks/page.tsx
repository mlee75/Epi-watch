import { Suspense } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import prisma from '@/lib/db';
import type { Outbreak } from '@/lib/types';
import OutbreaksExplorer from './OutbreaksExplorer';

export const revalidate = 60;

export const metadata = {
  title: 'Outbreaks | Epi-watch',
  description: 'Outbreaks grouped by disease, with symptoms, transmission and a map of the countries where each is recorded.',
};

async function getOutbreaks(): Promise<{ outbreaks: Outbreak[]; countries: string[] }> {
  try {
    const raw = await prisma.outbreak.findMany({
      where: { isActive: true },
      orderBy: [{ reportDate: 'desc' }],
      take: 500,
    });

    const outbreaks: Outbreak[] = raw.map((o) => ({
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

    const countries = [...new Set(raw.map((o) => o.country))].sort();

    return { outbreaks, countries };
  } catch (err) {
    console.error('[outbreaks page] DB error:', err);
    return { outbreaks: [], countries: [] };
  }
}

export default async function OutbreaksPage() {
  const { outbreaks, countries } = await getOutbreaks();

  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Suspense>
          <OutbreaksExplorer outbreaks={outbreaks} countries={countries} />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
