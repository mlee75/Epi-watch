import Parser from 'rss-parser';

import { prisma } from '@/lib/prisma';
import { getRegionForCountry } from '@/lib/classifiers';
import {
  UNKNOWN_COUNTRY,
  UNKNOWN_DISEASE,
  cleanTitle,
  extractCountry,
  extractDisease,
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
  const results: VideoIngestResult[] = [];
  let totalAdded = 0;
  let totalLinked = 0;
  let errors = 0;

  for (const source of VIDEO_SOURCES) {
    try {
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
        const outbreakId = await findLinkedOutbreak(classified.disease, classified.country);

        const publishedAt = new Date(item.published ?? item.pubDate ?? Date.now());

        const data = {
          platform: 'youtube',
          videoId,
          channelId: source.channelId,
          channelName: source.channelName,
          authority: source.authority,
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

      totalAdded += added;
      totalLinked += linked;
      results.push({
        authority: source.authority,
        channelId: source.channelId,
        added,
        linked,
        success: true,
      });
    } catch (error) {
      errors++;
      results.push({
        authority: source.authority,
        channelId: source.channelId,
        added: 0,
        linked: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { totalAdded, totalLinked, errors, sources: results };
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
