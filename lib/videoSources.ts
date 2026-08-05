/**
 * Verified video sources.
 *
 * "Verified" here has one specific, auditable meaning: the video was published
 * by a channel on this allowlist, and every channel on this allowlist belongs
 * to a named public health authority. It is not a claim about the accuracy of
 * any individual video's content, and nothing outside this list is ingested.
 *
 * This is deliberately a hardcoded list rather than a search. Resolving
 * channels dynamically from handles was tested and silently returned the wrong
 * channel (youtube.com/@WHO resolves to WHO's regional EMRO channel, not the
 * global one) — for a feature whose whole premise is provenance, a source that
 * can quietly become the wrong source is not acceptable.
 *
 * To add a channel: confirm the channel ID resolves to the authority you
 * expect by fetching its feed and reading the <name> element, then record the
 * name you saw in `channelName` so the entry can be re-checked later.
 */

/**
 * Two tiers, kept distinct because they warrant different trust.
 *
 * `authority` — a public health body. Its output is official guidance, and
 * everything it publishes is health-relevant by definition.
 *
 * `news` — an established news organisation. Editorially independent and
 * verifiable as a publisher, but reporting rather than official guidance. These
 * channels publish across every beat, so only health-relevant items are taken
 * (see isHealthRelevant in lib/scrapers/video.ts).
 *
 * Collapsing these two into one "verified" bucket would let a news segment read
 * as a WHO position, so the distinction is carried through the model and shown
 * in the UI.
 */
export type VideoSourceType = 'authority' | 'news';

export interface VideoSource {
  /** Publishing body. Shown to users as the provenance label. */
  authority: string;
  /** Trust tier — determines both filtering and how the UI labels the item. */
  sourceType: VideoSourceType;
  /** YouTube channel ID. The unit of trust — the allowlist key. */
  channelId: string;
  /** Channel name as returned by the feed when this entry was added/verified. */
  channelName: string;
  /** ISO 639-1 language of the channel's primary output. */
  language: string;
  /** Scope hint, mirrors the WHO region codes used elsewhere. */
  region?: string;
}

export const VIDEO_SOURCES: VideoSource[] = [
  // ── Public health authorities ──────────────────────────────────────────────
  {
    authority: 'WHO',
    sourceType: 'authority',
    channelId: 'UC07-dOwgza1IguKA86jqxNA',
    channelName: 'World Health Organization (WHO)',
    language: 'en',
  },
  {
    authority: 'CDC',
    sourceType: 'authority',
    channelId: 'UCiMg06DjcUk5FRiM3g5sqoQ',
    channelName: 'Centers for Disease Control and Prevention',
    language: 'en',
    region: 'AMRO',
  },
  {
    authority: 'PAHO',
    sourceType: 'authority',
    channelId: 'UCpNnv_kL4Jk8YG_VflnZpmg',
    channelName: 'PAHO TV',
    language: 'es',
    region: 'AMRO',
  },
  {
    authority: 'WHO EMRO',
    sourceType: 'authority',
    channelId: 'UCT7a_fVlSrjOs9jyvtH-uhA',
    channelName: 'WHO Eastern Mediterranean Region',
    language: 'ar',
    region: 'EMRO',
  },
  {
    authority: 'WHO WPRO',
    sourceType: 'authority',
    channelId: 'UC6LJqxyUlipQDnD6qpbltgg',
    channelName: 'World Health Organization Regional Office for the Western Pacific',
    language: 'en',
    region: 'WPRO',
  },

  // ── News organisations ─────────────────────────────────────────────────────
  // Reporting, not official guidance. Only health-relevant items are ingested.
  {
    authority: 'Reuters',
    sourceType: 'news',
    channelId: 'UChqUTb7kYRX8-EiaN3XFrSQ',
    channelName: 'Reuters',
    language: 'en',
  },
  {
    authority: 'Associated Press',
    sourceType: 'news',
    channelId: 'UC52X5wxOL_s5yw0dQk7NtgA',
    channelName: 'Associated Press',
    language: 'en',
  },
  {
    authority: 'Al Jazeera English',
    sourceType: 'news',
    channelId: 'UCNye-wNBqNL5ZzHSJj3l8Bg',
    channelName: 'Al Jazeera English',
    language: 'en',
  },
  {
    authority: 'DW News',
    sourceType: 'news',
    channelId: 'UCknLrEdhRCp1aegoMqRaCZg',
    channelName: 'DW News',
    language: 'en',
  },
  {
    authority: 'franceinfo',
    sourceType: 'news',
    channelId: 'UCO6K_kkdP-lnSCiO3tPx7WA',
    channelName: 'franceinfo',
    language: 'fr',
    region: 'EURO',
  },
  {
    authority: 'africanews',
    sourceType: 'news',
    channelId: 'UC1_E8NeF5QHY2dtdLRBCCLA',
    channelName: 'africanews',
    language: 'en',
    region: 'AFRO',
  },
  {
    authority: 'NHK WORLD-JAPAN',
    sourceType: 'news',
    channelId: 'UCSPEjw8F2nQDtmUKPFNF7_A',
    channelName: 'NHK WORLD-JAPAN',
    language: 'en',
    region: 'WPRO',
  },
  {
    authority: 'CNA Insider',
    sourceType: 'news',
    channelId: 'UC_Lnb8ZHqqgLbp-7hltuT9w',
    channelName: 'CNA Insider',
    language: 'en',
    region: 'WPRO',
  },
];

/** YouTube exposes per-channel Atom feeds with no API key or quota. */
export function feedUrlFor(source: VideoSource): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${source.channelId}`;
}

export function watchUrlFor(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Privacy-preserving embed host; avoids setting cookies until playback. */
export function embedUrlFor(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

export function isAllowlistedChannel(channelId: string): boolean {
  return VIDEO_SOURCES.some((s) => s.channelId === channelId);
}
