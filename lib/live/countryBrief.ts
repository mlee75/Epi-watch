import { countryNames } from '@/lib/countryNames';
import {
  ALERTS_REVALIDATE, DISEASE, NATIONAL_SOURCES, TERMS, getText, hostOf, isJunkTitle, onDomain, parseFeed, stripPublisher,
} from './alerts';

/**
 * Everything Epi-watch can find about one country from verified sources.
 *
 * "Verified" here means the publisher is on an explicit allowlist, checked
 * against the publisher URL of every item (never the headline):
 *  - national:     the country's own health authority (NATIONAL_SOURCES)
 *  - agencies:     WHO (Disease Outbreak News, headquarters and regional
 *                  offices), PAHO, ECDC, Africa CDC, CDC travel notices
 *  - humanitarian: ReliefWeb (publishes only vetted organisations), MSF,
 *                  UNICEF, IFRC
 *  - press:        wire services and established health desks
 * Windows are wider than on the alerts page: 180 days for agencies and the
 * national authority, 90 for humanitarian reporting, 45 for press. Nothing is
 * stored; upstream responses are cached for ALERTS_REVALIDATE seconds.
 */

export type BriefGroup = 'national' | 'agencies' | 'humanitarian' | 'press';

export interface BriefItem {
  id: string;
  title: string;
  url: string;
  publisher: string;
  publishedAt: string | null;
  group: BriefGroup;
  language: string;
  kind?: 'outbreak-notice' | 'travel-notice';
}

export interface CountryBrief {
  iso3: string;
  name: string;
  names: string[];
  items: BriefItem[];
  sources: { group: BriefGroup; label: string; domains: string[]; windowDays: number; ok: boolean; count: number }[];
  fetchedAt: string;
}

function nameMatcher(names: string[]): RegExp {
  const esc = names.filter((n) => n.length > 2).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(^|[^\\p{L}])(${esc.join('|')})($|[^\\p{L}])`, 'iu');
}

function hashId(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const days = (n: number) => Date.now() - n * 86_400_000;

// A headline is kept from agency, humanitarian or press searches only if it
// is about health: a named disease (DISEASE) or these general terms.
const HEALTH_WORDS = /outbreak|epidemic|pandemic|virus|disease|infection|vaccin|immunis|immuniz|hospital|health|medical|clinic|cases|deaths from|malnutrition|nutrition|sanitation|WASH|doctors|nurses|patients/i;
const HEALTH = { test: (t: string) => DISEASE.test(t) || HEALTH_WORDS.test(t) };

// ─── Search groups (Google News, restricted to allowlisted publishers) ──────

interface SearchGroup {
  group: BriefGroup;
  label: string;
  domains: string[];
  windowDays: number;
  /** Extra terms AND-ed with the country name. */
  terms: string;
  max: number;
}

const HEALTH_TERMS_EN = 'outbreak OR epidemic OR cases OR cholera OR measles OR mpox OR Ebola OR dengue OR malaria OR vaccination OR hospital OR "health emergency"';

const GROUPS: SearchGroup[] = [
  {
    group: 'agencies', label: 'WHO, PAHO, ECDC, Africa CDC',
    domains: ['who.int', 'paho.org', 'ecdc.europa.eu', 'africacdc.org'],
    windowDays: 180, terms: HEALTH_TERMS_EN, max: 20,
  },
  {
    group: 'humanitarian', label: 'ReliefWeb, MSF, UNICEF, IFRC',
    domains: ['reliefweb.int', 'msf.org', 'doctorswithoutborders.org', 'unicef.org', 'ifrc.org'],
    windowDays: 90, terms: HEALTH_TERMS_EN, max: 20,
  },
  {
    group: 'press', label: 'Reuters, AP, AFP (France 24), BBC, Al Jazeera, CIDRAP, STAT, Health Policy Watch',
    domains: ['reuters.com', 'apnews.com', 'france24.com', 'bbc.com', 'bbc.co.uk', 'aljazeera.com', 'cidrap.umn.edu', 'statnews.com', 'healthpolicy-watch.news'],
    windowDays: 45, terms: 'outbreak OR epidemic OR cholera OR measles OR mpox OR Ebola OR dengue OR "health workers" OR hospital', max: 20,
  },
];

async function searchGroup(g: SearchGroup, countryNamesQ: string[], matcher: RegExp): Promise<BriefItem[]> {
  const sites = g.domains.map((d) => `site:${d}`).join(' OR ');
  const names = countryNamesQ.map((n) => `"${n}"`).join(' OR ');
  const q = `(${names}) (${sites}) (${g.terms}) when:${g.windowDays}d`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
  const cutoff = days(g.windowDays);
  return parseFeed(await getText(url))
    .map((i) => ({ ...i, title: stripPublisher(i.title, i.sourceName) }))
    .filter((i) =>
      onDomain(hostOf(i.sourceUrl), g.domains) &&
      !isJunkTitle(i.title) &&
      // The headline itself must name the country (a hit on the page body is
      // often a list of many countries) and be about health: search terms
      // match loosely, and press searches returned elections and energy deals.
      matcher.test(i.title) &&
      HEALTH.test(i.title) &&
      (!i.publishedAt || new Date(i.publishedAt).getTime() >= cutoff)
    )
    .slice(0, g.max)
    .map((i) => ({
      id: hashId(i.url), title: i.title, url: i.url, publisher: i.sourceName || hostOf(i.sourceUrl) || 'Source',
      publishedAt: i.publishedAt, group: g.group, language: 'en',
    }));
}

async function searchNational(iso3: string): Promise<{ items: BriefItem[]; label: string; domains: string[] } | null> {
  const src = NATIONAL_SOURCES.find((s) => s.iso3 === iso3);
  if (!src) return null;
  const sites = src.domains.map((d) => `site:${d}`).join(' OR ');
  const q = `(${sites}) (${TERMS[src.lang] ?? TERMS.en}) when:180d`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${src.hl}&gl=${src.gl}&ceid=${src.ceid}`;
  const cutoff = days(180);
  const items = parseFeed(await getText(url))
    .map((i) => ({ ...i, title: stripPublisher(i.title, i.sourceName) }))
    .filter((i) => onDomain(hostOf(i.sourceUrl), src.domains) && !isJunkTitle(i.title) && DISEASE.test(i.title))
    .filter((i) => !i.publishedAt || new Date(i.publishedAt).getTime() >= cutoff)
    .slice(0, 30)
    .map((i) => ({
      id: hashId(i.url), title: i.title, url: i.url, publisher: i.sourceName || src.authority,
      publishedAt: i.publishedAt, group: 'national' as const, language: src.lang,
    }));
  return { items, label: src.authority, domains: src.domains };
}

