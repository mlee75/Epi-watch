import medicalDb from './data/medical-aircraft.json';

/**
 * Live positions of emergency-service aircraft, from ADS-B.
 *
 * Source: adsb.lol, a community ADS-B network (data licensed ODbL). It has no
 * "medical" filter, so aircraft are fetched by type (the helicopter and
 * turboprop types air-ambulance services fly) and then identified by:
 *  1. operator: the ICAO address is in medical-aircraft.json, built from
 *     national registries by scripts/build-medical-aircraft.mjs (mostly US,
 *     Australia);
 *  2. callsign: services that broadcast a recognisable callsign (UK Helimed,
 *     German "Christoph", Swiss Rega, French SAMU; national search and rescue);
 *  3. the ADS-B "lifeguard" priority status, which a crew sets on a medical
 *     flight.
 * Aircraft whose owners opted out of public tracking (FAA LADD or PIA flags)
 * are excluded. Positions are as broadcast; coverage depends on volunteer
 * receivers and is dense in North America and Europe, sparse elsewhere.
 *
 * All types go in a single request (the endpoint takes a comma-separated
 * list), cached for AIRCRAFT_REVALIDATE seconds and shared by all visitors.
 */

export const AIRCRAFT_REVALIDATE = 30;

export type AircraftRole = 'hems' | 'sar' | 'medical-flight';

export interface EmergencyAircraft {
  hex: string;
  callsign: string | null;
  registration: string | null;
  type: string | null;
  operator: string | null;
  role: AircraftRole;
  /** How the aircraft was identified, shown to the user. */
  basis: 'operator' | 'callsign' | 'lifeguard';
  lat: number;
  lon: number;
  altitudeFt: number | null; // null when on the ground
  groundSpeedKt: number | null;
  trackDeg: number | null;
  /** Seconds since the position was received, at fetch time. */
  seenPosSec: number;
  squawk: string | null;
}

export interface AircraftData {
  ok: boolean;
  aircraft: EmergencyAircraft[];
  fetchedAt: string;
  /** Aircraft of the queried types seen worldwide, before identification. */
  scanned: number;
}

const DB = medicalDb as unknown as Record<string, [string, string, string]>;

// Types flown on air-ambulance and rescue work (most common first).
const TYPES = [
  'EC35', 'B407', 'EC45', 'AS50', 'B06', 'EC30', 'A109', 'A119', 'A139', 'A169', 'BK17', 'S76', 'B429', 'H160', 'EC55',
  'AS65', 'EXPL', 'S92', 'EC25', 'PC12', 'BE20', 'BE9L', 'C56X', 'LJ35', 'LJ45', 'PC24',
];

const HEMS_CALLSIGN: [RegExp, string][] = [
  [/^HLE\d/, 'UK air ambulance (Helimed)'],
  [/^CHX\d/, 'German air rescue (Christoph)'],
  [/^(RGA|SAZ)\d/, 'Rega (Switzerland)'],
  [/^SAMU\d/, 'SAMU (France)'],
];
const SAR_CALLSIGN: [RegExp, string][] = [
  [/^NOR(SAR|RSC)/, 'Norwegian search and rescue'],
  [/^(RESCUE|RSCU)/, 'Search and rescue'],
  [/^CROSS\d/, 'French maritime rescue (CROSS)'],
];

// tar1090 dbFlags bits: 4 = PIA (privacy ICAO address), 8 = LADD.
const OPTED_OUT = 4 | 8;

interface AdsbAc {
  hex: string;
  flight?: string;
  r?: string;
  t?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | 'ground';
  gs?: number;
  track?: number;
  true_heading?: number;
  seen_pos?: number;
  squawk?: string;
  emergency?: string;
  dbFlags?: number;
}

function classify(a: AdsbAc): Pick<EmergencyAircraft, 'role' | 'basis' | 'operator'> | null {
  const cs = (a.flight ?? '').trim().toUpperCase();
  const db = DB[a.hex.toLowerCase()];
  if (db) return { role: 'hems', basis: 'operator', operator: db[2] };
  for (const [re, name] of HEMS_CALLSIGN) if (re.test(cs)) return { role: 'hems', basis: 'callsign', operator: name };
  for (const [re, name] of SAR_CALLSIGN) if (re.test(cs)) return { role: 'sar', basis: 'callsign', operator: name };
  if (a.emergency === 'lifeguard') return { role: 'medical-flight', basis: 'lifeguard', operator: null };
  return null;
}

export async function fetchEmergencyAircraft(): Promise<AircraftData> {
  let list: AdsbAc[];
  try {
    const res = await fetch(`https://api.adsb.lol/v2/type/${TYPES.join(',')}`, {
      headers: { 'User-Agent': 'EpiWatch/2.0 (+https://epi-watch-three.vercel.app)' },
      next: { revalidate: AIRCRAFT_REVALIDATE },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(String(res.status));
    list = ((await res.json()) as { ac?: AdsbAc[] }).ac ?? [];
  } catch {
    return { ok: false, aircraft: [], fetchedAt: new Date().toISOString(), scanned: 0 };
  }

  const aircraft: EmergencyAircraft[] = [];
  for (const a of list) {
    if (a.lat == null || a.lon == null) continue;
    if ((a.dbFlags ?? 0) & OPTED_OUT) continue;
    if ((a.seen_pos ?? 0) > 120) continue; // stale position
    const c = classify(a);
    if (!c) continue;
    aircraft.push({
      hex: a.hex,
      callsign: a.flight?.trim() || null,
      registration: a.r ?? DB[a.hex.toLowerCase()]?.[0] ?? null,
      type: a.t ?? null,
      ...c,
      lat: a.lat,
      lon: a.lon,
      altitudeFt: typeof a.alt_baro === 'number' ? a.alt_baro : null,
      groundSpeedKt: a.gs ?? null,
      trackDeg: a.track ?? a.true_heading ?? null,
      seenPosSec: a.seen_pos ?? 0,
      squawk: a.squawk ?? null,
    });
  }
  return { ok: true, aircraft, fetchedAt: new Date().toISOString(), scanned: list.length };
}
