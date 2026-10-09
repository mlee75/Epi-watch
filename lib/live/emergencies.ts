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

/** Affected-area polygon from GDACS (wind zones, shaking contours, fire and flood extents). */
export interface AreaProps {
  id: string;
  eventtype: string;
  /** Drawing class: red > orange > green (storm force / shaking felt). */
  level: 'red' | 'orange' | 'green';
  label: string;
}

export type AreaCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, AreaProps>;

export interface EmergenciesData {
  emergencies: Emergency[];
  sources: EmergencySource[];
  fetchedAt: string;
}

async function getJson<T>(url: string, revalidate = EMERGENCIES_REVALIDATE): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'EpiWatch/2.0 (+https://epi-watch-three.vercel.app)', Accept: 'application/json' },
    next: { revalidate },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<T>;
}

// ─── GDACS ───────────────────────────────────────────────────────────────────

const GDACS_TYPE: Record<string, string> = {
  EQ: 'Earthquake', TC: 'Tropical cyclone', FL: 'Flood', VO: 'Volcano', WF: 'Wildfire', DR: 'Drought',
};

type GdacsFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    eventtype: string; eventid: number; episodeid: number; name: string; description: string;
    alertlevel: string; fromdate: string; iscurrent: string | boolean; country: string;
    url?: { report?: string; geometry?: string }; severitydata?: { severitytext?: string };
  };
};

async function fetchGdacsEvents(): Promise<GdacsFeature[]> {
  const json = await getJson<{ features: GdacsFeature[] }>('https://www.gdacs.org/gdacsapi/api/events/geteventlist/EVENTS4APP');
  return json.features
    .filter((f) => String(f.properties.iscurrent) === 'true')
    // Green wildfires are numerous and rarely a health emergency; keep them
    // only at orange or red.
    .filter((f) => !(f.properties.eventtype === 'WF' && f.properties.alertlevel === 'Green'));
}

function toEmergency(f: GdacsFeature): Emergency {
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
}

async function fetchGdacs(): Promise<Emergency[]> {
  return (await fetchGdacsEvents()).map(toEmergency);
}

/**
 * Drops points closer than `tol` degrees to the last kept one. Cyclone wind
 * zones arrive as dense buffers (a track can be 350 KB); on a globe at the
 * zooms they are seen, 0.01° (about 1 km) is below one pixel.
 */
function thin(ring: GeoJSON.Position[], tol: number): GeoJSON.Position[] {
  const out: GeoJSON.Position[] = [];
  let last: GeoJSON.Position | null = null;
  for (const pt of ring) {
    if (!last || Math.abs(pt[0] - last[0]) + Math.abs(pt[1] - last[1]) >= tol) {
      out.push([Math.round(pt[0] * 1000) / 1000, Math.round(pt[1] * 1000) / 1000]);
      last = pt;
    }
  }
  if (out.length && (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1])) out.push(out[0]);
  return out.length >= 4 ? out : [];
}

/**
 * GDACS publishes, per event, the actual affected area: tropical-cyclone wind
 * zones (Poly_Red/Orange/Green), earthquake shaking-intensity contours
 * (Poly_SMPInt_<MMI>), fire and flood extents (Poly_area). These replace the
 * old fixed-radius rings. Geometries change slowly, so they are cached for
 * ten minutes.
 */
async function fetchGdacsAreas(events: GdacsFeature[]): Promise<AreaCollection> {
  const features: AreaCollection['features'] = [];
  await Promise.all(events.map(async (ev) => {
    const u = ev.properties.url?.geometry;
    if (!u) return;
    try {
      const fc = await getJson<GeoJSON.FeatureCollection>(u, 600);
      const id = `gdacs-${ev.properties.eventtype}-${ev.properties.eventid}`;
      const alert = (ev.properties.alertlevel?.toLowerCase() || 'green') as AreaProps['level'];
      const polys = fc.features.filter((f) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'));
      const classes = polys.map((f) => String((f.properties as Record<string, unknown> | null)?.Class ?? ''));
      const hasIntensity = classes.some((c) => c.startsWith('Poly_SMPInt_'));
      // Cyclone wind zones come once per forecast advisory, dozens along a
      // track. Keep at most MAX_PER_CLASS per class, evenly spaced, which
      // still traces the track and cuts the payload by about two thirds.
      const MAX_PER_CLASS = 8;
      const perClass = new Map<string, number[]>();
      classes.forEach((c, i) => perClass.set(c, [...(perClass.get(c) ?? []), i]));
      const keep = new Set<number>();
      for (const idxs of perClass.values()) {
        if (idxs.length <= MAX_PER_CLASS) idxs.forEach((i) => keep.add(i));
        else for (let k = 0; k < MAX_PER_CLASS; k++) keep.add(idxs[Math.round((k * (idxs.length - 1)) / (MAX_PER_CLASS - 1))]);
      }
      polys.forEach((f, i) => {
        if (!keep.has(i)) return;
        const cls = classes[i];
        let level: AreaProps['level'] | null = null;
        let label = GDACS_TYPE[ev.properties.eventtype] ?? 'Affected area';
        if (cls === 'Poly_Red') { level = 'red'; label = 'Hurricane-force winds'; }
        else if (cls === 'Poly_Orange') { level = 'orange'; label = 'Storm-force winds'; }
        else if (cls === 'Poly_Green') { level = 'green'; label = 'Tropical-storm-force winds'; }
        else if (cls.startsWith('Poly_SMPInt_')) {
          const mmi = Number(cls.slice('Poly_SMPInt_'.length));
          if (!(mmi >= 4)) return;
          level = mmi >= 6 ? 'red' : mmi >= 5 ? 'orange' : 'green';
          label = `Shaking intensity ${mmi}+`;
        }
        else if (cls === 'Poly_Circle' && hasIntensity) return;
        else if (ev.properties.eventtype === 'EQ' && cls === 'Poly_Circle') { level = 'green'; label = 'Felt area'; }
        else { level = alert === 'red' || alert === 'orange' ? alert : 'green'; }
        const tol = ev.properties.eventtype === 'TC' ? 0.03 : 0.01;
        const g = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
        const coords = g.type === 'Polygon'
          ? [g.coordinates.map((r) => thin(r, tol)).filter((r) => r.length)]
          : g.coordinates.map((p) => p.map((r) => thin(r, tol)).filter((r) => r.length)).filter((p) => p.length);
        const polysOut = coords.filter((p) => p.length);
        if (!polysOut.length) return;
        features.push({
          type: 'Feature',
          geometry: polysOut.length === 1 ? { type: 'Polygon', coordinates: polysOut[0] } : { type: 'MultiPolygon', coordinates: polysOut },
          properties: { id, eventtype: ev.properties.eventtype, level, label },
        });
      });
    } catch { /* this event keeps its point marker only */ }
  }));
  // Widest zones first so the severe ones draw on top.
  const rank = { green: 0, orange: 1, red: 2 };
  features.sort((a, b) => rank[a.properties.level] - rank[b.properties.level]);
  return { type: 'FeatureCollection', features };
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

/**
 * Affected-area shapes for the current GDACS events. Served separately from
 * the two-minute emergency list because the shapes are large (a few hundred
 * KB) and change slowly; the map fetches them every ten minutes.
 */
export async function fetchEmergencyAreas(): Promise<AreaCollection> {
  try {
    return await fetchGdacsAreas(await fetchGdacsEvents());
  } catch {
    return { type: 'FeatureCollection', features: [] };
  }
}
