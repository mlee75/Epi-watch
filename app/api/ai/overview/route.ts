import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/db';

const client = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const { outbreakId } = await request.json() as { outbreakId: string };

    if (!outbreakId) {
      return NextResponse.json({ error: 'outbreakId required' }, { status: 400 });
    }

    const outbreak = await prisma.outbreak.findUnique({
      where: { id: outbreakId },
      include: { sources: { orderBy: { publishedAt: 'desc' }, take: 5 } },
    });

    if (!outbreak) {
      return NextResponse.json({ error: 'Outbreak not found' }, { status: 404 });
    }

    const cfr = outbreak.cases > 0
      ? ((outbreak.deaths / outbreak.cases) * 100).toFixed(2)
      : '0';

    const sourceSummary = outbreak.sources.length > 0
      ? outbreak.sources.map((s) => `- ${s.sourceName}: "${s.articleTitle}"`).join('\n')
      : `- ${outbreak.sourceName}: ${outbreak.sourceUrl}`;

    const prompt = `You are a health intelligence analyst. Generate a concise, factual overview of this disease outbreak.

OUTBREAK DATA:
Disease: ${outbreak.disease}
Country: ${outbreak.country}${outbreak.subregion ? ` (${outbreak.subregion})` : ''}
WHO Region: ${outbreak.region}
Cases: ${outbreak.cases.toLocaleString()}
Deaths: ${outbreak.deaths.toLocaleString()}
Case Fatality Rate: ${cfr}%
Severity: ${outbreak.severity}
Trend: ${outbreak.trend ?? 'unknown'}
Verification: ${outbreak.verified ? 'VERIFIED' : 'UNVERIFIED'}
Pathogen: ${outbreak.pathogen ?? 'not specified'}
Reported: ${new Date(outbreak.reportDate).toLocaleDateString()}

SOURCES (${outbreak.sources.length}):
${sourceSummary}

Generate a structured intelligence overview. Be factual and specific. Use present tense.

Respond ONLY with valid JSON matching this schema exactly:
{
  "summary": "2-3 sentence overview of the current situation",
  "keyInsights": ["insight 1", "insight 2", "insight 3"],
  "trendAnalysis": "1-2 sentences on whether the situation is improving or worsening and why",
  "riskAssessment": "1-2 sentences on who is most at risk and any cross-border concerns"
}`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI did not return valid JSON');
    }

    const overview = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      data: {
        summary: overview.summary ?? '',
        keyInsights: Array.isArray(overview.keyInsights) ? overview.keyInsights : [],
        trendAnalysis: overview.trendAnalysis ?? '',
        riskAssessment: overview.riskAssessment ?? '',
        generatedAt: new Date().toISOString(),
        sourceCount: outbreak.sources.length || 1,
      },
    });
  } catch (err) {
    console.error('[POST /api/ai/overview]', err);
    return NextResponse.json({ error: 'Failed to generate overview' }, { status: 500 });
  }
}
