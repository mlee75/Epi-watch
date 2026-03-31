import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const [
      total,
      critical,
      high,
      medium,
      low,
      totalCasesResult,
      totalDeathsResult,
      countriesResult,
      regionsResult,
      latestOutbreak,
      allOutbreaks,
    ] = await Promise.all([
      prisma.outbreak.count({ where: { isActive: true } }),
      prisma.outbreak.count({ where: { isActive: true, severity: 'CRITICAL' } }),
      prisma.outbreak.count({ where: { isActive: true, severity: 'HIGH' } }),
      prisma.outbreak.count({ where: { isActive: true, severity: 'MEDIUM' } }),
      prisma.outbreak.count({ where: { isActive: true, severity: 'LOW' } }),
      prisma.outbreak.aggregate({
        where: { isActive: true },
        _sum: { cases: true },
      }),
      prisma.outbreak.aggregate({
        where: { isActive: true },
        _sum: { deaths: true },
      }),
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
      prisma.outbreak.findMany({
        where: { isActive: true },
        select: { disease: true, region: true, severity: true, cases: true, deaths: true },
      }),
    ]);

    // Compute top disease by outbreak count
    const diseaseCounts: Record<string, number> = {};
    const regionCounts: Record<string, number> = {};
    for (const o of allOutbreaks) {
      if (o.disease) diseaseCounts[o.disease] = (diseaseCounts[o.disease] ?? 0) + 1;
      if (o.region) regionCounts[o.region] = (regionCounts[o.region] ?? 0) + 1;
    }
    const topDiseaseEntry = Object.entries(diseaseCounts).sort((a, b) => b[1] - a[1])[0];
    const topDiseaseName = topDiseaseEntry?.[0];
    const topDiseaseOutbreaks = topDiseaseName
      ? allOutbreaks.filter((o) => o.disease === topDiseaseName)
      : [];
    const topDiseaseCases  = topDiseaseOutbreaks.reduce((s, o) => s + (o.cases  ?? 0), 0);
    const topDiseaseDeaths = topDiseaseOutbreaks.reduce((s, o) => s + (o.deaths ?? 0), 0);
    const topDisease = topDiseaseEntry
      ? { name: topDiseaseEntry[0], count: topDiseaseEntry[1], cases: topDiseaseCases, deaths: topDiseaseDeaths }
      : null;
    const regionBreakdown = Object.entries(regionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([region, count]) => ({ region, count }));

    return NextResponse.json({
      data: {
        total,
        critical,
        high,
        medium,
        low,
        totalCases: totalCasesResult._sum.cases ?? 0,
        totalDeaths: totalDeathsResult._sum.deaths ?? 0,
        countriesAffected: countriesResult.length,
        regionsAffected: regionsResult.length,
        lastUpdated: latestOutbreak?.updatedAt ?? new Date(),
        topDisease,
        regionBreakdown,
      },
    });
  } catch (err) {
    console.error('[GET /api/stats]', err);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
