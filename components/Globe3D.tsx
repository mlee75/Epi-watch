'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MeshPhongMaterial } from 'three';
import type { Outbreak } from '@/lib/types';
import {
  NO_RECORD_COLOR,
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  SEVERITY_ORDER,
  SEVERITY_RULE,
  severityColor,
  withAlpha,
} from '@/lib/severity';
import { CountryTooltip } from './CountryTooltip';

// Fills come from the shared scale in lib/severity.ts, so the globe, badges,
// tables and charts can never disagree about what a colour means. Near-opaque
// fills keep the validated colours true on screen; translucency over a
// textured globe previously shifted them.
const POLY_NONE    = NO_RECORD_COLOR;
const POLY_HOVER   = '#5a5a56';
const BORDER_NONE  = '#383835';
const BORDER_HOVER = '#f5f4f0';

const polyColor = (threat: string) => withAlpha(severityColor(threat), 0.92);

// A flat, unlit-looking globe: the photographic night-earth texture and star
// backdrop read as decoration and competed with the data layer.
const GLOBE_MATERIAL = new MeshPhongMaterial({ color: '#141413', shininess: 0 });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GeoFeature = { type: string; properties: Record<string, any>; geometry: object };

interface Props {
  outbreaks: Outbreak[];
  onSelect: (outbreak: Outbreak | null) => void;
}

