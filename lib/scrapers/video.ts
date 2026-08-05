import Parser from 'rss-parser';

import { prisma } from '@/lib/prisma';
import { getRegionForCountry } from '@/lib/classifiers';
import {
  UNKNOWN_COUNTRY,
  UNKNOWN_DISEASE,
  cleanTitle,
  extractCountry,
  extractDisease,
  termMatcher,
  withTimeout,
} from '@/lib/feedText';
import {
  VIDEO_SOURCES,
  type VideoSource,
  embedUrlFor,
  feedUrlFor,
  watchUrlFor,
} from '@/lib/videoSources';

const FEED_TIMEOUT_MS = 12_000;
const MAX_PER_CHANNEL = 10;

/**
 * YouTube's channel feed is Atom with media:group extensions. rss-parser needs
 * to be told about the fields we want; without this the videoId, description
 * and thumbnail all come back undefined.
 */
const parser: Parser<Record<string, unknown>, VideoFeedItem> = new Parser({
  customFields: {
    item: [
      ['yt:videoId', 'ytVideoId'],
      ['yt:channelId', 'ytChannelId'],
      ['media:group', 'mediaGroup', { keepArray: false }],
      ['published', 'published'],
    ],
  },
});

interface VideoFeedItem {
  title?: string;
  link?: string;
  published?: string;
  pubDate?: string;
  ytVideoId?: string;
  ytChannelId?: string;
  mediaGroup?: {
    'media:description'?: string | string[];
    'media:thumbnail'?: { $?: { url?: string } } | Array<{ $?: { url?: string } }>;
  };
}

export interface VideoIngestResult {
  authority: string;
  sourceType: string;
  channelId: string;
  added: number;
  linked: number;
  success: boolean;
  error?: string;
}

export interface VideoIngestSummary {
  totalAdded: number;
  totalLinked: number;
  errors: number;
  sources: VideoIngestResult[];
}

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function thumbnailFrom(item: VideoFeedItem): string | undefined {
  const thumb = item.mediaGroup?.['media:thumbnail'];
  if (Array.isArray(thumb)) return thumb[0]?.$?.url;
  return thumb?.$?.url;
}

/**
 * Ingest the latest videos from every allowlisted channel.
 *
 * The allowlist is the only trust boundary: a video is stored because of where
 * it was published, never because of what it appears to be about. Topic
 * classification runs afterwards and is allowed to conclude nothing.
 */
export async function ingestVideos(): Promise<VideoIngestSummary> {
  // Channels are fetched concurrently. Sequentially they shared the cron's
  // 60s budget with the article feeds, and a worst case of every feed hitting
  // its 12s timeout (3 article + 4 video) overran it and killed the function
  // mid-run. The channels are independent, so only the slowest one costs time.
  const settled = await Promise.all(VIDEO_SOURCES.map((source) => ingestChannel(source)));

  return {
    totalAdded: settled.reduce((n, r) => n + r.added, 0),
    totalLinked: settled.reduce((n, r) => n + r.linked, 0),
    errors: settled.filter((r) => !r.success).length,
    sources: settled,
  };
}

