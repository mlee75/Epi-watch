/**
 * Day and night on the globe, from the real position of the sun.
 *
 * Two NASA images (public domain, served from /public/textures), both in Web
 * Mercator so each output pixel maps to one input pixel:
 *  - earth-day*.jpg:   Blue Marble shaded relief and bathymetry (GIBS layer
 *    BlueMarble_ShadedRelief_Bathymetry)
 *  - earth-night*.jpg: Black Marble, city lights seen from space (GIBS layer
 *    VIIRS_Black_Marble)
 * Each comes at 2048 and 4096 px. The larger pair is used where the globe is
 * big enough to show the difference and memory allows; the composite needs
 * about 170 MB of working memory at 4096.
 *
 * The composition itself runs in a Web Worker (public/workers/daynight.js):
 * per pixel, daylight where the sun is up, a near-black blue Earth with warm
 * city lights where it is night, a soft twilight band between. The result is
 * an image the map draws on the globe, recomposed every few minutes as the
 * terminator moves (about 1.25° of longitude every 5 minutes).
 */

export const TEXTURES = {
  2048: { day: '/textures/earth-day.jpg', night: '/textures/earth-night.jpg' },
  4096: { day: '/textures/earth-day-4096.jpg', night: '/textures/earth-night-4096.jpg' },
} as const;

export type TextureSize = keyof typeof TEXTURES;

/** 4096 on large screens with enough memory; 2048 otherwise. */
export function chooseTextureSize(): TextureSize {
  if (typeof window === 'undefined') return 2048;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const big = Math.max(window.innerWidth, window.innerHeight) * (window.devicePixelRatio || 1) >= 1400;
  return big && (mem == null || mem >= 4) ? 4096 : 2048;
}

/** Corners of the full Web Mercator square, for a MapLibre image source. */
export const MERCATOR_WORLD: [[number, number], [number, number], [number, number], [number, number]] = [
  [-180, 85.051129], [180, 85.051129], [180, -85.051129], [-180, -85.051129],
];

const RAD = Math.PI / 180;

/**
 * Sub-solar point (where the sun is directly overhead), from the standard
 * low-precision solar formulas (Astronomical Almanac); good to about 0.1°,
 * far finer than one pixel here.
 */
export function subsolarPoint(date: Date): { lat: number; lon: number } {
  const d = date.getTime() / 86_400_000 - 10957.5; // days since J2000.0
  const g = (357.529 + 0.98560028 * d) * RAD; // mean anomaly
  const q = 280.459 + 0.98564736 * d; // mean longitude, degrees
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD; // ecliptic longitude
  const e = (23.439 - 0.00000036 * d) * RAD; // obliquity
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / RAD; // right ascension, degrees
  const dec = Math.asin(Math.sin(e) * Math.sin(L)) / RAD;
  const gmst = (18.697374558 + 24.06570982441908 * d) * 15; // degrees
  const lon = ((((ra - gmst) % 360) + 540) % 360) - 180;
  return { lat: dec, lon };
}

export interface DayNightComposer {
  /** Renders the globe texture for `date` and resolves to an object URL for it. */
  render(date: Date): Promise<string>;
  dispose(): void;
}

export async function createDayNightComposer(size: TextureSize): Promise<DayNightComposer> {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    throw new Error('day/night compositing needs Web Workers and OffscreenCanvas');
  }
  const worker = new Worker('/workers/daynight.js');
  const tex = TEXTURES[size];

  // One request in flight at a time; the worker answers in order.
  let queue: Promise<unknown> = Promise.resolve();
  const call = <T>(msg: object, want: string): Promise<T> => {
    const run = () =>
      new Promise<T>((resolve, reject) => {
        const onMessage = (e: MessageEvent) => {
          if (e.data?.type === want) { cleanup(); resolve(e.data as T); }
          else if (e.data?.type === 'error') { cleanup(); reject(new Error(e.data.message)); }
        };
        const onError = (e: ErrorEvent) => { cleanup(); reject(new Error(e.message)); };
        const cleanup = () => { worker.removeEventListener('message', onMessage); worker.removeEventListener('error', onError); };
        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);
        worker.postMessage(msg);
      });
    const p = queue.then(run, run);
    queue = p.catch(() => undefined);
    return p;
  };

  await call<{ type: 'ready' }>({ type: 'init', dayUrl: tex.day, nightUrl: tex.night }, 'ready');

  let lastUrl: string | null = null;
  return {
    async render(date) {
      const sun = subsolarPoint(date);
      const { blob } = await call<{ type: 'frame'; blob: Blob }>({ type: 'render', sunLat: sun.lat, sunLon: sun.lon }, 'frame');
      const url = URL.createObjectURL(blob);
      // Give the map time to load the new image before the old URL goes.
      if (lastUrl) { const old = lastUrl; setTimeout(() => URL.revokeObjectURL(old), 5000); }
      lastUrl = url;
      return url;
    },
    dispose() {
      worker.terminate();
      if (lastUrl) URL.revokeObjectURL(lastUrl);
    },
  };
}
