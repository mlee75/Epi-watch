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

export interface VideoSource {
  /** Publishing body. Shown to users as the provenance label. */
  authority: string;
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
  {
    authority: 'WHO',
    channelId: 'UC07-dOwgza1IguKA86jqxNA',
    channelName: 'World Health Organization (WHO)',
    language: 'en',
  },
  {
    authority: 'CDC',
    channelId: 'UCiMg06DjcUk5FRiM3g5sqoQ',
    channelName: 'Centers for Disease Control and Prevention',
    language: 'en',
    region: 'AMRO',
  },
  {
    authority: 'PAHO',
    channelId: 'UCpNnv_kL4Jk8YG_VflnZpmg',
    channelName: 'PAHO TV',
    language: 'es',
    region: 'AMRO',
  },
  {
    authority: 'WHO EMRO',
    channelId: 'UCT7a_fVlSrjOs9jyvtH-uhA',
    channelName: 'WHO Eastern Mediterranean Region',
    language: 'ar',
    region: 'EMRO',
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
