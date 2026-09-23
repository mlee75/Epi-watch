/**
 * Current emergencies with a precise location, fetched live.
 *
 *  - GDACS (UN / European Commission): earthquakes, tropical cyclones, floods,
 *    volcanoes, wildfires and droughts, with an impact alert level.
 *  - Seattle Fire Department real-time 911 dispatches: medical calls, traffic
 *    collisions and rescues, at street-address precision, published every five
 *    minutes. Seattle is one of very few cities that publishes dispatch data in
 *    real time; there is no equivalent open feed for most of the world.
 *  - Aircraft squawking 7700 (general emergency), via adsb.fi.
 *
 * Nothing is stored; each source is cached for EMERGENCIES_REVALIDATE seconds.
 */

export const EMERGENCIES_REVALIDATE = 120;
const TIMEOUT_MS = 15_000;

export type EmergencyKind = 'disaster' | 'medical-call' | 'traffic-collision' | 'rescue' | 'fire' | 'aircraft-emergency';

export interface Emergency {
  id: string;
  kind: EmergencyKind;
  title: string;
  detail: string | null;
  lat: number;
  lon: number;
  /** ISO time the event started or was dispatched. */
  time: string | null;
  /** GDACS alert level, where applicable. */
  level: 'green' | 'orange' | 'red' | null;
  source: string;
  url: string | null;
  /** Suggested zoom when the user selects it: street level for point incidents. */
  zoom: number;
}

export interface EmergencySource {
  name: string;
  ok: boolean;
  count: number;
}

export interface EmergenciesData {
  emergencies: Emergency[];
  sources: EmergencySource[];
  fetchedAt: string;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'EpiWatch/2.0 (+https://epi-watch-three.vercel.app)', Accept: 'application/json' },
    next: { revalidate: EMERGENCIES_REVALIDATE },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<T>;
}

// ─── GDACS ───────────────────────────────────────────────────────────────────

const GDACS_TYPE: Record<string, string> = {
  EQ: 'Earthquake', TC: 'Tropical cyclone', FL: 'Flood', VO: 'Volcano', WF: 'Wildfire', DR: 'Drought',
};

async function fetchGdacs(): Promise<Emergency[]> {
  const json = await getJson<{
    features: Array<{
      geometry: { coordinates: [number, number] };
      properties: {
        eventtype: string; eventid: number; episodeid: number; name: string; description: string;
        alertlevel: string; fromdate: string; iscurrent: string | boolean; country: string;
        url?: { report?: string }; severitydata?: { severitytext?: string };
      };
    }>;
  }>('https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP');

  return json.features
    .filter((f) => String(f.properties.iscurrent) === 'true')
    // Green wildfires are numerous and rarely a health emergency; keep them
    // only at orange or red.
    .filter((f) => !(f.properties.eventtype === 'WF' && f.properties.alertlevel === 'Green'))
    .map((f) => {
      const p = f.properties;
      const level = p.alertlevel?.toLowerCase() as Emergency['level'];
      return {
        id: `gdacs-${p.eventtype}-${p.eventid}`,
        kind: 'disaster' as const,
        title: p.name || `${GDACS_TYPE[p.eventtype] ?? 'Event'} in ${p.country}`,
        detail: [GDACS_TYPE[p.eventtype], p.severitydata?.severitytext].filter(Boolean).join(' · ') || null,
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        time: p.fromdate ? new Date(`${p.fromdate}Z`).toISOString() : null,
        level: level === 'green' || level === 'orange' || level === 'red' ? level : null,
        source: 'GDACS',
        url: p.url?.report ?? null,
        zoom: p.eventtype === 'EQ' || p.eventtype === 'VO' ? 8 : 6,
      };
    });
}

// ─── Seattle Fire real-time 911 ──────────────────────────────────────────────

