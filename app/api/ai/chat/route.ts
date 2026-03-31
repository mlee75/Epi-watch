import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/db';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an expert AI health intelligence assistant for Epi-Watch, a global disease outbreak monitoring platform. You analyze real-time outbreak data and answer questions with precision and clarity.

Your role:
- Answer questions about disease outbreaks worldwide using the provided database context
- Explain epidemiological concepts clearly, avoiding unnecessary jargon
- Compare outbreaks across countries or time periods
- Analyze trends, case fatality rates, and regional patterns
- Always cite the specific data provided in the context

Guidelines:
1. Ground every statistical claim in the database context provided — do not invent numbers
2. If data is absent, say so and explain what you do know
3. Highlight severity and urgency appropriately without alarmism
4. Use simple, clear language
5. Structure responses with headers and bullet points for readability
6. When discussing a country, cover all active outbreaks there
7. Always mention verification status when relevant (verified vs unverified)
8. Keep responses concise but complete — aim for 200-400 words

Tone: Professional, factual, empathetic, urgent when appropriate.`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function buildOutbreakContext(outbreaks: {
  disease: string; country: string; region: string; cases: number;
  deaths: number; severity: string; trend?: string | null; verified: boolean;
  sourceName: string; subregion?: string | null;
}[]): string {
  if (outbreaks.length === 0) return 'No active outbreaks in database.';

  const bySeverity = outbreaks.reduce((acc, o) => {
    (acc[o.severity] = acc[o.severity] || []).push(o);
    return acc;
  }, {} as Record<string, typeof outbreaks>);

  const lines: string[] = [`ACTIVE OUTBREAKS (${outbreaks.length} total):\n`];

  for (const sev of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
    const group = bySeverity[sev];
    if (!group?.length) continue;
    lines.push(`[${sev}]`);
    for (const o of group) {
      const cfr = o.cases > 0 ? ((o.deaths / o.cases) * 100).toFixed(1) : '0';
      lines.push(
        `  • ${o.disease} — ${o.country}${o.subregion ? ` (${o.subregion})` : ''} | ${o.region} | Cases: ${o.cases.toLocaleString()} | Deaths: ${o.deaths.toLocaleString()} | CFR: ${cfr}% | Trend: ${o.trend ?? 'unknown'} | ${o.verified ? 'VERIFIED' : 'UNVERIFIED'} (${o.sourceName})`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const { message, conversationHistory = [] } = await request.json() as {
      message: string;
      conversationHistory: ChatMessage[];
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    // Fetch current outbreak data for context
    const outbreaks = await prisma.outbreak.findMany({
      where: { isActive: true },
      select: {
        disease: true, country: true, region: true, subregion: true,
        cases: true, deaths: true, severity: true, trend: true,
        verified: true, sourceName: true,
      },
      orderBy: [{ severity: 'asc' }, { cases: 'desc' }],
      take: 100,
    });

    const context = buildOutbreakContext(outbreaks);

    // Build messages array for Claude
    const messages: Anthropic.MessageParam[] = [
      // Inject context as first user/assistant turn so it's always available
      {
        role: 'user',
        content: `[SYSTEM CONTEXT — database snapshot for this session]\n${context}\n\n[END CONTEXT]`,
      },
      {
        role: 'assistant',
        content: 'I have the current outbreak data loaded. Ready to answer your questions.',
      },
      // Prior conversation
      ...conversationHistory.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      // New message
      { role: 'user', content: message },
    ];

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    // Extract outbreak IDs relevant to the response (simple keyword match)
    const mentioned = outbreaks
      .filter(
        (o) =>
          text.toLowerCase().includes(o.country.toLowerCase()) ||
          text.toLowerCase().includes(o.disease.toLowerCase())
      )
      .slice(0, 5);

    // Suggest follow-up questions based on intent
    const suggestedQuestions = generateSuggestions(message, text);

    return NextResponse.json({
      response: text,
      relatedOutbreaks: mentioned.map((o) => `${o.disease} — ${o.country}`),
      suggestedQuestions,
    });
  } catch (err) {
    console.error('[POST /api/ai/chat]', err);
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 500 });
  }
}

function generateSuggestions(question: string, _answer: string): string[] {
  const q = question.toLowerCase();

  if (q.includes('country') || q.match(/\b(drc|congo|nigeria|india|brazil|usa|china)\b/)) {
    return [
      'What are the biggest threats in the region?',
      'How does this compare to last month?',
      'What is the cross-border risk?',
    ];
  }
  if (q.includes('ebola') || q.includes('cholera') || q.includes('dengue') || q.includes('disease')) {
    return [
      'Where else is this disease spreading?',
      'What is the current CFR compared to historical outbreaks?',
      'What prevention measures are recommended?',
    ];
  }
  if (q.includes('compare') || q.includes('vs')) {
    return [
      'Which outbreak is more dangerous?',
      'What do both outbreaks have in common?',
      'What is the global response like?',
    ];
  }
  return [
    'Which countries are at highest risk right now?',
    'What diseases are spreading fastest?',
    'What are the most critical outbreaks globally?',
  ];
}
