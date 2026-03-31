'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { Outbreak, Severity } from '@/lib/types';

// Must be imported in a client-only component
import 'leaflet/dist/leaflet.css';

interface MapProps {
  outbreaks: Outbreak[];
  onMarkerClick?: (outbreak: Outbreak) => void;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  CRITICAL: '#ef4444',
  HIGH:     '#f97316',
  MEDIUM:   '#eab308',
  LOW:      '#22c55e',
};

function getMarkerRadius(cases: number): number {
  if (cases === 0) return 6;
  // Logarithmic scale: 6–28px
  return Math.min(6 + Math.log10(cases + 1) * 6, 28);
}

export default function Map({ outbreaks, onMarkerClick }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  const initMap = useCallback(async () => {
    if (!containerRef.current || mapRef.current) return;

    const L = (await import('leaflet')).default;

    const map = L.map(containerRef.current, {
      center: [20, 10],
      zoom: 2,
      minZoom: 2,
      maxZoom: 10,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
    });

    // CartoDB Dark Matter — free, no API key
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }
    ).addTo(map);

    // Custom zoom control position
    map.zoomControl.setPosition('bottomright');

    mapRef.current = map;
    renderMarkers(L, map, outbreaks, onMarkerClick);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-render markers when outbreaks change
  const renderMarkers = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map: any,
    data: Outbreak[],
    onClick?: (o: Outbreak) => void
  ) => {
    // Clear existing markers
    map.eachLayer((layer: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((layer as any).options?.radius !== undefined) {
        map.removeLayer(layer);
      }
    });

    data.forEach((outbreak) => {
      if (outbreak.lat == null || outbreak.lng == null) return;

      const color = SEVERITY_COLORS[outbreak.severity as Severity] || '#22c55e';
      const radius = getMarkerRadius(outbreak.cases);

      // Outer pulse ring for critical outbreaks
      if (outbreak.severity === 'CRITICAL') {
        L.circleMarker([outbreak.lat, outbreak.lng], {
          radius: radius + 6,
          fillColor: color,
          color: color,
          weight: 1,
          opacity: 0.25,
          fillOpacity: 0.1,
          interactive: false,
        }).addTo(map);
      }

      const marker = L.circleMarker([outbreak.lat, outbreak.lng], {
        radius,
        fillColor: color,
        color: '#000',
        weight: 1.5,
        opacity: 0.9,
        fillOpacity: 0.75,
      });

      marker.bindPopup(
        `<div style="
          background: #111827;
          color: #f1f5f9;
          border: 1px solid #1e293b;
          border-radius: 8px;
          padding: 14px;
          min-width: 220px;
          font-family: system-ui, sans-serif;
        ">
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: ${color}22;
            border: 1px solid ${color}66;
            border-radius: 4px;
            padding: 2px 8px;
            font-size: 10px;
            font-weight: 700;
            color: ${color};
            letter-spacing: 2px;
            margin-bottom: 8px;
          ">
            <span style="width:6px;height:6px;border-radius:50%;background:${color};display:inline-block;"></span>
            ${outbreak.severity}
          </div>
          <h3 style="margin: 0 0 4px; font-size: 15px; font-weight: 700; color: #f8fafc;">
            ${outbreak.disease}
          </h3>
          <p style="margin: 0 0 10px; font-size: 12px; color: #94a3b8;">
            📍 ${outbreak.country}${outbreak.region !== 'OTHER' ? ' · ' + outbreak.region : ''}
          </p>
          <div style="display: flex; gap: 12px; margin-bottom: 10px;">
            <div>
              <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Cases</div>
              <div style="font-size: 16px; font-weight: 700; color: #f8fafc; font-family: monospace;">
                ${outbreak.cases.toLocaleString()}
              </div>
            </div>
            <div>
              <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Deaths</div>
              <div style="font-size: 16px; font-weight: 700; color: #ef4444; font-family: monospace;">
                ${outbreak.deaths.toLocaleString()}
              </div>
            </div>
          </div>
          ${outbreak.summary
            ? `<p style="margin: 0 0 10px; font-size: 11px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #1e293b; padding-top: 8px;">${outbreak.summary.slice(0, 150)}${outbreak.summary.length > 150 ? '…' : ''}</p>`
            : ''}
          <a href="${outbreak.sourceUrl}" target="_blank" rel="noopener noreferrer"
            style="
              display: inline-flex;
              align-items: center;
              gap: 4px;
              font-size: 11px;
              color: #06b6d4;
              text-decoration: none;
            ">
            View source ↗
          </a>
        </div>`,
        {
          maxWidth: 280,
          className: 'epi-popup',
        }
      );

      if (onClick) {
        marker.on('click', () => onClick(outbreak));
      }

      marker.addTo(map);
    });
  };

  useEffect(() => {
    initMap();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update markers when outbreaks change (after map is initialized)
  useEffect(() => {
    if (!mapRef.current) return;
    import('leaflet').then((mod) => {
      renderMarkers(mod.default, mapRef.current, outbreaks, onMarkerClick);
    });
  }, [outbreaks, onMarkerClick]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full" style={{ height: '520px' }}>
      <div ref={containerRef} className="absolute inset-0" />

      {/* Map legend */}
      <div className="absolute bottom-10 left-3 z-[1000] bg-[#0f172a]/90 backdrop-blur-sm border border-[#1e293b] rounded-lg p-3 text-xs">
        <div className="text-slate-400 font-mono font-bold tracking-widest mb-2 text-[10px]">SEVERITY</div>
        {(
          [
            ['CRITICAL', '#ef4444', '>10K cases'],
            ['HIGH', '#f97316', '>1K cases'],
            ['MEDIUM', '#eab308', '>100 cases'],
            ['LOW', '#22c55e', '<100 cases'],
          ] as const
        ).map(([label, color, hint]) => (
          <div key={label} className="flex items-center gap-2 mb-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ background: color }}
            />
            <span className="text-slate-300 font-mono text-[10px] font-bold w-16">{label}</span>
            <span className="text-slate-500 text-[10px]">{hint}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
