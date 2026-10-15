#!/usr/bin/env node
/**
 * Copies MapLibre's web worker (and the shared chunk it imports) into
 * public/vendor/maplibre so the map can load it as a plain static module.
 *
 * maplibre-gl 6 spawns its worker with `new Worker(new URL('maplibre-gl-worker.mjs',
 * import.meta.url), { type: 'module' })`; under Next's bundler that URL does
 * not resolve and the server answers with an HTML 404, so the worker never
 * starts and no layers render. components/map/LiveMap.tsx points MapLibre at
 * the copied file with setWorkerUrl(). Runs before `dev` and `build` so the
 * copy always matches the installed version.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'maplibre-gl', 'dist');
const dst = join(root, 'public', 'vendor', 'maplibre');
mkdirSync(dst, { recursive: true });
for (const f of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) copyFileSync(join(src, f), join(dst, f));
const { version } = JSON.parse(readFileSync(join(root, 'node_modules', 'maplibre-gl', 'package.json'), 'utf8'));
writeFileSync(join(dst, 'VERSION'), `${version}\n`);
console.log(`maplibre worker ${version} copied to public/vendor/maplibre`);
