#!/usr/bin/env node
/**
 * Builds lib/live/data/medical-aircraft.json: ICAO hex → [registration, type,
 * operator] for aircraft whose registered owner or operator is an air-medical
 * service. Source: the tar1090 aircraft database (wiedehopf/tar1090-db),
 * compiled from national registries; operator names are mostly from the US FAA
 * registry, so coverage outside the US is thin and is complemented at runtime
 * by callsign rules in lib/live/aircraft.ts.
 *
 * Run occasionally (registrations change slowly):
 *   node scripts/build-medical-aircraft.mjs
 */
import { gunzipSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = 'https://github.com/wiedehopf/tar1090-db/raw/csv/aircraft.csv.gz';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'live', 'data', 'medical-aircraft.json');

// Operator names. Written to avoid personal names ("Christopher" matched a
// looser "christoph" pattern hundreds of times).
const OPERATOR = new RegExp(
  [
    'air methods', 'air evac', 'med[- ]?trans', 'air medical', 'aeromedical', 'medical (center|centre|transport|flight|services|air)',
    'ambulance', 'life ?flight', 'careflight', 'careflite', 'critical care', 'life ?link', 'lifestar', 'lifenet', 'medstar',
    'survival flight', 'guardian flight', 'reach air', 'metro aviation', 'phi (air medical|health)', 'mercy (flight|air)',
    'hospital', 'health ?net', 'medevac', 'medflight', 'flight for life', '\\bair ?care\\b', 'aircare', 'luftrettung',
    'drf stiftung', 'adac', 'rettungsflugwacht', '\\brega\\b', 'luftambulanse', 'christophorus', 'royal flying doctor',
    '\\bornge\\b', 'helimed', 'specialist aviation services', 'babcock mission critical', 'samu',
  ].join('|'),
  'i'
);

// Helicopter and fixed-wing types used for air-ambulance work. Anything else
// owned by, say, a hospital (a staff member's Cessna) is left out.
const TYPES = new Set([
  'EC35', 'EC45', 'EC30', 'EC55', 'EC75', 'EC25', 'B407', 'B06', 'B412', 'B429', 'B430', 'A109', 'A119', 'A139', 'A169',
  'A189', 'AS50', 'AS55', 'AS65', 'AS3B', 'BK17', 'S76', 'S92', 'H160', 'EXPL',
  'PC12', 'PC24', 'BE20', 'BE30', 'B350', 'BE9L', 'BE9T', 'LJ31', 'LJ35', 'LJ45', 'LJ55', 'LJ60', 'C56X', 'C560', 'C680',
  'CL30', 'CL60', 'P180',
]);

const res = await fetch(SRC);
if (!res.ok) throw new Error(`download failed: ${res.status}`);
const csv = gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8');

const out = {};
let n = 0;
for (const line of csv.split('\n')) {
  const [icao, reg, type, , , , ownOp] = line.split(';');
  if (!icao || !ownOp || !TYPES.has(type) || !OPERATOR.test(ownOp)) continue;
  out[icao.toLowerCase()] = [reg, type, ownOp.replace(/\s+/g, ' ').trim()];
  n++;
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
console.log(`wrote ${n} aircraft to ${OUT}`);
