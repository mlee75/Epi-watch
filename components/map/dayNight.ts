/**
 * Day and night on the globe, from the real position of the sun.
 *
 * Two NASA images (public domain, served from /public/textures), both already
 * in Web Mercator so each output pixel maps to one input pixel:
 *  - earth-day.jpg:   Blue Marble shaded relief and bathymetry (GIBS layer
 *    BlueMarble_ShadedRelief_Bathymetry)
 *  - earth-night.jpg: Black Marble, city lights seen from space (GIBS layer
 *    VIIRS_Black_Marble)
 *
 * For every pixel we compute the sun's elevation there and blend: daylight
 * where the sun is up (brighter towards noon), city lights where it is well
 * below the horizon, and a soft twilight band between. The result is an image
 * the map draws on the globe; it is recomposed every few minutes as the
 * terminator moves (about 1.25 degrees of longitude every 5 minutes).
 */

export const DAY_URL = '/textures/earth-day.jpg';
export const NIGHT_URL = '/textures/earth-night.jpg';

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

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

async function pixels(url: string): Promise<ImageData> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  return g.getImageData(0, 0, c.width, c.height);
}

export interface DayNightComposer {
  /** Renders the globe texture for `date` and returns an object URL for it. */
  render(date: Date): Promise<string>;
}

export async function createDayNightComposer(): Promise<DayNightComposer> {
  const [day, night] = await Promise.all([pixels(DAY_URL), pixels(NIGHT_URL)]);
  const W = day.width;
  const H = day.height;

  // Per-row and per-column trigonometry, computed once.
  const sinLat = new Float32Array(H);
  const cosLat = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / H)));
    sinLat[y] = Math.sin(lat);
    cosLat[y] = Math.cos(lat);
  }
  const cosLon = new Float32Array(W);
  const sinLon = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const lon = ((x + 0.5) / W) * 2 * Math.PI - Math.PI;
    cosLon[x] = Math.cos(lon);
    sinLon[x] = Math.sin(lon);
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const out = ctx.createImageData(W, H);
  const o = out.data;
  const dd = day.data;
  const nd = night.data;
  let lastUrl: string | null = null;

  return {
    async render(date: Date) {
      const sun = subsolarPoint(date);
      const sDec = Math.sin(sun.lat * RAD);
      const cDec = Math.cos(sun.lat * RAD);
      const cSl = Math.cos(sun.lon * RAD);
      const sSl = Math.sin(sun.lon * RAD);

      for (let y = 0; y < H; y++) {
        const a = sinLat[y] * sDec;
        const b = cosLat[y] * cDec;
        let i = y * W * 4;
        for (let x = 0; x < W; x++, i += 4) {
          // sin(sun elevation) = sinφ·sinδ + cosφ·cosδ·cos(λ − λsun)
          const sinEl = a + b * (cosLon[x] * cSl + sinLon[x] * sSl);
          // Daylight from ~6° below the horizon (civil twilight) to ~3° above.
          const dayF = smooth(-0.1, 0.05, sinEl);
          // Low sun is dimmer than noon sun, which gives the globe its shading.
          const lum = dayF * (0.5 + 0.5 * Math.sqrt(Math.max(0, sinEl)));
          // City lights come up as the sky darkens (sun below ~3°).
          const nightF = 1 - smooth(-0.1, 0.0, sinEl);
          o[i] = Math.min(255, dd[i] * lum + nd[i] * nightF * 1.3);
          o[i + 1] = Math.min(255, dd[i + 1] * lum + nd[i + 1] * nightF * 1.3);
          o[i + 2] = Math.min(255, dd[i + 2] * lum + nd[i + 2] * nightF * 1.3);
          o[i + 3] = 255;
        }
      }
      ctx.putImageData(out, 0, 0);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
      if (!blob) throw new Error('could not encode globe texture');
      const url = URL.createObjectURL(blob);
      if (lastUrl) setTimeout(() => URL.revokeObjectURL(lastUrl!), 5000);
      lastUrl = url;
      return url;
    },
  };
}
