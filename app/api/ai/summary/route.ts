import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/db';

const client = new Anthropic();

export async function GET(_req: NextRequest) {
  try {
    const [outbreaks, criticalCount, highCount, totalCases, totalDeaths, countriesResult] =
      await Promise.all([
        prisma.outbreak.findMany({
          where: { isActive: true },
          select: {
            disease: true, country: true, region: true,
            cases: true, deaths: true, severity: true, trend: true,
          },
          orderBy: [{ severity: 'asc' }, { cases: 'desc' }],
          take: 50,
        }),
        prisma.outbreak.count({ where: { isActive: true, severity: 'CRITICAL' } }),
        prisma.outbreak.count({ where: { isActive: true, severity: 'HIGH' } }),
        prisma.outbreak.aggregate({ where: { isActive: true }, _sum: { cases: true } }),
        prisma.outbreak.aggregate({ where: { isActive: true }, _sum: { deaths: true } }),
        prisma.outbreak.findMany({
          where: { isActive: true },
          select: { country: true },
          distinct: ['country'],
        }),
      ]);

    const topOutbreaks = outbreaks.slice(0, 8).map(
      (o) => `${o.disease} in ${o.country} (${o.severity}, ${o.cases} cases, ${o.deaths} deaths)`
    );

    // Disease frequency
    const diseaseCounts: Record<string, number> = {};
    for (const o of outbreaks) {
      diseaseCounts[o.disease] = (diseaseCounts[o.disease] ?? 0) + 1;
    }
    const topDisease = Object.entries(diseaseCounts).sort((a, b) => b[1] - a[1])[0];

    // Region distribution
    const regionCounts: Record<string, number> = {};
    for (const o of outbreaks) {
      if (o.region) regionCounts[o.region] = (regionCounts[o.region] ?? 0) + 1;
    }
    const topRegions = Object.entries(regionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([r, n]) => `${r}: ${n}`)
      .join(', ');

    const prompt = `You are a global health intelligence analyst. Generate a concise intelligence briefing based on this real-time outbreak data.

GLOBAL SNAPSHOT:
- Total active outbreaks: ${outbreaks.length}
- Critical: ${criticalCount} | High: ${highCount}
- Countries affected: ${countriesResult.length}/195
- Total cases: ${(totalCases._sum.cases ?? 0).toLocaleString()}
- Total deaths: ${(totalDeaths._sum.deaths ?? 0).toLocaleString()}
- Most active disease: ${topDisease?.[0] ?? 'Unknown'} (${topDisease?.[1] ?? 0} outbreaks)
- Regional distribution: ${topRegions}

TOP OUTBREAKS:
${topOutbreaks.join('\n')}

Generate a structured briefing. Be factual, specific, and urgent where warranted.

Respond ONLY with valid JSON:
{
  "executive": "2-3 sentence global overview emphasising the most critical threats right now",
  "keyPoints": [
    { "icon": "🚨", "title": "Highest Threat", "description": "specific detail about the most critical situation" },
    { "icon": "📈", "title": "Emerging Pattern", "description": "trend or spreading disease worth watching" },
    { "icon": "🌍", "title": "Geographic Hotspot", "description": "region with most concentrated activity" }
  ],
  "recommendations": [
    "Specific actionable recommendation 1",
    "Specific actionable recommendation 2",
    "Specific actionable recommendation 3"
  ]
}`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const summary = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ summary, generatedAt: new Date().toISOString() }, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch (err) {
    console.error('[GET /api/ai/summary]', err);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
