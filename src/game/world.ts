import type { Era } from './types';
import type { Decor, DecorKind } from './draw/flora';
import { clamp, lerp, mulberry32 } from './draw/util';

/* -------------------------------------------------------------------------- */
/*  Infinite procedural world: horizontal chunks generated from hashes.       */
/* -------------------------------------------------------------------------- */

export const CHUNK = 1200;
export const REGION_CHUNKS = 2;
export const REGION_W = CHUNK * REGION_CHUNKS;
export const WORLD_H = 720;
export const HORIZON = 372;
export const GROUND_MIN = 410;
export const GROUND_MAX = 692;

export interface Blob { x: number; y: number; rx: number; ry: number }
export interface Liquid { kind: 'water' | 'lava'; name: string; blobs: Blob[]; tone: number }

function h32(n: number) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
}
export const hash01 = (a: number, b = 0) => h32(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ 0x9e3779b9) / 4294967296;
export const rngFor = (a: number, b = 0) => mulberry32(h32(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ 0x1234567));
export const floorDiv = (a: number, b: number) => Math.floor(a / b);
export const mod = (a: number, b: number) => ((a % b) + b) % b;

export const ERA_ORDER: Era[] = ['triassic', 'jurassic', 'cretaceous'];
const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

const NAMES: Record<string, string[]> = {
  triassic: ['Fern Valley', 'Cycad Basin', 'Horsetail Flats', 'Red Rock Dunes', 'Dawn Shallows'],
  volcano: ['Volcano Valley', 'Ember Ridge', 'Ashfall Plains', 'Magma Basin'],
  jurassic: ['Conifer Forest', 'Ginkgo Grove', 'Mossy Hills', 'Giants’ Crossing'],
  cretaceous: ['Blossom Meadows', 'Flower Plains', 'Sunset Fields', 'Magnolia Hills', 'Lagoon Shores'],
};

export interface RegionInfo { r: number; era: Era; name: string; volcano: boolean; vx: number; vseed: number }
const regionCache = new Map<number, RegionInfo>();

export function regionInfo(r: number): RegionInfo {
  const hit = regionCache.get(r);
  if (hit) return hit;
  const block = floorDiv(r, 3);
  const perm = block === 0 ? PERMS[0] : PERMS[Math.floor(hash01(block, 3) * 6) % 6];
  const era = ERA_ORDER[perm[mod(r, 3)]];
  const volcano = era === 'jurassic' && (r === 1 || hash01(r, 5) < 0.8);
  const list = NAMES[volcano ? 'volcano' : era];
  const name = r === 0 ? 'Fern Valley' : r === 1 ? 'Volcano Valley' : list[Math.floor(hash01(r, 7) * list.length)];
  const info = { r, era, name, volcano, vx: r * REGION_W + CHUNK / 2, vseed: hash01(r, 9) };
  regionCache.set(r, info);
  return info;
}

export const regionOf = (x: number) => floorDiv(x, REGION_W);
export const zoneAt = (x: number) => regionInfo(regionOf(x));
export const chunkOf = (x: number) => floorDiv(x, CHUNK);

export const depthT = (y: number) => clamp((y - GROUND_MIN) / (GROUND_MAX - GROUND_MIN), 0, 1);
export const depthScale = (y: number) => lerp(0.62, 1.12, depthT(y));

/** nearest volcano to world x (within a few regions) */
export function volcanoNear(x: number): RegionInfo | null {
  const r0 = regionOf(x);
  let best: RegionInfo | null = null;
  for (let r = r0 - 2; r <= r0 + 2; r++) {
    const i = regionInfo(r);
    if (i.volcano && (!best || Math.abs(i.vx - x) < Math.abs(best.vx - x))) best = i;
  }
  return best;
}

/** nearest region of the given era (skips the region the camera is already in) */
export function nearestRegionOfEra(era: Era, x: number): RegionInfo {
  const r0 = regionOf(x);
  const here = regionInfo(r0);
  for (let d = here.era === era ? 1 : 0; d < 20; d++) {
    for (const r of d === 0 ? [r0] : [r0 + d, r0 - d]) {
      const i = regionInfo(r);
      if (i.era === era) return i;
    }
  }
  return here;
}

/* -------------------------------------------------------------------------- */

