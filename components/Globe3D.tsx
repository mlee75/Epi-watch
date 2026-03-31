'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Outbreak } from '@/lib/types';
import { CountryTooltip } from './CountryTooltip';

// Country polygon fill colors by threat level
const POLY_COLOR: Record<string, string> = {
  CRITICAL: 'rgba(220,38,38,0.85)',
  HIGH:     'rgba(234,88,12,0.75)',
  MEDIUM:   'rgba(202,138,4,0.65)',
  LOW:      'rgba(22,163,74,0.55)',
};
const POLY_NONE    = 'rgba(71,85,105,0.5)';   // Neutral slate gray — all countries visible
const POLY_HOVER   = 'rgba(148,163,184,0.55)'; // Light slate on hover

const BORDER_COLOR: Record<string, string> = {
  CRITICAL: 'rgba(220,38,38,0.6)',
  HIGH:     'rgba(234,88,12,0.5)',
  MEDIUM:   'rgba(202,138,4,0.4)',
  LOW:      'rgba(22,163,74,0.35)',
};
const BORDER_NONE  = 'rgba(71,85,105,0.35)';
const BORDER_HOVER = 'rgba(255,255,255,0.9)';

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

  // Responsive sizing — adapts to container height
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setDims({ w: entry.contentRect.width, h: entry.contentRect.height || 640 });
    });
    ro.observe(containerRef.current);
    setDims({ w: containerRef.current.clientWidth, h: containerRef.current.clientHeight || 640 });
    return () => ro.disconnect();
  }, []);

  const onGlobeReady = useCallback(() => {
    if (!globeRef.current) return;
    const ctrl = globeRef.current.controls();
    ctrl.autoRotate      = true;
    ctrl.autoRotateSpeed = 0.35;
    ctrl.enableDamping   = true;
    ctrl.dampingFactor   = 0.08;
    globeRef.current.pointOfView({ lat: 20, lng: 10, altitude: 2.2 }, 0);
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

  const criticalCount = outbreaks.filter((o) => o.severity === 'CRITICAL').length;

  const loader = (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: 400, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 40, height: 40, border: '2px solid #dc2626', borderTopColor: 'transparent',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
        }} />
        <p style={{ color: '#94a3b8', fontSize: 12, fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.1em' }}>
          INITIALIZING GLOBE…
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!GlobeComp) return loader;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', overflow: 'hidden', background: '#000', height: '100%', minHeight: 400 }}
    >
      <GlobeComp
        ref={globeRef}
        width={dims.w}
        height={dims.h}

        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        backgroundColor="rgba(0,0,0,1)"
        atmosphereColor="#1a3a6a"
        atmosphereAltitude={0.18}

        // ── Country Polygons (sole visualization layer) ───────────────────
        polygonsData={countries}
        polygonCapColor={(feat: GeoFeature) => {
          const isHovered = hoveredCountry?.properties?.ADMIN === feat.properties?.ADMIN;
          if (isHovered) return POLY_HOVER;
          const threat = getCountryThreat(feat);
          return threat ? POLY_COLOR[threat] : POLY_NONE;
        }}
        polygonSideColor={() => 'rgba(0,0,0,0)'}
        polygonStrokeColor={(feat: GeoFeature) => {
          const isHovered = hoveredCountry?.properties?.ADMIN === feat.properties?.ADMIN;
          if (isHovered) return BORDER_HOVER;
          const threat = getCountryThreat(feat);
          return threat ? (BORDER_COLOR[threat] ?? BORDER_NONE) : BORDER_NONE;
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

      {/* Legend — bottom left */}
      <div style={{
        position: 'absolute', bottom: 20, left: 16, zIndex: 10,
        background: 'rgba(10,14,39,0.92)', backdropFilter: 'blur(8px)',
        border: '1px solid #1e2749', borderRadius: 10, padding: '10px 14px',
      }}>
        <div style={{
          fontSize: 9, color: '#6b7280', fontFamily: 'var(--font-mono, monospace)',
          fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8,
        }}>
          Threat Level
        </div>
        {([
          ['CRITICAL',    '#dc2626', '>10K cases' ],
          ['HIGH',        '#ea580c', '>1K cases'  ],
          ['MEDIUM',      '#ca8a04', '>100 cases' ],
          ['LOW',         '#16a34a', '<100 cases' ],
          ['No Outbreaks','#475569', ''           ],
        ] as const).map(([label, color, hint]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{
              display: 'inline-block', width: 14, height: 10, borderRadius: 2,
              background: color, flexShrink: 0,
            }} />
            <span style={{ fontSize: 10, color: '#a0a8c8', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600, minWidth: 80 }}>
              {label}
            </span>
            {hint && <span style={{ fontSize: 10, color: '#6b7280' }}>{hint}</span>}
          </div>
        ))}
      </div>

      {/* Stats badge — top right */}
      {!activeCountry && (
        <div style={{
          position: 'absolute', top: 16, right: 16, zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
        }}>
          <div style={{
            background: 'rgba(10,14,39,0.92)', backdropFilter: 'blur(8px)',
            border: '1px solid #1e2749', borderRadius: 8, padding: '6px 12px',
          }}>
            <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'var(--font-mono, monospace)' }}>
              <span style={{ color: '#ffffff', fontWeight: 700, fontSize: 14 }}>{outbreaks.length}</span> active outbreaks
            </span>
          </div>
          {criticalCount > 0 && (
            <div style={{
              background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.35)',
              borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8 }}>
                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#dc2626', opacity: 0.75, animation: 'ping 1s infinite' }} />
                <span style={{ position: 'relative', width: 8, height: 8, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
              </span>
              <span style={{ fontSize: 11, color: '#dc2626', fontFamily: 'var(--font-mono, monospace)', fontWeight: 700 }}>
                {criticalCount} CRITICAL
              </span>
            </div>
          )}
        </div>
      )}

      {/* Drag hint */}
      <div style={{
        position: 'absolute', bottom: 20, right: 16, zIndex: 10,
        fontSize: 10, color: '#6b7280', fontFamily: 'var(--font-mono, monospace)',
        pointerEvents: 'none',
      }}>
        {hoveredCountry ? 'click for details' : 'drag to rotate · scroll to zoom'}
      </div>

      <style>{`
        @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
      `}</style>
    </div>
  );
}
