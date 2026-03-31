import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import {
  calculateTravelRiskScore,
  getCountryStaticData,
  defaultTravelerProfile,
  type CountryHealthData,
  type TravelerProfile,
} from '@/lib/travelRiskCalculator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      destination,
      origin,
      travelDate,
      duration,
      travelerProfile: rawProfile,
    } = body as {
      destination: string;
      origin: string;
      travelDate: string;
      duration: number;
      travelerProfile?: Partial<TravelerProfile>;
    };

    if (!destination) {
      return NextResponse.json({ error: 'Destination is required' }, { status: 400 });
    }

    // ── Fetch outbreaks for destination from DB ────────────────────────
    const allActive = await prisma.outbreak.findMany({
      where: { isActive: true },
      orderBy: { severity: 'asc' },
    });
    const destLower = destination.toLowerCase();
    const outbreaks = allActive.filter(
      (o) => o.country.toLowerCase().includes(destLower),
    );

    const matchedCountry = outbreaks[0]?.country ?? destination;
    const region = outbreaks[0]?.region ?? 'OTHER';

    // ── Compute outbreak-derived metrics ───────────────────────────────
    let criticalOutbreaks = 0;
    let highRiskOutbreaks = 0;
    let totalCases = 0;
    let totalDeaths = 0;
    let casesLast7Days = 0;
    let casesLast30Days = 0;
    let deathsLast7Days = 0;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    for (const ob of outbreaks) {
      if (ob.severity === 'CRITICAL') criticalOutbreaks++;
      else if (ob.severity === 'HIGH') highRiskOutbreaks++;

      totalCases += ob.cases ?? 0;
      totalDeaths += ob.deaths ?? 0;

      const reportDate = ob.reportDate;
      if (reportDate >= sevenDaysAgo) {
        casesLast7Days += ob.cases ?? 0;
        deathsLast7Days += ob.deaths ?? 0;
      }
      if (reportDate >= thirtyDaysAgo) {
        casesLast30Days += ob.cases ?? 0;
      }
    }

    const caseFatalityRate = totalCases > 0 ? totalDeaths / totalCases : 0;

    // ── Resolve static data for the country ───────────────────────────
    const staticData = getCountryStaticData(matchedCountry, region);

    // ── Build full CountryHealthData ──────────────────────────────────
    const countryData: CountryHealthData = {
      countryCode: '',
      countryName: matchedCountry,
      activeOutbreaks: outbreaks.length,
      criticalOutbreaks,
      highRiskOutbreaks,
      totalCases,
      totalDeaths,
      caseFatalityRate,
      casesLast7Days,
      casesLast30Days,
      deathsLast7Days,
      ...staticData,
    };

    // ── Build traveler profile ────────────────────────────────────────
    const traveler: TravelerProfile = {
      ...defaultTravelerProfile(duration || 7),
      ...rawProfile,
      travelDuration: duration || 7,
    };

    // ── Calculate risk score ──────────────────────────────────────────
    const result = calculateTravelRiskScore(countryData, traveler);

    // ── AI Summary (optional) ─────────────────────────────────────────
    let aiSummary: string | null = null;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey && outbreaks.length > 0) {
      try {
        const outbreakSummary = outbreaks
          .slice(0, 8)
          .map((o) => `${o.disease} (${o.severity}): ${o.cases ?? 0} cases, ${o.deaths ?? 0} deaths`)
          .join('; ');

        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 300,
            messages: [{
              role: 'user',
              content: `You are a travel health advisor. A ${traveler.age}-year-old traveler${traveler.hasChronicConditions ? ' with chronic conditions' : ''}${traveler.isPregnant ? ' who is pregnant' : ''} from ${origin} is visiting ${matchedCountry} for ${duration} days starting ${travelDate}. Activities: ${traveler.activities.join(', ')}. Active disease outbreaks: ${outbreakSummary}. Overall risk score: ${result.totalScore}/100 (${result.riskLevel}). Give a concise 2-3 sentence personalized travel health advisory. Be factual, not alarmist. Mention the most relevant risks and one key action.`,
            }],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          aiSummary = data.content?.[0]?.text ?? null;
        }
      } catch {
        // AI summary is optional
      }
    }

    if (!aiSummary) {
      if (outbreaks.length === 0) {
        aiSummary = `No active disease outbreaks are currently reported in ${matchedCountry}. Standard travel health precautions apply. Ensure routine vaccinations are up to date before departure.`;
      } else {
        const topDiseases = outbreaks.slice(0, 3).map((o) => o.disease).join(', ');
        aiSummary = `${matchedCountry} currently has ${outbreaks.length} active outbreak${outbreaks.length > 1 ? 's' : ''} including ${topDiseases}. Risk level is ${result.riskLevel}. Consult a travel medicine specialist at least 4-6 weeks before departure for personalized advice.`;
      }
    }

    // ── Response ──────────────────────────────────────────────────────
    return NextResponse.json({
      destination: matchedCountry,
      origin: origin || 'United States',
      travelDate,
      duration,
      riskScore: result.totalScore,
      riskLevel: result.riskLevel,
      breakdown: result.breakdown,
      activeOutbreaks: outbreaks.length,
      outbreaks: outbreaks.slice(0, 10).map((o) => ({
        disease: o.disease,
        cases: o.cases ?? 0,
        deaths: o.deaths ?? 0,
        severity: o.severity,
      })),
      recommendations: result.recommendations,
      requiredVaccinations: result.requiredVaccinations,
      warnings: result.warnings,
      countryData: {
        healthcareQualityIndex: countryData.healthcareQualityIndex,
        hospitalBedsPerCapita: countryData.hospitalBedsPerCapita,
        sanitationAccess: countryData.sanitationAccess,
        cleanWaterAccess: countryData.cleanWaterAccess,
        malariaRisk: countryData.malariaRisk,
        dengueRisk: countryData.dengueRisk,
        cdcTravelLevel: countryData.cdcTravelLevel,
        whoRiskLevel: countryData.whoRiskLevel,
      },
      aiSummary,
    });
  } catch (err) {
    console.error('[/api/travel/risk-assessment]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