function riverBlobs(x0: number, y0: number, y1: number, wobble: number, phase: number, w0: number, w1: number, shift = 0): Blob[] {
  const out: Blob[] = [];
  for (let y = y0; y <= y1; y += 5) {
    const t = (y - y0) / (y1 - y0);
    const rx = lerp(w0, w1, Math.pow(t, 0.9));
    out.push({ x: x0 + Math.sin(t * 4.2 + phase) * wobble * (0.35 + t) + shift * t, y, rx, ry: rx * 0.3 });
  }
  return out;
}

export interface Chunk {
  ci: number;
  x0: number;
  era: Era;
  name: string;
  volcano: boolean;
  liquids: Liquid[];
  decor: Decor[];
}

const chunkCache = new Map<number, Chunk>();

const WATER_NAMES = ['Mirror Lake', 'Lily Pond', 'Sunset Lagoon', 'Teal Pool', 'Jurassic River', 'Cypress Creek', 'Silver River', 'Fish Hollow', 'Reed Marsh'];
const LAVA_NAMES = ['Lava Lake', 'Magma Pool', 'Ember Basin', 'Fire Pit'];

/** Keep a blob (and its sandy rim) inside its chunk so ground tiles never clip it. */
function fit(b: Blob, x0: number): Blob {
  const m = 1.12;
  const lo = x0 + 24, hi = x0 + CHUNK - 24;
  const rx = Math.min(b.rx, (hi - lo) / 2 / m - 8);
  const k = rx / b.rx;
  return { x: clamp(b.x, lo + rx * m + 8, hi - rx * m - 8), y: b.y, rx, ry: b.ry * k };
}

/** A chain of overlapping ellipses: ponds, kidney-shaped lakes, long lagoons, … */
function chain(rnd: () => number, x0: number, cx: number, cy: number, n: number, rMin: number, rMax: number, aspect: number, bend: number): Blob[] {
  const radii: number[] = [];
  for (let i = 0; i < n; i++) radii.push(lerp(rMin, rMax, 0.25 + 0.75 * rnd()) * (n > 2 && i > 0 && i < n - 1 ? 1.12 : 1));
  let total = 0;
  for (const r of radii) total += r * 1.05;
  const scale = total > 1000 ? 1000 / total : 1;
  let x = cx - (total * scale) / 2;
  const out: Blob[] = [];
  radii.forEach((r0, i) => {
    const r = r0 * scale;
    x += r * (i === 0 ? 1.05 : 0.55);
    const u = n > 1 ? i / (n - 1) : 0.5;
    const y = clamp(cy + Math.sin(u * Math.PI) * bend + (rnd() - 0.5) * 14, 505, 640);
    out.push(fit({ x, y, rx: r, ry: r * aspect * (0.9 + rnd() * 0.3) }, x0));
    x += r * 0.55;
  });
  return out;
}

function waterBody(rnd: () => number, x0: number): Blob[] {
  const t = rnd();
  const cx = x0 + 380 + rnd() * 440;
  const cy = 535 + rnd() * 60;
  if (t < 0.26) return chain(rnd, x0, cx, cy, 2, 55, 95, 0.36, 8); // small pond
  if (t < 0.5) return chain(rnd, x0, cx, cy, 3 + Math.floor(rnd() * 2), 110, 220, 0.3, 24); // lake
  if (t < 0.72) return chain(rnd, x0, cx, cy - 10, 5 + Math.floor(rnd() * 2), 75, 150, 0.32, (rnd() - 0.5) * 120); // winding lagoon
  if (t < 0.88) return [...chain(rnd, x0, cx - 270, cy, 2, 55, 110, 0.34, 10), ...chain(rnd, x0, cx + 250, cy + (rnd() - 0.5) * 60, 2, 60, 120, 0.34, 10)]; // twin ponds
  return chain(rnd, x0, cx, cy, 3, 230, 330, 0.28, 18); // great lake
}

function lavaBody(rnd: () => number, x0: number, cx: number, big: boolean): Blob[] {
  const cy = 520 + rnd() * 70;
  const t = rnd();
  if (!big) return chain(rnd, x0, cx, cy, 1 + Math.floor(rnd() * 2), 55, 140, 0.34, 6); // pool beside the stream
  if (t < 0.34) return chain(rnd, x0, cx, cy, 3 + Math.floor(rnd() * 2), 90, 200, 0.32, 20); // lava lake
  if (t < 0.6) return [...chain(rnd, x0, cx - 300, cy, 1, 50, 85, 0.36, 0), ...chain(rnd, x0, cx, cy + 30, 2, 55, 110, 0.34, 0), ...chain(rnd, x0, cx + 320, cy - 20, 1, 60, 100, 0.35, 0)]; // scattered pools
  if (t < 0.82) return chain(rnd, x0, cx, cy, 5, 70, 150, 0.33, (rnd() - 0.5) * 100); // winding magma channel
  return chain(rnd, x0, cx, cy, 3, 200, 270, 0.3, 16); // caldera lake
}

