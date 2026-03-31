import prisma from '../db';
import {
  classifySeverity,
  getRegionForCountry,
  generateSummary,
  buildDedupeKey,
} from '../classifiers';
import { getCountryCoords } from '../countryCoords';
import { scrapeWHO } from './who';
import { scrapeCDC } from './cdc';
import { scrapeProMED } from './proMed';
import { scrapeRSSFeeds } from './rss';
import { calculateReliabilityScore, getSourceType } from '../reliability';
import type { ScrapedOutbreak } from '../types';

interface ScrapeResult {
  added: number;
  skipped: number;
  errors: string[];
  sources: Record<string, number>;
}

export async function runAllScrapers(): Promise<ScrapeResult> {
  console.log('[Scraper] Starting scrape run at', new Date().toISOString());

  const result: ScrapeResult = {
    added: 0,
    skipped: 0,
    errors: [],
    sources: { WHO: 0, CDC: 0, ProMED: 0, RSS: 0 },
  };

  // Run all scrapers in parallel
  const [whoRes, cdcRes, promedRes, rssRes] = await Promise.allSettled([
    scrapeWHO(),
    scrapeCDC(),
    scrapeProMED(),
    scrapeRSSFeeds(),
  ]);

  const allOutbreaks: ScrapedOutbreak[] = [];

  if (whoRes.status === 'fulfilled') {
    allOutbreaks.push(...whoRes.value);
    result.sources.WHO = whoRes.value.length;
  } else result.errors.push(`WHO: ${whoRes.reason}`);

  if (cdcRes.status === 'fulfilled') {
    allOutbreaks.push(...cdcRes.value);
    result.sources.CDC = cdcRes.value.length;
  } else result.errors.push(`CDC: ${cdcRes.reason}`);

  if (promedRes.status === 'fulfilled') {
    allOutbreaks.push(...promedRes.value);
    result.sources.ProMED = promedRes.value.length;
  } else result.errors.push(`ProMED: ${promedRes.reason}`);

  if (rssRes.status === 'fulfilled') {
    allOutbreaks.push(...rssRes.value);
    result.sources.RSS = rssRes.value.length;
  } else result.errors.push(`RSS: ${rssRes.reason}`);

  console.log(`[Scraper] Collected ${allOutbreaks.length} raw items`);

  for (const raw of allOutbreaks) {
    try {
      const dedupeKey = buildDedupeKey(raw.disease, raw.country, raw.reportDate);
      const severity = classifySeverity(raw.cases, raw.deaths);
      const region = raw.region || getRegionForCountry(raw.country);

      let lat = raw.lat;
      let lng = raw.lng;
      if (!lat || !lng) {
        const coords = getCountryCoords(raw.country);
        if (coords) { lat = coords[0]; lng = coords[1]; }
      }

      const summary = raw.summary || generateSummary({ ...raw, region });

      const record = await prisma.outbreak.upsert({
        where: { dedupeKey },
        create: {
          disease: raw.disease,
          pathogen: raw.pathogen ?? null,
          country: raw.country,
          region,
          subregion: raw.subregion ?? null,
          lat: lat ?? null,
          lng: lng ?? null,
          cases: raw.cases,
          deaths: raw.deaths,
          recovered: raw.recovered ?? 0,
          severity,
          summary,
          trend: raw.trend ?? null,
          verified: raw.verified ?? true,
          language: raw.language ?? 'en',
          titleOrig: raw.titleOrig ?? null,
          sourceUrl: raw.sourceUrl,
          sourceName: raw.sourceName,
          isActive: true,
          dedupeKey,
          reportDate: raw.reportDate,
        },
        update: {
          cases: raw.cases,
          deaths: raw.deaths,
          severity,
          summary,
          trend: raw.trend ?? null,
          updatedAt: new Date(),
        },
      });

      result.added++;

      // Save source attribution (non-fatal — new model may not be on cached client)
      try {
        const sourceType = getSourceType(raw.sourceName);
        const reliabilityScore = calculateReliabilityScore({
          sourceType,
          isVerified: raw.verified ?? true,
          language: raw.language ?? 'en',
          publishedAt: raw.reportDate,
        });

        await prisma.outbreakSource.upsert({
          where: { articleUrl: raw.sourceUrl },
          create: {
            outbreakId:      record.id,
            sourceName:      raw.sourceName,
            sourceType,
            sourceLanguage:  raw.language ?? 'en',
            articleTitle:    raw.titleOrig ?? `${raw.disease} — ${raw.country}`,
            articleUrl:      raw.sourceUrl,
            articleExcerpt:  raw.summary ?? null,
            publishedAt:     raw.reportDate,
            reliabilityScore,
            isVerified:      raw.verified ?? true,
            verifiedBy:      raw.verified ? raw.sourceName : null,
          },
          update: {},
        });
      } catch {
        // OutbreakSource model may not be available on old cached client — skip silently
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Unique constraint')) {
        result.skipped++;
      } else {
        result.errors.push(
          `Save error ${raw.disease}/${raw.country}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  console.log(
    `[Scraper] Done — added/updated: ${result.added}, skipped: ${result.skipped}, errors: ${result.errors.length}`
  );
  return result;
}
