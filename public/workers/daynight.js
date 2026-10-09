/*
 * Day/night globe texture, composed off the main thread.
 *
 * Messages in:
 *   { type: 'init', dayUrl, nightUrl }   load both NASA images and precompute
 *                                        the city-light mask
 *   { type: 'render', sunLat, sunLon }   compose for that sun position
 * Messages out:
 *   { type: 'ready', width, height }
 *   { type: 'frame', blob }              JPEG of the composed texture
 *   { type: 'error', message }
 *
 * The maths mirrors what the main thread used to do (see
 * components/map/dayNight.ts for the sun position): per pixel, the sun's
 * elevation decides daylight (Blue Marble, brighter towards noon), a twilight
 * band, or a dark-blue Earth with warm city lights taken from Black Marble.
 * At 4096 px that is 16.7 million pixels per frame, which would freeze the
 * page for a noticeable moment on the main thread.
 */

let W = 0, H = 0;
let day = null;        // Uint8ClampedArray RGBA
let lights = null;     // Uint8Array, warm city-light intensity 0..255
let glow = null;       // Uint8Array, blurred lights
let sinLat, cosLat, cosLon, sinLon;
let canvas = null, ctx = null, out = null;

const RAD = Math.PI / 180;
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

async function pixels(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const bmp = await createImageBitmap(await res.blob());
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bmp, 0, 0);
  bmp.close();
  return g.getImageData(0, 0, c.width, c.height);
}

// Box blur of radius r on a W×H byte plane, in place via a scratch plane.
function blur(src, r) {
  const tmp = new Uint8Array(W * H);
  const dst = new Uint8Array(W * H);
  const n = 2 * r + 1;
  for (let y = 0; y < H; y++) {
    const row = y * W;
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[row + Math.min(W - 1, Math.max(0, k))];
    for (let x = 0; x < W; x++) {
      tmp[row + x] = acc / n;
      acc += src[row + Math.min(W - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += tmp[Math.min(H - 1, Math.max(0, k)) * W + x];
    for (let y = 0; y < H; y++) {
      dst[y * W + x] = acc / n;
      acc += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
    }
  }
  return dst;
}

async function init(dayUrl, nightUrl) {
  const [d, n] = await Promise.all([pixels(dayUrl), pixels(nightUrl)]);
  W = d.width; H = d.height;
  day = d.data;
  // Only warm pixels count as lights: Black Marble's moonlit land has a
  // blue-violet cast that must not tint the night side.
  lights = new Uint8Array(W * H);
  const nd = n.data;
  for (let p = 0, i = 0; p < W * H; p++, i += 4) {
    lights[p] = Math.min(255, Math.max(0, ((nd[i] + nd[i + 1]) * 0.5 - nd[i + 2] * 0.6 - 16) * 2.1));
  }
  // Blur radius scales with resolution so the glow is the same size on screen.
  glow = blur(lights, Math.max(2, Math.round(W / 700)));

  sinLat = new Float32Array(H); cosLat = new Float32Array(H);
  for (let y = 0; y < H; y++) {
    const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / H)));
    sinLat[y] = Math.sin(lat); cosLat[y] = Math.cos(lat);
  }
  cosLon = new Float32Array(W); sinLon = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const lon = ((x + 0.5) / W) * 2 * Math.PI - Math.PI;
    cosLon[x] = Math.cos(lon); sinLon[x] = Math.sin(lon);
  }
  canvas = new OffscreenCanvas(W, H);
  ctx = canvas.getContext('2d');
  out = ctx.createImageData(W, H);
}

async function render(sunLat, sunLon) {
  const sDec = Math.sin(sunLat * RAD), cDec = Math.cos(sunLat * RAD);
  const cSl = Math.cos(sunLon * RAD), sSl = Math.sin(sunLon * RAD);
  const o = out.data, dd = day;
  for (let y = 0; y < H; y++) {
    const a = sinLat[y] * sDec, b = cosLat[y] * cDec;
    let i = y * W * 4, p = y * W;
    for (let x = 0; x < W; x++, i += 4, p++) {
      // sin(sun elevation) = sinφ·sinδ + cosφ·cosδ·cos(λ − λsun)
      const sinEl = a + b * (cosLon[x] * cSl + sinLon[x] * sSl);
      const dayF = smooth(-0.1, 0.05, sinEl);
      const lum = dayF * (0.55 + 0.45 * Math.sqrt(Math.max(0, sinEl)));
      const nightF = 1 - smooth(-0.1, 0.0, sinEl);
      const light = Math.min(1.4, (lights[p] * 1.6 + glow[p] * 2.2) / 255) * nightF;
      const dark = 1 - dayF;
      o[i] = Math.min(255, dd[i] * (lum + dark * 0.1) + light * 255);
      o[i + 1] = Math.min(255, dd[i + 1] * (lum + dark * 0.13) + light * 205);
      o[i + 2] = Math.min(255, dd[i + 2] * (lum + dark * 0.2) + light * 130);
      o[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === 'init') {
      await init(m.dayUrl, m.nightUrl);
      self.postMessage({ type: 'ready', width: W, height: H });
    } else if (m.type === 'render') {
      const blob = await render(m.sunLat, m.sunLon);
      self.postMessage({ type: 'frame', blob });
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err && err.message ? err.message : String(err) });
  }
};