function makeLiquids(ci: number, era: Era, volcano: boolean): Liquid[] {
  const rnd = rngFor(ci, 11);
  const x0 = ci * CHUNK;
  const first = mod(ci, REGION_CHUNKS) === 0;
  const out: Liquid[] = [];
  if (volcano) {
    if (first) {
      const vx = x0 + CHUNK / 2;
      const wob = 30 + rnd() * 60;
      const stream = riverBlobs(vx, HORIZON + 4, 500 + rnd() * 40, wob, rnd() * 6, 12 + rnd() * 8, 50 + rnd() * 40).map((b) => fit(b, x0));
      out.push({ kind: 'lava', name: 'Lava Stream', tone: 0, blobs: [...stream, ...lavaBody(rnd, x0, vx + (rnd() < 0.5 ? -1 : 1) * (250 + rnd() * 150), false)] });
      if (rnd() < 0.45) out.push({ kind: 'lava', name: LAVA_NAMES[Math.floor(rnd() * LAVA_NAMES.length)], tone: 0, blobs: lavaBody(rnd, x0, vx + (rnd() < 0.5 ? -1 : 1) * 430, false) });
    } else if (rnd() < 0.7) {
      out.push({ kind: 'lava', name: LAVA_NAMES[Math.floor(rnd() * LAVA_NAMES.length)], tone: 0, blobs: lavaBody(rnd, x0, x0 + 400 + rnd() * 400, true) });
    }
    return out;
  }
  const roll = rnd();
  const lakeP = era === 'jurassic' ? 0.3 : 0.58;
  const riverP = era === 'jurassic' ? 0.45 : 0.22;
  const name = WATER_NAMES[Math.floor(rnd() * WATER_NAMES.length)];
  const tone = Math.floor(rnd() * 4);
  if (roll < lakeP) {
    out.push({ kind: 'water', name, tone, blobs: waterBody(rnd, x0) });
  } else if (roll < lakeP + riverP) {
    const cx = x0 + 520 + rnd() * 160;
    const wob = 60 + rnd() * 110;
    const w1 = 70 + rnd() * 70;
    const blobs = riverBlobs(cx, HORIZON + 6, 606, wob, rnd() * 6, 10 + rnd() * 14, w1, (rnd() - 0.5) * 180).map((b) => fit(b, x0));
    if (rnd() < 0.75) blobs.push(fit({ x: cx - 70 + (rnd() - 0.5) * 120, y: 612, rx: 120 + rnd() * 110, ry: 40 + rnd() * 24 }, x0));
    out.push({ kind: 'water', name, tone, blobs });
  }
  return out;
}

