'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { GeoJSONSource, Map as MlMap, MapGeoJSONFeature } from 'maplibre-gl';
import type { Outbreak } from '@/lib/types';
import type { AircraftData, EmergencyAircraft } from '@/lib/live/aircraft';
import type { EmergenciesData, Emergency } from '@/lib/live/emergencies';
import type { Camera } from '@/lib/live/cameras';
import { distanceKm, project } from '@/lib/geo';
import { normalizeSeverity, severityRank, SEVERITY_LABEL, SEVERITY_ORDER, SEVERITY_RULE, type SeverityLevel } from '@/lib/severity';
import { CountryTooltip } from '@/components/CountryTooltip';
import { OutbreakDetailPanel } from '@/components/OutbreakDetailPanel';
import {
  BASEMAP_STYLE, COLOR, COUNTRIES_URL, GDACS_COLOR, SATELLITE_TILES, SEVERITY_FILL, buildCountryIndex, countryCode,
} from './mapStyle';

// ─── Types ───────────────────────────────────────────────────────────────────

type LayerKey = 'hems' | 'sar' | 'acEmergency' | 'disasters' | 'medicalCalls' | 'collisions' | 'rescueFire' | 'cameras' | 'hospitals' | 'outbreaks';

type Selection =
  | { kind: 'aircraft'; hex: string }
  | { kind: 'emergency'; id: string }
  | { kind: 'camera'; id: string }
  | { kind: 'country'; name: string; iso3: string }
  | null;

interface Props {
  outbreaks: Outbreak[];
  /** "live": full operations map. "disease": shades only the given countries. */
  mode?: 'live' | 'disease';
  /** Disease mode: canonical country names and the worst severity for each. */
  highlight?: Record<string, SeverityLevel>;
  /** Disease mode: called when a highlighted country is clicked. */
  onCountryClick?: (country: string) => void;
  aiEnabled?: boolean;
  height?: number;
  /** Extra overlay rendered inside the map canvas (e.g. the live TV panel). */
  overlay?: ReactNode;
}

const LAYER_DEFS: { key: LayerKey; label: string; color: string; shape: 'arrow' | 'dot' | 'ring' | 'square' | 'fill' | 'label'; group: string }[] = [
  { key: 'hems', label: 'Air ambulances', color: COLOR.hems, shape: 'arrow', group: 'Aircraft (live ADS-B)' },
  { key: 'sar', label: 'Search and rescue', color: COLOR.sar, shape: 'arrow', group: 'Aircraft (live ADS-B)' },
  { key: 'acEmergency', label: 'Aircraft emergencies (7700)', color: COLOR.aircraftEmergency, shape: 'arrow', group: 'Aircraft (live ADS-B)' },
  { key: 'disasters', label: 'Disasters (GDACS)', color: GDACS_COLOR.orange, shape: 'ring', group: 'Emergencies' },
  { key: 'medicalCalls', label: 'Medical calls (Seattle 911)', color: COLOR.medicalCall, shape: 'dot', group: 'Emergencies' },
  { key: 'collisions', label: 'Traffic collisions (Seattle 911)', color: COLOR.collision, shape: 'dot', group: 'Emergencies' },
  { key: 'rescueFire', label: 'Rescues and fires (Seattle 911)', color: COLOR.rescueFire, shape: 'dot', group: 'Emergencies' },
  { key: 'outbreaks', label: 'Outbreak records by country', color: SEVERITY_FILL.CRITICAL, shape: 'fill', group: 'Context' },
  { key: 'hospitals', label: 'Hospitals (zoom in)', color: COLOR.hospital, shape: 'label', group: 'Context' },
  { key: 'cameras', label: 'Traffic cameras (London, Seattle)', color: COLOR.camera, shape: 'square', group: 'Context' },
];

const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  hems: true, sar: true, acEmergency: true, disasters: true, medicalCalls: true, collisions: true, rescueFire: true,
  cameras: false, hospitals: true, outbreaks: true,
};

const EMERGENCY_LAYER: Record<Emergency['kind'], LayerKey> = {
  disaster: 'disasters',
  'medical-call': 'medicalCalls',
  'traffic-collision': 'collisions',
  rescue: 'rescueFire',
  fire: 'rescueFire',
  'aircraft-emergency': 'acEmergency',
};

const ROLE_LABEL: Record<EmergencyAircraft['role'], string> = {
  hems: 'Air ambulance',
  sar: 'Search and rescue',
  'medical-flight': 'Medical flight (lifeguard status)',
};

