'use client';

import dynamic from 'next/dynamic';

/**
 * Client-side entry for the live map. MapLibre needs the browser (WebGL,
 * workers), and Next 15 only allows `ssr: false` dynamic imports from a
 * client component, so server pages import this wrapper instead.
 */
const LiveMap = dynamic(() => import('./LiveMap'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 640, display: 'grid', placeItems: 'center' }}>
      <p className="muted" style={{ fontSize: 13 }}>Loading map…</p>
    </div>
  ),
});

export default LiveMap;