function makeDecor(ci: number, era: Era, volcano: boolean, liquids: Liquid[], vx: number): Decor[] {
  const rnd = rngFor(ci, 3);
  const x0 = ci * CHUNK;
  const out: Decor[] = [];
  const near = (x: number, y: number, m: number) => liquids.some((l) => l.blobs.some((b) => ((x - b.x) / (b.rx * m)) ** 2 + ((y - b.y) / (b.ry * m)) ** 2 <= 1));
  const put = (kind: DecorKind, x: number, y: number, s: number) => {
    if (near(x, y, 1.18)) return;
    out.push({ kind, x, y, s, v: rnd() });
  };
  const pick = <T,>(items: [T, number][]): T => {
    const tot = items.reduce((a, b) => a + b[1], 0);
    let r = rnd() * tot;
    for (const [it, w] of items) {
      r -= w;
      if (r <= 0) return it;
    }
    return items[0][0];
  };
  const mixes: Record<string, { n: number; kinds: [DecorKind, number][] }> = {
    triassic: { n: 100, kinds: [['fern', 5], ['horsetail', 4], ['palm', 2.2], ['shrub', 2.5], ['rock', 1.2], ['treefern', 1.6], ['tuft', 4], ['conifer', 0.5], ['flowers', 1.5]] },
    jurassic: { n: 120, kinds: [['conifer', 3], ['treefern', 2], ['fern', 4], ['tree', 1.8], ['rock', 1.2], ['horsetail', 2], ['shrub', 1.5], ['tuft', 3]] },
    volcano: { n: 100, kinds: [['conifer', 1.6], ['treefern', 1], ['fern', 2], ['rock', 1.2], ['lavarock', 2.4], ['ashplant', 2.4], ['horsetail', 1], ['tuft', 2], ['tree', 0.6]] },
    cretaceous: { n: 105, kinds: [['blossom', 2.2], ['tree', 1.6], ['palm', 1.6], ['shrub', 3], ['flowers', 6], ['tuft', 5], ['fern', 2], ['rock', 0.8], ['horsetail', 1]] },
  };
  const mix = mixes[volcano ? 'volcano' : era];
  for (let i = 0; i < mix.n; i++) {
    const x = x0 + rnd() * CHUNK;
    let y = lerp(HORIZON + 14, 704, Math.pow(rnd(), 0.85));
    const kind = pick(mix.kinds);
    const big = kind === 'conifer' || kind === 'tree' || kind === 'blossom' || kind === 'palm' || kind === 'treefern';
    if (big && y > 600) y = lerp(HORIZON + 14, 560, rnd());
    if (volcano && Math.abs(x - vx) < 260 && (kind === 'tree' || kind === 'conifer')) continue;
    put(kind, x, y, (big ? 0.85 : 0.9) + rnd() * 0.4);
  }
  if (ci === 0) {
    out.push({ kind: 'rock', x: 70, y: 520, s: 2.3, v: 0.62 });
    out.push({ kind: 'rock', x: 150, y: 560, s: 1.4, v: 0.3 });
  }
  return out.sort((a, b) => a.y - b.y);
}

export function getChunk(ci: number): Chunk {
  const hit = chunkCache.get(ci);
  if (hit) return hit;
  const info = regionInfo(floorDiv(ci, REGION_CHUNKS));
  const liquids = makeLiquids(ci, info.era, info.volcano);
  const c: Chunk = { ci, x0: ci * CHUNK, era: info.era, name: info.name, volcano: info.volcano, liquids, decor: makeDecor(ci, info.era, info.volcano, liquids, info.vx) };
  chunkCache.set(ci, c);
  return c;
}

export function pruneChunks(centerCi: number, keep = 7) {
  for (const k of chunkCache.keys()) if (Math.abs(k - centerCi) > keep) chunkCache.delete(k);
}

export function liquidsIn(x0: number, x1: number): Liquid[] {
  const out: Liquid[] = [];
  for (let ci = chunkOf(x0) - 1; ci <= chunkOf(x1) + 1; ci++) out.push(...getChunk(ci).liquids);
  return out;
}

/* ------------------------------ queries ----------------------------------- */

const inBlob = (b: Blob, x: number, y: number, m: number) => {
  const dx = (x - b.x) / (b.rx * m);
  const dy = (y - b.y) / (b.ry * m);
  return dx * dx + dy * dy <= 1;
};

export function liquidAt(x: number, y: number, margin = 1): Liquid | null {
  if (y < HORIZON) return null;
  const ci = chunkOf(x);
  for (let c = ci - 1; c <= ci + 1; c++) {
    for (const l of getChunk(c).liquids) for (const b of l.blobs) if (inBlob(b, x, y, margin)) return l;
  }
  return null;
}
export const inWater = (x: number, y: number, m = 1) => liquidAt(x, y, m)?.kind === 'water';
export const blocked = (x: number, y: number, m = 1.05) => liquidAt(x, y, m)?.kind === 'lava';

export function randomWaterPoint(rnd: () => number, near: number, reach = 1500): { x: number; y: number } | null {
  const waters = liquidsIn(near - reach, near + reach).filter((l) => l.kind === 'water');
  if (!waters.length) return null;
  const l = waters[Math.floor(rnd() * waters.length)];
  for (let i = 0; i < 12; i++) {
    const b = l.blobs[Math.floor(rnd() * l.blobs.length)];
    const x = b.x + (rnd() - 0.5) * b.rx * 1.3;
    const y = b.y + (rnd() - 0.5) * b.ry * 1.2;
    if (inWater(x, y, 0.8) && y > GROUND_MIN) return { x, y };
  }
  return null;
}
