/**
 * Shared constants for the live map: colours, layer ids and the country-name
 * matching used to shade Natural Earth polygons.
 */
import { canonicalCountry } from '@/lib/diseases';
import { NO_RECORD_COLOR, SEVERITY_COLOR, type SeverityLevel } from '@/lib/severity';

export const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';
export const SATELLITE_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const COUNTRIES_URL = '/data/countries-110m.geojson';

// Point-layer colours. Each family has its own shape (arrow, dot, ring), and
// each three-colour set passes the colour-vision checks (validate_palette.js,
// all pairs, dark surface).
export const COLOR = {
  hems: '#d55181',
  sar: '#3987e5',
  aircraftEmergency: '#c98500',
  medicalCall: '#9085e9',
  collision: '#c98500',
  rescueFire: '#199e70',
  camera: '#c3c2b7',
  hospital: '#f5f4f0',
} as const;

export const GDACS_COLOR: Record<string, string> = {
  red: SEVERITY_COLOR.CRITICAL,
  orange: SEVERITY_COLOR.HIGH,
  green: SEVERITY_COLOR.LOW,
};

export const SEVERITY_FILL: Record<SeverityLevel | 'NONE', string> = {
  ...SEVERITY_COLOR,
  NONE: NO_RECORD_COLOR,
};

// Natural Earth names that differ from the names used in records.
const NE_ALIAS: Record<string, string> = {
  'United States': 'United States of America',
  Tanzania: 'United Republic of Tanzania',
  "Côte d'Ivoire": 'Ivory Coast',
  "Cote d'Ivoire": 'Ivory Coast',
  'Republic of Congo': 'Republic of the Congo',
  'Viet Nam': 'Vietnam',
  Türkiye: 'Turkey',
  'Czech Republic': 'Czechia',
  Eswatini: 'eSwatini',
  Swaziland: 'eSwatini',
  Burma: 'Myanmar',
  'East Timor': 'Timor-Leste',
  'South Korea': 'South Korea',
  'North Korea': 'North Korea',
};

type NeProps = { ADMIN?: string; NAME?: string; NAME_LONG?: string; FORMAL_EN?: string; NAME_ALT?: string; ADM0_A3?: string };

/**
 * Index from exact country names to Natural Earth ADM0_A3 codes. Exact
 * matching replaces the old substring match, which gave Nigeria Niger's
 * records and South Sudan Sudan's.
 */
export function buildCountryIndex(features: Array<{ properties: NeProps }>): Map<string, string> {
  const idx = new Map<string, string>();
  for (const f of features) {
    const p = f.properties;
    if (!p.ADM0_A3) continue;
    for (const n of [p.ADMIN, p.NAME, p.NAME_LONG, p.FORMAL_EN, p.NAME_ALT]) {
      if (n) idx.set(n.toLowerCase(), p.ADM0_A3);
    }
  }
  return idx;
}

export function countryCode(idx: Map<string, string>, country: string, disease?: string): string | null {
  const c = canonicalCountry(country, disease);
  const name = NE_ALIAS[c] ?? c;
  return idx.get(name.toLowerCase()) ?? null;
}