const BASIS_LABEL: Record<EmergencyAircraft['basis'], string> = {
  operator: 'Identified from the aircraft registry: the registered operator is an air-medical service.',
  callsign: 'Identified from its callsign.',
  lifeguard: 'The crew has set the ADS-B "lifeguard" medical-flight status.',
};

const AIRCRAFT_REFRESH_MS = 30_000;
const EMERGENCY_REFRESH_MS = 120_000;
const MAX_EXTRAPOLATE_S = 120;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

function arrowImage(): { width: number; height: number; data: Uint8ClampedArray } {
  const size = 32;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.beginPath();
  g.moveTo(16, 2);
  g.lineTo(28, 28);
  g.lineTo(16, 21);
  g.lineTo(4, 28);
  g.closePath();
  g.fill();
  return { width: size, height: size, data: g.getImageData(0, 0, size, size).data };
}

type Coord = [number, number];
function bboxOf(features: GeoJSON.Feature[]): [Coord, Coord] | null {
  let minX = 180, minY = 90, maxX = -180, maxY = -90;
  const visit = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') {
      const [x, y] = c as Coord;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    } else if (Array.isArray(c)) c.forEach(visit);
  };
  for (const f of features) visit((f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon).coordinates);
  return minX <= maxX ? [[minX, minY], [maxX, maxY]] : null;
}

