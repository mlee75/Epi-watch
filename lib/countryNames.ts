import countriesRef from '@/lib/data/countries.json';
import { canonicalCountry } from '@/lib/diseases';

/**
 * Country names by ISO 3166 alpha-3 (Natural Earth ADM0_A3) code, with the
 * spellings used in reporting. Pure data, so client and server can share it.
 */

const REF = countriesRef as Record<string, { name: string; names: string[] }>;

// Names used in reporting that Natural Earth does not carry.
const EXTRA_NAMES: Record<string, string[]> = {
  COD: ['DRC', 'DR Congo', 'Democratic Republic of Congo', 'Congo-Kinshasa'],
  COG: ['Republic of Congo', 'Congo-Brazzaville'],
  USA: ['United States', 'USA', 'U.S.'],
  GBR: ['UK', 'England', 'Scotland', 'Wales'],
  CIV: ["Côte d'Ivoire", "Cote d'Ivoire"],
  TUR: ['Türkiye'],
  VNM: ['Viet Nam'],
  CZE: ['Czech Republic'],
  KOR: ['Republic of Korea', 'South Korea'],
  PRK: ['North Korea'],
  IRN: ['Iran'],
  SYR: ['Syria'],
  RUS: ['Russia', 'Russian Federation'],
  TZA: ['Tanzania'],
  LAO: ['Lao', 'Laos'],
  BOL: ['Bolivia'],
  VEN: ['Venezuela'],
  MDA: ['Moldova'],
  SWZ: ['Eswatini'],
  MMR: ['Myanmar', 'Burma'],
  PSX: ['Palestine', 'Gaza', 'West Bank', 'occupied Palestinian territory'],
};

// Familiar names for display and search ("Tanzania", not "United Republic of Tanzania").
const DISPLAY: Record<string, string> = {
  USA: 'United States', TZA: 'Tanzania', RUS: 'Russia', IRN: 'Iran', SYR: 'Syria', KOR: 'South Korea',
  PRK: 'North Korea', LAO: 'Laos', BOL: 'Bolivia', VEN: 'Venezuela', MDA: 'Moldova', VNM: 'Vietnam',
  CZE: 'Czechia', GBR: 'United Kingdom', CIV: "Côte d'Ivoire", SWZ: 'Eswatini', PSX: 'Palestine',
};

export function countryNames(iso3: string): { name: string; names: string[]; queryNames: string[] } | null {
  const ref = REF[iso3];
  if (!ref) return null;
  const name = DISPLAY[iso3] ?? ref.name;
  const names = [...new Set([name, ...ref.names, ...(EXTRA_NAMES[iso3] ?? [])])];
  // Up to three spellings OR-ed into searches, e.g. "Democratic Republic of
  // the Congo" OR "DRC" OR "DR Congo".
  const queryNames = [...new Set([name, ...(EXTRA_NAMES[iso3] ?? [])])].slice(0, 3);
  return { name, names, queryNames };
}


/** ISO3 code for a country name as written in records ("DRC", "USA", …). */
export function iso3ForName(country: string, disease?: string): string | null {
  const wanted = canonicalCountry(country, disease).toLowerCase();
  for (const code of Object.keys(REF)) {
    const n = countryNames(code);
    if (n && n.names.some((x) => x.toLowerCase() === wanted)) return code;
  }
  return null;
}
