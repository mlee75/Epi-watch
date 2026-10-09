import admin1 from '@/lib/data/admin1.json';
import countriesRef from '@/lib/data/countries.json';
import { iso3ForName } from '@/lib/countryNames';
import { normalizeSeverity, severityRank, type SeverityLevel } from '@/lib/severity';
import type { Outbreak } from '@/lib/types';

/**
 * Places outbreak records on the map as precisely as the report allows.
 *
 * Stored coordinates are country centre points, so every record in a country
 * used to land on the same dot. Curated records name the provinces affected
 * ("South Kivu, Equateur", "Kasai Province (Bulape)"); those names are matched
 * against Natural Earth's 4,589 first-level divisions (lib/data/admin1.json,
 * built from ne_10m_admin_1_states_provinces) and each match becomes its own
 * hotspot. Records with no usable place name sit at the country's main land
 * mass. Each hotspot says which it is (`precise`), and the map legend repeats
 * it, so a province-level mark is never mistaken for a country-level one and
 * vice versa.
 *
 * Server-side only: admin1.json is 280 KB and must not reach the browser.
 */

export interface Hotspot {
  id: string;
  iso3: string;
  country: string;
  /** Province or state the report named, or null for a country-level mark. */
  place: string | null;
  precise: boolean;
  lat: number;
  lon: number;
  severity: SeverityLevel;
  records: number;
  /** Largest single case figure among the records here (0 when none stated). */
  cases: number;
  diseases: string[];
}

type Admin1 = Record<string, Array<[string, number, number, string[]]>>;
type CountryRef = Record<string, { name: string; names: string[]; lat?: number; lon?: number }>;

const ADMIN1 = admin1 as unknown as Admin1;
const COUNTRIES = countriesRef as unknown as CountryRef;

const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Words that describe the division rather than name it.
const SUFFIX = /\b(province|provinces|state|states|department|departamento|division|region|regions|regional state|district|governorate|county|prefecture|territory|oblast)\b/g;
const PREFIX = /^(the|metro|state of|province of|region of|department of)\s+/;

// Phrases that mean "the whole country" or "many places": no province mark.
const WHOLE_COUNTRY = /^(nationwide|national|multiple|several|various|many|all)\b|other (states|provinces|regions)|^(north|south|east|west|central|southeast|northeast|southwest|northwest)(ern)? /;

// Report spellings that differ from Natural Earth's.
const ALIAS: Record<string, Record<string, string>> = {
  ETH: { 'south ethiopia': 'southern nations', 'southern ethiopia': 'southern nations', sidama: 'southern nations' },
  SOM: { banadir: 'banaadir', benadir: 'banaadir' },
  COD: { kasai: 'kasai-occidental', 'kasai central': 'kasai-occidental', 'kasai oriental': 'kasai-oriental', equateur: 'equateur' },
  PHL: { 'metro manila': 'metropolitan manila', ncr: 'metropolitan manila' },
};

function tokens(subregion: string): string[] {
  return subregion
    .split(/,|;|\band\b|\(|\)|\//)
    .map((t) => fold(t).replace(SUFFIX, ' ').replace(/\s+/g, ' ').trim().replace(PREFIX, ''))
    .filter((t) => t.length >= 3 && !/\d/.test(t) && !WHOLE_COUNTRY.test(t));
}

function findProvince(iso3: string, token: string): { name: string; lat: number; lon: number } | null {
  const list = ADMIN1[iso3];
  if (!list) return null;
  const t = ALIAS[iso3]?.[token] ?? token;
  const exact = list.filter(([name, , , alts]) => fold(name) === t || alts.includes(t));
  const hits = exact.length ? exact : t.length >= 5 ? list.filter(([name, , , alts]) => fold(name).includes(t) || alts.some((a) => a.includes(t))) : [];
  if (!hits.length) return null;
  // Several divisions can share a stem (Davao del Sur, Davao del Norte …):
  // place the mark between them rather than guessing one.
  const lat = hits.reduce((s, h) => s + h[1], 0) / hits.length;
  const lon = hits.reduce((s, h) => s + h[2], 0) / hits.length;
  return { name: hits.length === 1 ? hits[0][0] : hits[0][0].replace(/ (del|de|do) .*$/i, ''), lat, lon };
}

export function placeOutbreaks(outbreaks: Outbreak[]): Hotspot[] {
  const agg = new Map<string, Hotspot>();
  const add = (key: string, o: Outbreak, spot: Omit<Hotspot, 'id' | 'severity' | 'records' | 'cases' | 'diseases'>) => {
    const sev = normalizeSeverity(o.severity);
    const h = agg.get(key) ?? { id: key, ...spot, severity: sev, records: 0, cases: 0, diseases: [] };
    h.records++;
    h.cases = Math.max(h.cases, o.cases ?? 0);
    if (severityRank(sev) < severityRank(h.severity)) h.severity = sev;
    if (!h.diseases.includes(o.disease)) h.diseases.push(o.disease);
    agg.set(key, h);
  };

  for (const o of outbreaks) {
    const iso3 = iso3ForName(o.country, o.disease);
    const ref = iso3 ? COUNTRIES[iso3] : undefined;
    if (!iso3 || !ref || ref.lat == null || ref.lon == null) continue;
    const country = ref.name.replace(/ of America$/, '');

    const provinces = o.subregion
      ? tokens(o.subregion).map((t) => findProvince(iso3, t)).filter((p): p is NonNullable<typeof p> => !!p)
      : [];
    if (provinces.length) {
      for (const p of provinces) add(`${iso3}|${p.name}`, o, { iso3, country, place: p.name, precise: true, lat: p.lat, lon: p.lon });
    } else {
      add(`${iso3}|`, o, { iso3, country, place: null, precise: false, lat: ref.lat, lon: ref.lon });
    }
  }
  // Worst severity last, so it draws on top.
  return [...agg.values()].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}