// ─── Structured agency feeds ─────────────────────────────────────────────────

async function whoDonFor(matcher: RegExp): Promise<BriefItem[]> {
  // The API returns at most 100 notices per request; two pages cover about
  // four years of Disease Outbreak News.
  type Don = { Title: string; OverrideTitle: string | null; UseOverrideTitle: boolean; UrlName: string; PublicationDateAndTime: string };
  const page = async (skip: number) => {
    const params = new URLSearchParams({ $top: '100', $skip: String(skip), $orderby: 'PublicationDateAndTime desc', $select: 'Title,UrlName,PublicationDateAndTime,OverrideTitle,UseOverrideTitle' });
    return (JSON.parse(await getText(`https://www.who.int/api/news/diseaseoutbreaknews?${params}`)) as { value: Don[] }).value;
  };
  const all = (await Promise.all([page(0), page(100)])).flat();
  return all
    .map((d) => ({ ...d, title: (d.UseOverrideTitle && d.OverrideTitle) || d.Title }))
    .filter((d) => matcher.test(d.title))
    .slice(0, 15)
    .map((d) => ({
      id: hashId(d.UrlName), title: d.title, url: `https://www.who.int/emergencies/disease-outbreak-news/item/${d.UrlName}`,
      publisher: 'WHO Disease Outbreak News', publishedAt: d.PublicationDateAndTime, group: 'agencies' as const,
      language: 'en', kind: 'outbreak-notice' as const,
    }));
}

async function cdcTravelFor(matcher: RegExp): Promise<BriefItem[]> {
  return parseFeed(await getText('https://wwwnc.cdc.gov/travel/rss/notices.xml'))
    .filter((i) => matcher.test(i.title))
    .map((i) => ({
      id: hashId(i.url), title: i.title, url: i.url, publisher: 'CDC travel notices', publishedAt: i.publishedAt,
      group: 'agencies' as const, language: 'en', kind: 'travel-notice' as const,
    }));
}

// ─── Aggregate ───────────────────────────────────────────────────────────────

export async function fetchCountryBrief(iso3: string): Promise<CountryBrief | null> {
  const ref = countryNames(iso3);
  if (!ref) return null;
  const matcher = nameMatcher(ref.names);

  type Job = { group: BriefGroup; label: string; domains: string[]; windowDays: number; run: () => Promise<BriefItem[]> };
  const national = NATIONAL_SOURCES.find((s) => s.iso3 === iso3);
  const jobs: Job[] = [
    ...(national
      ? [{ group: 'national' as const, label: national.authority, domains: national.domains, windowDays: 180,
          run: async () => (await searchNational(iso3))?.items ?? [] }]
      : []),
    { group: 'agencies', label: 'WHO Disease Outbreak News', domains: ['who.int'], windowDays: 1095, run: () => whoDonFor(matcher) },
    { group: 'agencies', label: 'CDC travel notices', domains: ['cdc.gov'], windowDays: 365, run: () => cdcTravelFor(matcher) },
    ...GROUPS.map((g) => ({ group: g.group, label: g.label, domains: g.domains, windowDays: g.windowDays, run: () => searchGroup(g, ref.queryNames, matcher) })),
  ];

  const results = await Promise.all(jobs.map(async (j) => {
    try { return { j, items: await j.run(), ok: true }; } catch { return { j, items: [] as BriefItem[], ok: false }; }
  }));

  const seen = new Set<string>();
  const items: BriefItem[] = [];
  for (const r of results) for (const it of r.items) {
    const key = it.title.toLowerCase().replace(/\W+/g, ' ').trim();
    if (seen.has(it.url) || seen.has(key)) continue;
    seen.add(it.url); seen.add(key);
    items.push(it);
  }
  items.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));

  return {
    iso3,
    name: ref.name,
    names: ref.names,
    items,
    sources: results.map((r) => ({ group: r.j.group, label: r.j.label, domains: r.j.domains, windowDays: r.j.windowDays, ok: r.ok, count: r.items.length })),
    fetchedAt: new Date().toISOString(),
  };
}

export { ALERTS_REVALIDATE as BRIEF_REVALIDATE, countryNames };