export default function Globe3D({ outbreaks, onSelect }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [GlobeComp, setGlobeComp]           = useState<any>(null);
  const [dims, setDims]                     = useState({ w: 800, h: 640 });
  const [countries, setCountries]           = useState<GeoFeature[]>([]);
  const [countryMap, setCountryMap]         = useState<Record<string, string>>({});
  const [hoveredCountry, setHoveredCountry] = useState<GeoFeature | null>(null);
  const [stickyCountry, setStickyCountry]   = useState<GeoFeature | null>(null);
  const [pinnedCountry, setPinnedCountry]   = useState<GeoFeature | null>(null);
  const tooltipHoveredRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef     = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load Globe component (client-only)
  useEffect(() => {
    import('react-globe.gl').then((m) => setGlobeComp(() => m.default));
  }, []);

  // Load Natural Earth 110m GeoJSON — has properties.ADMIN with country names
  useEffect(() => {
    fetch('https://vasturiano.github.io/react-globe.gl/example/datasets/ne_110m_admin_0_countries.geojson')
      .then((r) => r.json())
      .then((geo) => setCountries(geo.features ?? []))
      .catch(() => setCountries([]));
  }, []);

  // Load country → highest threat level map from DB
  useEffect(() => {
    fetch('/api/countries-map')
      .then((r) => r.json())
      .then((d) => setCountryMap(d.data ?? {}))
      .catch(() => setCountryMap({}));
  }, []);

  // Responsive sizing. Re-attaches when the globe finishes loading: the ref
  // first points at the loading placeholder, which is then replaced, so an
  // observer set up only once kept watching a detached node and later resizes
  // never reached the globe.
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setDims({ w: entry.contentRect.width, h: entry.contentRect.height || 640 });
    });
    ro.observe(containerRef.current);
    setDims({ w: containerRef.current.clientWidth, h: containerRef.current.clientHeight || 640 });
    return () => ro.disconnect();
  }, [GlobeComp]);

  const onGlobeReady = useCallback(() => {
    if (!globeRef.current) return;
    const ctrl = globeRef.current.controls();
    ctrl.autoRotate      = true;
    ctrl.autoRotateSpeed = 0.25;
    ctrl.enableDamping   = true;
    ctrl.dampingFactor   = 0.08;
    // The globe now sits mid-page, so wheel-zoom captured page scrolling: a
    // reader scrolling past the map got stuck zooming it. Zoom is on explicit
    // buttons instead, the usual pattern for an embedded map.
    ctrl.enableZoom      = false;
    globeRef.current.pointOfView({ lat: 20, lng: 10, altitude: 2.2 }, 0);
  }, []);

  const zoom = useCallback((factor: number) => {
    if (!globeRef.current) return;
    const pov = globeRef.current.pointOfView();
    const altitude = Math.min(3.5, Math.max(0.6, pov.altitude * factor));
    globeRef.current.pointOfView({ ...pov, altitude }, 300);
  }, []);

  // Resolve threat level for a GeoJSON feature by matching ADMIN name to DB country names
  const getCountryThreat = useCallback((feat: GeoFeature): string | null => {
    const name = feat.properties?.ADMIN ?? '';
    if (!name) return null;
    if (countryMap[name]) return countryMap[name];
    for (const [cname, threat] of Object.entries(countryMap)) {
      if (
        name.toLowerCase().includes(cname.toLowerCase()) ||
        cname.toLowerCase().includes(name.toLowerCase())
      ) return threat;
    }
    return null;
  }, [countryMap]);

  // Pinned > sticky > hovered for tooltip display
  const activeCountry = pinnedCountry || stickyCountry || hoveredCountry;
  const hoveredName = activeCountry?.properties?.ADMIN ?? '';
  // ADM0_A3 rather than ISO_A3: Natural Earth sets ISO_A3 to -99 for France,
  // Norway and a few others.
  const hoveredIso3: string = activeCountry?.properties?.ADM0_A3 ?? activeCountry?.properties?.ISO_A3 ?? '';
  const hoveredThreat = activeCountry ? getCountryThreat(activeCountry) : null;

  const hoveredOutbreaks = outbreaks
    .filter((o) => {
      if (!hoveredName) return false;
      return (
        o.country.toLowerCase().includes(hoveredName.toLowerCase()) ||
        hoveredName.toLowerCase().includes(o.country.toLowerCase())
      );
    })
    .map((o) => ({ disease: o.disease, severity: o.severity, cases: o.cases, deaths: o.deaths }));

  const loader = (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>Loading map…</p>
    </div>
  );

  if (!GlobeComp) return loader;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', overflow: 'hidden', height: '100%', minHeight: 400 }}
    >
      <GlobeComp
        ref={globeRef}
        width={dims.w}
        height={dims.h}

        globeMaterial={GLOBE_MATERIAL}
        backgroundColor="rgba(0,0,0,0)"
        showAtmosphere={false}

        // ── Country Polygons (sole visualization layer) ───────────────────
        polygonsData={countries}
        polygonCapColor={(feat: GeoFeature) => {
          const isHovered = hoveredCountry?.properties?.ADMIN === feat.properties?.ADMIN;
          if (isHovered) return POLY_HOVER;
          const threat = getCountryThreat(feat);
          return threat ? polyColor(threat) : POLY_NONE;
        }}
        polygonSideColor={() => 'rgba(0,0,0,0)'}
        polygonStrokeColor={(feat: GeoFeature) => {
          const isHovered = hoveredCountry?.properties?.ADMIN === feat.properties?.ADMIN;
          if (isHovered) return BORDER_HOVER;
          const threat = getCountryThreat(feat);
          return threat ? '#1a1a19' : BORDER_NONE;
        }}
        polygonAltitude={(feat: GeoFeature) => {
          const isHovered = hoveredCountry?.properties?.ADMIN === feat.properties?.ADMIN;
          if (isHovered) return 0.02;
          const threat = getCountryThreat(feat);
          if (threat === 'CRITICAL') return 0.01;
          if (threat) return 0.007;
          return 0.004;
        }}
        polygonsTransitionDuration={150}

        onPolygonHover={(feat: GeoFeature | null) => {
          setHoveredCountry(feat);
          // Don't override a pinned tooltip with hover
          if (pinnedCountry) return;
          if (feat) {
            setStickyCountry(feat);
          } else if (!tooltipHoveredRef.current) {
            setTimeout(() => {
              if (!tooltipHoveredRef.current && !pinnedCountry) setStickyCountry(null);
            }, 150);
          }
          if (globeRef.current) {
            globeRef.current.controls().autoRotate = !feat && !tooltipHoveredRef.current && !pinnedCountry;
          }
        }}

        onPolygonClick={(feat: GeoFeature | null) => {
          if (!feat) return;
          // Pin the tooltip on click so it stays static
          setPinnedCountry(feat);
          setStickyCountry(feat);
          tooltipHoveredRef.current = true;
          if (globeRef.current) {
            globeRef.current.controls().autoRotate = false;
          }
        }}

        onGlobeReady={onGlobeReady}
        enablePointerInteraction={true}
        animateIn={true}
      />

      {/* Country Tooltip Overlay */}
      {activeCountry && hoveredName && (
        <div
          onMouseEnter={() => { tooltipHoveredRef.current = true; }}
          onMouseLeave={() => {
            // Don't close if pinned
            if (pinnedCountry) return;
            tooltipHoveredRef.current = false;
            setStickyCountry(null);
            if (globeRef.current) globeRef.current.controls().autoRotate = true;
          }}
        >
          <CountryTooltip
            countryName={hoveredName}
            iso3={hoveredIso3}
            threatLevel={hoveredThreat}
            outbreaks={hoveredOutbreaks}
            onClose={() => {
              tooltipHoveredRef.current = false;
              setPinnedCountry(null);
              setStickyCountry(null);
              setHoveredCountry(null);
              if (globeRef.current) globeRef.current.controls().autoRotate = true;
            }}
            onViewFull={() => {
              const match = outbreaks.find(
                (o) =>
                  o.country.toLowerCase().includes(hoveredName.toLowerCase()) ||
                  hoveredName.toLowerCase().includes(o.country.toLowerCase())
              );
              if (match) {
                tooltipHoveredRef.current = false;
                setPinnedCountry(null);
                setStickyCountry(null);
                onSelect(match);
              }
            }}
          />
        </div>
      )}

      {/* Legend. Each level states its full rule — severity triggers on cases
          OR deaths, which the old case-only legend misdescribed. */}
      <div className="globe-legend">
        {SEVERITY_ORDER.map((lvl) => (
          <div key={lvl} className="globe-legend-row">
            <span className="sev" style={{ ['--sev-color' as string]: SEVERITY_COLOR[lvl] }}>
              {SEVERITY_LABEL[lvl]}
            </span>
            <span className="globe-legend-rule">{SEVERITY_RULE[lvl]}</span>
          </div>
        ))}
        <div className="globe-legend-row">
          <span className="sev" style={{ ['--sev-color' as string]: NO_RECORD_COLOR }}>No record</span>
        </div>
      </div>

      <div className="globe-zoom" role="group" aria-label="Map zoom">
        <button type="button" className="btn" onClick={() => zoom(0.75)} aria-label="Zoom in">+</button>
        <button type="button" className="btn" onClick={() => zoom(1.33)} aria-label="Zoom out">−</button>
      </div>

      <div className="globe-hint">
        {hoveredCountry ? 'Click a country for its records' : 'Drag to rotate'}
      </div>
    </div>
  );
}