function seattleKind(type: string): EmergencyKind | null {
  const t = type.toLowerCase();
  if (/\bmvi\b|motor vehicle|collision/.test(t)) return 'traffic-collision';
  if (/aid response|medic response|\bmci\b|triaged incident|overdose|cardiac|medic/.test(t)) return 'medical-call';
  if (/rescue|water rescue|extrication|confined/.test(t)) return 'rescue';
  if (/fire in (building|single family|commercial)|working fire|brush fire|car fire|vehicle fire/.test(t)) return 'fire';
  return null; // alarms, investigations, service calls
}

/** Seattle publishes wall-clock times in Pacific time without an offset. */
function pacificToIso(local: string): string {
  const naive = new Date(`${local.slice(0, 19)}Z`);
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'shortOffset' });
  const off = fmt.formatToParts(naive).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-8';
  const hours = Number(off.replace('GMT', '')) || -8;
  return new Date(naive.getTime() - hours * 3_600_000).toISOString();
}

async function fetchSeattle911(): Promise<Emergency[]> {
  const params = new URLSearchParams({ $order: 'datetime DESC', $limit: '200' });
  const rows = await getJson<Array<{ address: string; type: string; datetime: string; latitude?: string; longitude?: string; incident_number: string }>>(
    `https://data.seattle.gov/resource/kzjm-xkqj.json?${params}`
  );
  const cutoff = Date.now() - 3 * 3_600_000;
  const out: Emergency[] = [];
  for (const r of rows) {
    const kind = seattleKind(r.type ?? '');
    if (!kind || !r.latitude || !r.longitude) continue;
    const time = pacificToIso(r.datetime);
    if (new Date(time).getTime() < cutoff) continue;
    out.push({
      id: `sea-${r.incident_number}`,
      kind,
      title: r.type,
      detail: `${r.address}, Seattle`,
      lat: Number(r.latitude),
      lon: Number(r.longitude),
      time,
      level: null,
      source: 'Seattle Fire 911',
      url: 'https://web.seattle.gov/sfd/realtime911/',
      zoom: 16,
    });
  }
  return out;
}

// ─── Aircraft emergencies (squawk 7700) ──────────────────────────────────────

async function fetchSquawk7700(): Promise<Emergency[]> {
  const json = await getJson<{ ac?: Array<{ hex: string; flight?: string; r?: string; t?: string; desc?: string; lat?: number; lon?: number; alt_baro?: number | string; seen_pos?: number }> }>(
    'https://opendata.adsb.fi/api/v2/sqk/7700'
  );
  return (json.ac ?? [])
    .filter((a) => a.lat != null && a.lon != null && (a.seen_pos ?? 0) < 300)
    .map((a) => ({
      id: `sq-${a.hex}`,
      kind: 'aircraft-emergency' as const,
      title: `Aircraft emergency (squawk 7700): ${a.flight?.trim() || a.r || a.hex}`,
      detail: [a.desc ?? a.t, typeof a.alt_baro === 'number' ? `${a.alt_baro.toLocaleString('en-GB')} ft` : a.alt_baro === 'ground' ? 'on ground' : null]
        .filter(Boolean)
        .join(' · ') || null,
      lat: a.lat!,
      lon: a.lon!,
      time: new Date(Date.now() - (a.seen_pos ?? 0) * 1000).toISOString(),
      level: null,
      source: 'adsb.fi',
      url: `https://globe.adsb.fi/?icao=${a.hex}`,
      zoom: 9,
    }));
}

// ─── Aggregate ───────────────────────────────────────────────────────────────

export async function fetchEmergencies(): Promise<EmergenciesData> {
  const jobs: [string, () => Promise<Emergency[]>][] = [
    ['GDACS disasters', fetchGdacs],
    ['Seattle Fire 911', fetchSeattle911],
    ['Aircraft emergencies (7700)', fetchSquawk7700],
  ];
  const results = await Promise.all(
    jobs.map(async ([name, run]) => {
      try {
        const list = await run();
        return { name, ok: true, list };
      } catch {
        return { name, ok: false, list: [] as Emergency[] };
      }
    })
  );
  const emergencies = results.flatMap((r) => r.list).sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''));
  return {
    emergencies,
    sources: results.map((r) => ({ name: r.name, ok: r.ok, count: r.list.length })),
    fetchedAt: new Date().toISOString(),
  };
}