async function ingestChannel(source: VideoSource): Promise<VideoIngestResult> {
  try {
    {
      const feed = await withTimeout(parser.parseURL(feedUrlFor(source)), FEED_TIMEOUT_MS);
      let added = 0;
      let linked = 0;

      for (const item of (feed.items ?? []).slice(0, MAX_PER_CHANNEL)) {
        const videoId = item.ytVideoId;
        if (!videoId) continue;

        // Defence in depth: the feed URL is built from the allowlist, but a
        // redirect or a channel merge could still surface a foreign channelId.
        // Anything that does not match the entry we asked for is dropped.
        if (item.ytChannelId && item.ytChannelId !== source.channelId) continue;

        const title = cleanTitle(item.title ?? '');
        if (!title) continue;

        const description = cleanTitle(
          firstString(item.mediaGroup?.['media:description']) ?? ''
        );

        const classified = classify(title, description, source);

        // Authority channels are health bodies, so everything they publish
        // belongs here. News channels cover every beat, so an unfiltered feed
        // would bury outbreak reporting under politics and sport.
        if (source.sourceType === 'news' && !isHealthRelevant(title)) continue;

        const outbreakId = await findLinkedOutbreak(classified.disease, classified.country);

        const publishedAt = new Date(item.published ?? item.pubDate ?? Date.now());

        const data = {
          platform: 'youtube',
          videoId,
          channelId: source.channelId,
          channelName: source.channelName,
          authority: source.authority,
          sourceType: source.sourceType,
          title,
          description: description || null,
          url: item.link ?? watchUrlFor(videoId),
          embedUrl: embedUrlFor(videoId),
          thumbnailUrl: thumbnailFrom(item) ?? null,
          language: source.language,
          publishedAt,
          disease: classified.disease,
          country: classified.country,
          region: classified.region,
          outbreakId,
        };

        // Upsert rather than skip-if-exists: titles get corrected and videos
        // become linkable once a matching outbreak is ingested later.
        const before = await prisma.outbreakVideo.findUnique({
          where: { platform_videoId: { platform: 'youtube', videoId } },
          select: { id: true },
        });

        await prisma.outbreakVideo.upsert({
          where: { platform_videoId: { platform: 'youtube', videoId } },
          create: data,
          update: {
            sourceType: data.sourceType,
            title: data.title,
            description: data.description,
            thumbnailUrl: data.thumbnailUrl,
            disease: data.disease,
            country: data.country,
            region: data.region,
            outbreakId: data.outbreakId,
          },
        });

        if (!before) added++;
        if (outbreakId) linked++;
      }

      return {
        authority: source.authority,
        sourceType: source.sourceType,
        channelId: source.channelId,
        added,
        linked,
        success: true,
      };
    }
  } catch (error) {
    // One unreachable channel must not sink the others, so the failure is
    // reported per source rather than thrown.
    return {
      authority: source.authority,
      sourceType: source.sourceType,
      channelId: source.channelId,
      added: 0,
      linked: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Health-relevance gate for news channels.
 *
 * A named disease is sufficient on its own. Otherwise at least one epidemic
 * term must appear as a whole word — "outbreak", "epidemic", "quarantine" and
 * so on. Multilingual because the allowlist includes French and other
 * non-English newsrooms.
 *
 * This errs towards excluding: a missed outbreak clip is a gap, whereas an
 * unrelated news segment sitting on a disease dashboard reads as if it were
 * outbreak coverage.
 */
const HEALTH_TERMS = [
  'outbreak', 'epidemic', 'pandemic', 'virus', 'infection', 'infectious',
  'disease', 'contagion', 'quarantine', 'vaccination', 'vaccine', 'immunisation',
  'immunization', 'public health', 'health emergency', 'health officials',
  'epidemiolog', 'contagious', 'mortality rate', 'World Health Organization',
  // fr
  'épidémie', 'epidemie', 'pandémie', 'contagion', 'santé publique', 'flambée',
  'vaccin', 'épidémiolog', 'maladie infectieuse', 'grippe',
  // es
  'brote', 'epidemia', 'pandemia', 'vacunación', 'salud pública', 'contagio',
];

// Acronyms are matched case-sensitively and separately: a case-insensitive
// \bWHO also matches the pronoun "who", which appears in a large share of news
// headlines and would wave through essentially everything.
const HEALTH_ACRONYMS = ['WHO', 'CDC', 'ECDC', 'PAHO', 'UNICEF'];

const HEALTH_MATCHERS = [
  // Prefix mode so stems catch inflections ("vaccin" → "vaccine",
  // "vaccination", "vacuna"), via the shared Unicode-aware boundary helper.
  ...HEALTH_TERMS.map((t) => termMatcher(t, 'prefix')),
  ...HEALTH_ACRONYMS.map((t) => new RegExp(`(?<![\\p{L}\\p{N}])${t}(?![\\p{L}\\p{N}])`, 'u')),
];

/**
 * Judged on the headline alone, for the same reason counts are: descriptions
 * carry incidental references that read as topicality but are not. "The US box
 * office is on pace for its best year since the pandemic" matched on
 * `pandemic` and admitted a film-industry segment. A newsroom that is actually
 * covering an outbreak says so in the title.
 */
export function isHealthRelevant(title: string): boolean {
  if (extractDisease(title) !== UNKNOWN_DISEASE) return true;
  return HEALTH_MATCHERS.some((m) => m.test(title));
}

/**
 * Topic classification. Returns nulls rather than the "unknown" sentinels, so
 * the absence of a match is stored as genuinely unknown instead of being
 * rendered as a claim about a disease or country.
 */
function classify(title: string, description: string, source: VideoSource) {
  const text = `${title} ${description}`;

  const disease = extractDisease(text);
  const country = extractCountry(text);

  const resolvedCountry = country === UNKNOWN_COUNTRY ? null : country;

  return {
    disease: disease === UNKNOWN_DISEASE ? null : disease,
    country: resolvedCountry,
    region: resolvedCountry ? getRegionForCountry(resolvedCountry) : (source.region ?? null),
  };
}

/**
 * Only links when both disease and country are known and an active outbreak
 * matches both. Matching on disease alone would attach, say, a general WHO
 * cholera explainer to an unrelated country's outbreak.
 */
async function findLinkedOutbreak(
  disease: string | null,
  country: string | null
): Promise<string | null> {
  if (!disease || !country) return null;

  const match = await prisma.outbreak.findFirst({
    where: { disease, country, isActive: true },
    orderBy: { reportDate: 'desc' },
    select: { id: true },
  });

  return match?.id ?? null;
}