function nearestCameras(cams: Camera[], lat: number, lon: number, maxKm: number, n = 2) {
  return cams
    .map((c) => ({ c, d: distanceKm(lat, lon, c.lat, c.lon) }))
    .filter((x) => x.d <= maxKm)
    .sort((a, b) => a.d - b.d)
    .slice(0, n);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LiveMap({ outbreaks, mode = 'live', highlight, onCountryClick, aiEnabled = false, height = 640, overlay }: Props) {
  const live = mode === 'live';
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  // The map's click handler is registered once; read the latest callback.
  const onCountryClickRef = useRef(onCountryClick);
  onCountryClickRef.current = onCountryClick;
  const [ready, setReady] = useState(false);
  const [countries, setCountries] = useState<GeoJSON.FeatureCollection | null>(null);

  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [basemap, setBasemap] = useState<'map' | 'satellite'>('map');
  const [filterOpen, setFilterOpen] = useState(true);

  const [aircraft, setAircraft] = useState<AircraftData | null>(null);
  const [aircraftAt, setAircraftAt] = useState(0);
  const [emergencies, setEmergencies] = useState<EmergenciesData | null>(null);
  const [emergenciesAt, setEmergenciesAt] = useState(0);
  const [cameras, setCameras] = useState<Camera[]>([]);

  const [selection, setSelection] = useState<Selection>(null);
  const [follow, setFollow] = useState(false);
  const [detailOutbreak, setDetailOutbreak] = useState<Outbreak | null>(null);
  const [panelTab, setPanelTab] = useState<'emergencies' | 'aircraft'>('emergencies');
  const [now, setNow] = useState(() => Date.now());

  // ── Country index and severity per country ──
  const countryIdx = useMemo(
    () => (countries ? buildCountryIndex(countries.features as Array<{ properties: Record<string, string> }>) : new Map<string, string>()),
    [countries]
  );

  const severityByCode = useMemo(() => {
    const out = new Map<string, SeverityLevel>();
    if (mode === 'disease') {
      for (const [country, sev] of Object.entries(highlight ?? {})) {
        const code = countryCode(countryIdx, country);
        if (code) out.set(code, sev);
      }
      return out;
    }
    for (const o of outbreaks) {
      const code = countryCode(countryIdx, o.country, o.disease);
      if (!code) continue;
      const sev = normalizeSeverity(o.severity);
      const prev = out.get(code);
      if (!prev || severityRank(sev) < severityRank(prev)) out.set(code, sev);
    }
    return out;
  }, [mode, highlight, outbreaks, countryIdx]);

  // ── Data loading ──
  useEffect(() => {
    fetch(COUNTRIES_URL).then((r) => r.json()).then(setCountries).catch(() => setCountries(null));
  }, []);

  const loadAircraft = useCallback(async () => {
    try {
      const r = await fetch('/api/live/aircraft');
      if (!r.ok) return;
      setAircraft(await r.json());
      setAircraftAt(Date.now());
    } catch { /* keep last */ }
  }, []);
  const loadEmergencies = useCallback(async () => {
    try {
      const r = await fetch('/api/live/emergencies');
      if (!r.ok) return;
      setEmergencies(await r.json());
      setEmergenciesAt(Date.now());
    } catch { /* keep last */ }
  }, []);

  useEffect(() => {
    if (!live) return;
    loadAircraft();
    loadEmergencies();
    fetch('/api/live/cameras').then((r) => r.json()).then((d) => setCameras(d.cameras ?? [])).catch(() => {});
    const a = setInterval(() => document.visibilityState === 'visible' && loadAircraft(), AIRCRAFT_REFRESH_MS);
    const e = setInterval(() => document.visibilityState === 'visible' && loadEmergencies(), EMERGENCY_REFRESH_MS);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(a); clearInterval(e); clearInterval(t); };
  }, [live, loadAircraft, loadEmergencies]);

  // ── Map initialisation ──
  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      if (cancelled || !containerRef.current) return;
      map = new maplibregl.Map({
        container: containerRef.current,
        style: BASEMAP_STYLE,
        center: [15, 18],
        zoom: 1.3,
        maxZoom: 19,
        cooperativeGestures: true,
        attributionControl: {
          compact: true,
          customAttribution: live
            ? ['Aircraft: <a href="https://adsb.lol" target="_blank" rel="noopener">adsb.lol</a> (ODbL)', 'Disasters: GDACS', 'Imagery: Esri, Maxar, Earthstar Geographics']
            : [],
        },
      });
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
      // The layer panel starts collapsed where it would cover most of the map.
      if (containerRef.current.clientWidth < 760) setFilterOpen(false);
      map.on('style.load', () => {
        map!.setProjection({ type: 'globe' });
        // English labels where the tiles have them; the style otherwise shows
        // local scripts first (КАЗАХСТАН, ශ්‍රී ලංකාව).
        for (const l of map!.getStyle().layers) {
          if (l.type === 'symbol' && map!.getLayoutProperty(l.id, 'text-field')) {
            map!.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']]);
          }
        }
        const firstSymbol = map!.getStyle().layers.find((l) => l.type === 'symbol')?.id;

        map!.addSource('satellite', { type: 'raster', tiles: [SATELLITE_TILES], tileSize: 256, maxzoom: 19 });
        map!.addLayer({ id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } }, map!.getLayer('waterway') ? 'waterway' : firstSymbol);

        map!.addSource('countries', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'ADM0_A3' });
        map!.addLayer({
          id: 'countries-fill', type: 'fill', source: 'countries',
          paint: {
            'fill-color': ['match', ['get', 'sev'],
              'CRITICAL', SEVERITY_FILL.CRITICAL, 'HIGH', SEVERITY_FILL.HIGH, 'MEDIUM', SEVERITY_FILL.MEDIUM, 'LOW', SEVERITY_FILL.LOW, 'rgba(0,0,0,0)'],
            // Shading fades out as you zoom in, so streets stay readable.
            'fill-opacity': ['interpolate', ['linear'], ['zoom'], 1, 0.8, 4, 0.5, 6.5, 0.12, 8, 0],
          },
        }, firstSymbol);
        map!.addLayer({
          id: 'countries-line', type: 'line', source: 'countries',
          paint: {
            'line-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#f5f4f0', '#383835'],
            'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2, 0.6],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 1, 8, 0],
          },
        }, firstSymbol);

        // Hospitals from the basemap's own points of interest.
        if (map!.getSource('openmaptiles')) {
          map!.addLayer({
            id: 'hospital-dot', type: 'circle', source: 'openmaptiles', 'source-layer': 'poi', minzoom: 11,
            filter: ['==', ['get', 'class'], 'hospital'],
            paint: { 'circle-radius': 5, 'circle-color': '#c93545', 'circle-stroke-color': '#f5f4f0', 'circle-stroke-width': 1.5 },
          });
          map!.addLayer({
            id: 'hospital-label', type: 'symbol', source: 'openmaptiles', 'source-layer': 'poi', minzoom: 12,
            filter: ['==', ['get', 'class'], 'hospital'],
            layout: {
              'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']],
              'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-offset': [0, 1.1], 'text-anchor': 'top',
            },
            paint: { 'text-color': '#f5f4f0', 'text-halo-color': '#0d0d0d', 'text-halo-width': 1.2 },
          });
        }

        if (live) {
          map!.addImage('arrow', arrowImage(), { sdf: true });
          map!.addSource('cameras', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
          map!.addLayer({
            id: 'cameras', type: 'circle', source: 'cameras', minzoom: 9,
            paint: { 'circle-radius': 4, 'circle-color': '#0d0d0d', 'circle-stroke-color': COLOR.camera, 'circle-stroke-width': 1.5 },
          });
          map!.addSource('emergencies', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
          map!.addLayer({
            id: 'em-disaster', type: 'circle', source: 'emergencies', filter: ['==', ['get', 'kind'], 'disaster'],
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 6, 6, 11],
              'circle-color': 'rgba(0,0,0,0)',
              'circle-stroke-color': ['match', ['get', 'level'], 'red', GDACS_COLOR.red, 'orange', GDACS_COLOR.orange, GDACS_COLOR.green],
              'circle-stroke-width': 2.5,
            },
          });
          map!.addLayer({
            id: 'em-calls', type: 'circle', source: 'emergencies',
            filter: ['in', ['get', 'kind'], ['literal', ['medical-call', 'traffic-collision', 'rescue', 'fire']]],
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 2.5, 10, 5, 16, 8],
              'circle-color': ['match', ['get', 'kind'], 'medical-call', COLOR.medicalCall, 'traffic-collision', COLOR.collision, COLOR.rescueFire],
              'circle-stroke-color': '#0d0d0d', 'circle-stroke-width': 1,
            },
          });
          map!.addLayer({
            id: 'em-aircraft', type: 'symbol', source: 'emergencies', filter: ['==', ['get', 'kind'], 'aircraft-emergency'],
            layout: { 'icon-image': 'arrow', 'icon-size': 0.7, 'icon-allow-overlap': true },
            paint: { 'icon-color': COLOR.aircraftEmergency, 'icon-halo-color': '#0d0d0d', 'icon-halo-width': 1.5 },
          });
          map!.addSource('aircraft', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
          map!.addLayer({
            id: 'aircraft-selected', type: 'circle', source: 'aircraft', filter: ['==', ['get', 'selected'], true],
            paint: { 'circle-radius': 16, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#f5f4f0', 'circle-stroke-width': 1.5 },
          });
          map!.addLayer({
            id: 'aircraft', type: 'symbol', source: 'aircraft',
            layout: {
              'icon-image': 'arrow', 'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.45, 10, 0.75],
              'icon-rotate': ['get', 'track'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true,
              'text-field': ['step', ['zoom'], '', 6, ['get', 'label']],
              'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-offset': [0, 1.4], 'text-anchor': 'top', 'text-optional': true,
            },
            paint: {
              'icon-color': ['match', ['get', 'role'], 'sar', COLOR.sar, COLOR.hems],
              'icon-halo-color': '#0d0d0d', 'icon-halo-width': 1.5,
              'text-color': '#f5f4f0', 'text-halo-color': '#0d0d0d', 'text-halo-width': 1.2,
            },
          });
        }
        setReady(true);
      });

      const clickable = ['aircraft', 'em-aircraft', 'em-calls', 'em-disaster', 'cameras', 'countries-fill'];
      map.on('click', (e) => {
        const present = clickable.filter((l) => map!.getLayer(l));
        const feats = map!.queryRenderedFeatures(e.point, { layers: present });
        const f = feats[0] as MapGeoJSONFeature | undefined;
        if (!f) return;
        const lid = f.layer.id;
        if (lid === 'aircraft') { setSelection({ kind: 'aircraft', hex: String(f.properties.hex) }); setFollow(false); }
        else if (lid.startsWith('em-')) setSelection({ kind: 'emergency', id: String(f.properties.id) });
        else if (lid === 'cameras') setSelection({ kind: 'camera', id: String(f.properties.id) });
        else if (lid === 'countries-fill') {
          const name = String(f.properties.ADMIN ?? '');
          if (mode === 'disease') { onCountryClickRef.current?.(name); return; }
          setSelection({ kind: 'country', name, iso3: String(f.properties.ADM0_A3 ?? '') });
        }
      });
      for (const l of clickable) {
        map.on('mouseenter', l, () => { map!.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', l, () => { map!.getCanvas().style.cursor = ''; });
      }
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, mode]);

  // ── Countries source ──
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !countries) return;
    const features = countries.features.map((f) => {
      const code = (f.properties as { ADM0_A3?: string }).ADM0_A3 ?? '';
      return { ...f, properties: { ...f.properties, sev: severityByCode.get(code) ?? 'NONE' } };
    });
    (map.getSource('countries') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
    if (mode === 'disease') {
      const hit = features.filter((f) => f.properties.sev !== 'NONE');
      const bb = bboxOf(hit);
      if (bb) map.fitBounds(bb, { padding: 60, maxZoom: 4.5, duration: 800 });
      else map.easeTo({ center: [15, 18], zoom: 1.3, duration: 800 });
    }
  }, [ready, countries, severityByCode, mode]);

  // ── Layer visibility and basemap ──
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const vis = (id: string, on: boolean) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    vis('countries-fill', layers.outbreaks || mode === 'disease');
    vis('countries-line', layers.outbreaks || mode === 'disease');
    vis('hospital-dot', layers.hospitals);
    vis('hospital-label', layers.hospitals);
    vis('cameras', layers.cameras);
    vis('satellite', basemap === 'satellite');
    vis('building', basemap === 'map');
  }, [ready, layers, basemap, mode]);

  // ── Emergencies and cameras sources ──
  const visibleEmergencies = useMemo(
    () => (emergencies?.emergencies ?? []).filter((e) => layers[EMERGENCY_LAYER[e.kind]]),
    [emergencies, layers]
  );
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !live) return;
    (map.getSource('emergencies') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: visibleEmergencies.map((e) => ({
        type: 'Feature', geometry: { type: 'Point', coordinates: [e.lon, e.lat] },
        properties: { id: e.id, kind: e.kind, level: e.level ?? '' },
      })),
    });
  }, [ready, live, visibleEmergencies]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !live) return;
    (map.getSource('cameras') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: cameras.map((c) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lon, c.lat] }, properties: { id: c.id } })),
    });
  }, [ready, live, cameras]);

  // ── Aircraft: positions extrapolated between reports ──
  const aircraftNow = useMemo(() => {
    const elapsed = aircraftAt ? (now - aircraftAt) / 1000 : 0;
    return (aircraft?.aircraft ?? [])
      .filter((a) => (a.role === 'sar' ? layers.sar : layers.hems))
      .map((a) => {
        const age = a.seenPosSec + elapsed;
        const moving = a.altitudeFt != null && (a.groundSpeedKt ?? 0) > 30 && a.trackDeg != null;
        const [lat, lon] = moving ? project(a.lat, a.lon, a.trackDeg!, a.groundSpeedKt!, Math.min(age, MAX_EXTRAPOLATE_S)) : [a.lat, a.lon];
        return { ...a, lat, lon, ageSec: age, extrapolated: moving && age > 2 };
      });
  }, [aircraft, aircraftAt, now, layers.hems, layers.sar]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !live) return;
    const selHex = selection?.kind === 'aircraft' ? selection.hex : null;
    (map.getSource('aircraft') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: aircraftNow.map((a) => ({
        type: 'Feature', geometry: { type: 'Point', coordinates: [a.lon, a.lat] },
        properties: { hex: a.hex, role: a.role, track: a.trackDeg ?? 0, label: a.callsign ?? a.registration ?? '', selected: a.hex === selHex },
      })),
    });
    // Re-centre on the followed aircraft, but never while the map is still
    // moving: easeTo cancels an in-progress flyTo, which left the view stuck
    // part-way through the zoom.
    if (follow && selHex && !map.isMoving()) {
      const a = aircraftNow.find((x) => x.hex === selHex);
      if (a) map.easeTo({ center: [a.lon, a.lat], duration: 900 });
    }
  }, [ready, live, aircraftNow, selection, follow]);

  // ── Selected country outline ──
  const selectedIso = selection?.kind === 'country' ? selection.iso3 : null;
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !selectedIso) return;
    map.setFeatureState({ source: 'countries', id: selectedIso }, { selected: true });
    return () => { if (map.getSource('countries')) map.setFeatureState({ source: 'countries', id: selectedIso }, { selected: false }); };
  }, [ready, selectedIso]);

  // ── Actions ──
  const flyTo = (lat: number, lon: number, zoom: number) =>
    mapRef.current?.flyTo({ center: [lon, lat], zoom, speed: 1.4, curve: 1.5, essential: true });

  const selectEmergency = (e: Emergency) => { setSelection({ kind: 'emergency', id: e.id }); setFollow(false); flyTo(e.lat, e.lon, e.zoom); };
  const selectAircraft = (a: { hex: string; lat: number; lon: number }) => { setSelection({ kind: 'aircraft', hex: a.hex }); setFollow(true); flyTo(a.lat, a.lon, 12); };
  const resetView = () => { setSelection(null); setFollow(false); mapRef.current?.flyTo({ center: [15, 18], zoom: 1.3, pitch: 0, bearing: 0, essential: true }); };

  // ── Derived selection objects ──
  const selAircraft = selection?.kind === 'aircraft' ? aircraftNow.find((a) => a.hex === selection.hex) ?? null : null;
  const selEmergency = selection?.kind === 'emergency' ? emergencies?.emergencies.find((e) => e.id === selection.id) ?? null : null;
  const selCamera = selection?.kind === 'camera' ? cameras.find((c) => c.id === selection.id) ?? null : null;

  const countryOutbreaks = useMemo(() => {
    if (selection?.kind !== 'country') return [];
    return outbreaks.filter((o) => countryCode(countryIdx, o.country, o.disease) === selection.iso3);
  }, [selection, outbreaks, countryIdx]);
  const countryThreat = countryOutbreaks.reduce<SeverityLevel | null>((m, o) => {
    const s = normalizeSeverity(o.severity);
    return !m || severityRank(s) < severityRank(m) ? s : m;
  }, null);

  const counts: Partial<Record<LayerKey, number>> = {
    hems: aircraft?.aircraft.filter((a) => a.role !== 'sar').length ?? 0,
    sar: aircraft?.aircraft.filter((a) => a.role === 'sar').length ?? 0,
    cameras: cameras.length,
  };
  for (const e of emergencies?.emergencies ?? []) counts[EMERGENCY_LAYER[e.kind]] = (counts[EMERGENCY_LAYER[e.kind]] ?? 0) + 1;

  // Nearest cameras for a street-level incident (not for disasters or aircraft).
  const nearCams = selEmergency && selEmergency.kind !== 'disaster' && selEmergency.kind !== 'aircraft-emergency'
    ? nearestCameras(cameras, selEmergency.lat, selEmergency.lon, 1.5)
    : [];
  const camTick = Math.floor(now / 60_000); // refresh still images each minute

  return (
    <div className={live ? 'lm lm-live' : 'lm'}>
      <div className="lm-canvas" style={{ height }}>
        <div ref={containerRef} className="lm-map" />
        {!ready && <div className="lm-loading">Loading map…</div>}
        {overlay}

        {live && (
          <div className={`lm-filter ${filterOpen ? 'is-open' : ''}`}>
            <button type="button" className="lm-filter-toggle" onClick={() => setFilterOpen((o) => !o)} aria-expanded={filterOpen}>
              Layers {filterOpen ? '–' : '+'}
            </button>
            {filterOpen && (
              <div className="lm-filter-body">
                {['Aircraft (live ADS-B)', 'Emergencies', 'Context'].map((group) => (
                  <fieldset key={group}>
                    <legend>{group}</legend>
                    {LAYER_DEFS.filter((d) => d.group === group).map((d) => (
                      <label key={d.key} className="lm-check">
                        <input type="checkbox" checked={layers[d.key]} onChange={(e) => setLayers((l) => ({ ...l, [d.key]: e.target.checked }))} />
                        <span className={`lm-key lm-key-${d.shape}`} style={{ ['--k' as string]: d.color }} aria-hidden="true" />
                        <span className="lm-check-label">{d.label}</span>
                        {counts[d.key] != null && <span className="lm-count">{counts[d.key]}</span>}
                      </label>
                    ))}
                  </fieldset>
                ))}
                <div className="lm-basemap" role="group" aria-label="Base map">
                  {(['map', 'satellite'] as const).map((b) => (
                    <button key={b} type="button" className="chip" aria-pressed={basemap === b} onClick={() => setBasemap(b)}>
                      {b === 'map' ? 'Map' : 'Satellite'}
                    </button>
                  ))}
                </div>
                {layers.outbreaks && (
                  <details className="lm-sev">
                    <summary>Country shading</summary>
                    {SEVERITY_ORDER.map((lvl) => (
                      <div key={lvl} className="lm-sev-row">
                        <span className="sev" style={{ ['--sev-color' as string]: SEVERITY_FILL[lvl] }}>{SEVERITY_LABEL[lvl]}</span>
                        <span className="muted">{SEVERITY_RULE[lvl]}</span>
                      </div>
                    ))}
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        {mode === 'disease' && (
          <div className="lm-legend-inline" aria-label="Highest severity recorded for this disease">
            {SEVERITY_ORDER.map((lvl) => (
              <span key={lvl} className="sev" style={{ ['--sev-color' as string]: SEVERITY_FILL[lvl] }}>{SEVERITY_LABEL[lvl]}</span>
            ))}
          </div>
        )}

        {live && (
          <button type="button" className="btn lm-reset" onClick={resetView}>Reset view</button>
        )}

        {/* ── Selection cards ── */}
        {selection?.kind === 'country' && (
          <CountryTooltip
            countryName={selection.name}
            iso3={selection.iso3}
            threatLevel={countryThreat}
            outbreaks={countryOutbreaks.map((o) => ({ disease: o.disease, severity: o.severity, cases: o.cases, deaths: o.deaths }))}
            onClose={() => setSelection(null)}
            onViewFull={() => countryOutbreaks[0] && setDetailOutbreak(countryOutbreaks[0])}
          />
        )}

        {selAircraft && (
          <div className="ct lm-card" role="dialog" aria-label="Aircraft">
            <div className="ct-head">
              <div>
                <div className="ct-name">{selAircraft.callsign ?? selAircraft.registration ?? selAircraft.hex}</div>
                <div className="ct-sub">
                  <span className="lm-key lm-key-arrow" style={{ ['--k' as string]: selAircraft.role === 'sar' ? COLOR.sar : COLOR.hems }} aria-hidden="true" />
                  {ROLE_LABEL[selAircraft.role]}
                </div>
              </div>
              <button type="button" className="ct-close" onClick={() => { setSelection(null); setFollow(false); }} aria-label="Close">×</button>
            </div>
            <div className="ct-body">
              <dl className="drawer-facts" style={{ fontSize: 12.5 }}>
                {selAircraft.operator && (<><dt>Operator</dt><dd>{selAircraft.operator}</dd></>)}
                <dt>Aircraft</dt><dd>{[selAircraft.type, selAircraft.registration].filter(Boolean).join(' · ') || '–'}</dd>
                <dt>Altitude</dt><dd>{selAircraft.altitudeFt != null ? `${selAircraft.altitudeFt.toLocaleString('en-GB')} ft` : 'On the ground'}</dd>
                <dt>Speed</dt><dd>{selAircraft.groundSpeedKt != null ? `${Math.round(selAircraft.groundSpeedKt)} kt (${Math.round(selAircraft.groundSpeedKt * 1.852)} km/h)` : '–'}</dd>
                <dt>Heading</dt><dd>{selAircraft.trackDeg != null ? `${Math.round(selAircraft.trackDeg)}°` : '–'}</dd>
                <dt>Position</dt><dd>{selAircraft.lat.toFixed(4)}, {selAircraft.lon.toFixed(4)}</dd>
              </dl>
              <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
                Last report {ago(selAircraft.ageSec * 1000)}
                {selAircraft.extrapolated && ' — position since then estimated from speed and heading'}.
                {' '}{BASIS_LABEL[selAircraft.basis]}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn" aria-pressed={follow} onClick={() => setFollow((f) => !f)}>
                  {follow ? 'Following' : 'Follow'}
                </button>
                <button type="button" className="btn" onClick={() => flyTo(selAircraft.lat, selAircraft.lon, 15)}>Street level</button>
                <a className="btn" href={`https://adsb.lol/?icao=${selAircraft.hex}`} target="_blank" rel="noopener noreferrer">Flight track</a>
              </div>
            </div>
          </div>
        )}

        {selEmergency && (
          <div className="ct lm-card" role="dialog" aria-label={selEmergency.title}>
            <div className="ct-head">
              <div style={{ minWidth: 0 }}>
                <div className="ct-name">{selEmergency.title}</div>
                <div className="ct-sub">{selEmergency.source}{selEmergency.time && ` · ${ago(now - new Date(selEmergency.time).getTime())}`}</div>
              </div>
              <button type="button" className="ct-close" onClick={() => setSelection(null)} aria-label="Close">×</button>
            </div>
            <div className="ct-body">
              {selEmergency.detail && <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>{selEmergency.detail}</p>}
              {selEmergency.level && (
                <p style={{ fontSize: 12.5 }}>
                  GDACS alert level: <span className="sev" style={{ ['--sev-color' as string]: GDACS_COLOR[selEmergency.level] }}>
                    {selEmergency.level[0].toUpperCase() + selEmergency.level.slice(1)}
                  </span>
                </p>
              )}
              {nearCams.length > 0 && (
                <section>
                  <h3 className="ct-h">Nearest traffic camera{nearCams.length > 1 ? 's' : ''}</h3>
                  {nearCams.map(({ c, d }) => (
                    <figure key={c.id} className="lm-cam">
                      {c.videoUrl ? (
                        <video src={c.videoUrl} poster={c.imageUrl} autoPlay muted loop playsInline />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`${c.imageUrl}?t=${camTick}`} alt={`Traffic camera: ${c.name}`} loading="lazy" />
                      )}
                      <figcaption className="muted">{c.name} · {d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`} away · {c.source}</figcaption>
                    </figure>
                  ))}
                  <p className="muted" style={{ fontSize: 11 }}>Public traffic camera near the address. It shows the street, not necessarily the incident.</p>
                </section>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn" onClick={() => flyTo(selEmergency.lat, selEmergency.lon, Math.max(selEmergency.zoom, 16))}>Street level</button>
                <button type="button" className="btn" onClick={() => setBasemap(basemap === 'map' ? 'satellite' : 'map')}>
                  {basemap === 'map' ? 'Satellite view' : 'Map view'}
                </button>
                {selEmergency.url && <a className="btn" href={selEmergency.url} target="_blank" rel="noopener noreferrer">Source</a>}
              </div>
            </div>
          </div>
        )}

        {selCamera && (
          <div className="ct lm-card" role="dialog" aria-label={selCamera.name}>
            <div className="ct-head">
              <div><div className="ct-name">{selCamera.name}</div><div className="ct-sub">Traffic camera · {selCamera.source}</div></div>
              <button type="button" className="ct-close" onClick={() => setSelection(null)} aria-label="Close">×</button>
            </div>
            <div className="ct-body">
              <figure className="lm-cam">
                {selCamera.videoUrl ? (
                  <video src={selCamera.videoUrl} poster={selCamera.imageUrl} autoPlay muted loop playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${selCamera.imageUrl}?t=${camTick}`} alt={`Traffic camera: ${selCamera.name}`} />
                )}
              </figure>
              <p className="muted" style={{ fontSize: 11 }}>{selCamera.videoUrl ? 'Short clip, refreshed every few minutes by TfL.' : 'Still image, refreshed every minute.'}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Live list ── */}
      {live && (
        <aside className="lm-panel" aria-label="Live emergencies">
          <div className="lm-panel-head">
            <h2 className="panel-title">Live now</h2>
            <div className="ob-seg" role="group" aria-label="List">
              <button type="button" className="chip" aria-pressed={panelTab === 'emergencies'} onClick={() => setPanelTab('emergencies')}>
                Emergencies {visibleEmergencies.length}
              </button>
              <button type="button" className="chip" aria-pressed={panelTab === 'aircraft'} onClick={() => setPanelTab('aircraft')}>
                Aircraft {aircraftNow.length}
              </button>
            </div>
            <div className="muted" style={{ fontSize: 11.5 }}>
              {panelTab === 'aircraft'
                ? aircraft ? `Positions updated ${ago(now - aircraftAt)} · every 30 s` : 'Loading aircraft…'
                : emergencies ? `Updated ${ago(now - emergenciesAt)} · every 2 min` : 'Loading emergencies…'}
            </div>
          </div>
          <ol className="lm-list">
            {panelTab === 'emergencies' && visibleEmergencies.map((e) => (
              <li key={e.id}>
                <button type="button" className={selection?.kind === 'emergency' && selection.id === e.id ? 'is-active' : ''} onClick={() => selectEmergency(e)}>
                  <span
                    className={`lm-key ${e.kind === 'disaster' ? 'lm-key-ring' : e.kind === 'aircraft-emergency' ? 'lm-key-arrow' : 'lm-key-dot'}`}
                    style={{ ['--k' as string]: e.kind === 'disaster' ? GDACS_COLOR[e.level ?? 'green'] : e.kind === 'medical-call' ? COLOR.medicalCall : e.kind === 'traffic-collision' ? COLOR.collision : e.kind === 'aircraft-emergency' ? COLOR.aircraftEmergency : COLOR.rescueFire }}
                    aria-hidden="true"
                  />
                  <span className="lm-item">
                    <span className="lm-item-title">{e.title}</span>
                    <span className="lm-item-meta">{[e.detail, e.time && ago(now - new Date(e.time).getTime())].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              </li>
            ))}
            {panelTab === 'aircraft' && [...aircraftNow].sort((a, b) => (a.callsign ?? a.hex).localeCompare(b.callsign ?? b.hex)).map((a) => (
              <li key={a.hex}>
                <button type="button" className={selection?.kind === 'aircraft' && selection.hex === a.hex ? 'is-active' : ''} onClick={() => selectAircraft(a)}>
                  <span className="lm-key lm-key-arrow" style={{ ['--k' as string]: a.role === 'sar' ? COLOR.sar : COLOR.hems }} aria-hidden="true" />
                  <span className="lm-item">
                    <span className="lm-item-title">{a.callsign ?? a.registration ?? a.hex}</span>
                    <span className="lm-item-meta">
                      {[a.operator, a.altitudeFt != null ? `${a.altitudeFt.toLocaleString('en-GB')} ft` : 'on ground', a.groundSpeedKt != null ? `${Math.round(a.groundSpeedKt)} kt` : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {panelTab === 'emergencies' && emergencies && visibleEmergencies.length === 0 && <li className="muted lm-empty">Nothing in the selected layers.</li>}
            {panelTab === 'aircraft' && aircraft && aircraftNow.length === 0 && <li className="muted lm-empty">No identified emergency aircraft airborne in the selected layers.</li>}
          </ol>
          <p className="lm-panel-foot">
            Aircraft are those identified as air ambulance or rescue from registry or callsign; coverage follows volunteer
            ADS-B receivers. Street-level 911 data is published openly only by a few cities; Seattle is included.
          </p>
        </aside>
      )}

      {live && (
        <OutbreakDetailPanel outbreak={detailOutbreak} onClose={() => setDetailOutbreak(null)} aiEnabled={aiEnabled} />
      )}
    </div>
  );
}
