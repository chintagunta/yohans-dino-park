import {
  CHUNK, HORIZON, REGION_W, WORLD_H, Blob, getChunk, chunkOf, hash01, regionInfo, regionOf, volcanoNear, rngFor,
} from '../world';
import type { Era } from '../types';
import { drawFrondFan } from './flora';
import { clamp, ellipse, lerp, mix, mulberry32, smoothstep } from './util';

type C = CanvasRenderingContext2D;

/* -------------------------------------------------------------------------- */
/*  Chunked ground plane (grass, soil, rivers, lakes, lava)                   */
/* -------------------------------------------------------------------------- */

export const GROUND_TOP = HORIZON - 8;
const OFF = 3; // overlap pixels on each side to avoid seams

type RGBA = [number, number, number, number];
const ERA_TINT: Record<Era, RGBA> = {
  triassic: [226, 196, 90, 0.34],
  jurassic: [30, 130, 80, 0.26],
  cretaceous: [160, 235, 100, 0.3],
};

function tintAt(x: number): RGBA {
  const r = regionOf(x);
  const cur = ERA_TINT[regionInfo(r).era];
  const dl = x - r * REGION_W;
  const dr = (r + 1) * REGION_W - x;
  const BL = 320;
  let col = cur;
  if (dl < BL) col = mixRGBA(cur, ERA_TINT[regionInfo(r - 1).era], 0.5 * (1 - dl / BL));
  else if (dr < BL) col = mixRGBA(cur, ERA_TINT[regionInfo(r + 1).era], 0.5 * (1 - dr / BL));
  return col;
}
const mixRGBA = (a: RGBA, b: RGBA, t: number): RGBA => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];

function ashAt(x: number) {
  const r0 = regionOf(x);
  let a = 0;
  for (let r = r0 - 1; r <= r0 + 1; r++) {
    const i = regionInfo(r);
    if (i.volcano) a = Math.max(a, 0.55 * Math.exp(-Math.pow((x - i.vx) / 520, 2)));
  }
  return a;
}

const groundCache = new Map<number, HTMLCanvasElement>();

export function buildChunkGround(ci: number): HTMLCanvasElement {
  const x0 = ci * CHUNK;
  const w = CHUNK + OFF * 2;
  const h = WORLD_H - GROUND_TOP;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  ctx.translate(OFF, 0); // local x = worldX - x0
  const rnd = rngFor(ci, 41);
  const chunk = getChunk(ci);

  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0, '#c4e28e');
  base.addColorStop(0.22, '#8fd06a');
  base.addColorStop(0.6, '#62b957');
  base.addColorStop(1, '#3f9a48');
  ctx.fillStyle = base;
  ctx.fillRect(-OFF, 0, w, h);

  // continuous tint + ash strips
  const STEP = 8;
  for (let lx = -OFF; lx < CHUNK + OFF; lx += STEP) {
    const wx = x0 + lx + STEP / 2;
    const t = tintAt(wx);
    ctx.fillStyle = `rgba(${t[0] | 0},${t[1] | 0},${t[2] | 0},${t[3].toFixed(3)})`;
    ctx.fillRect(lx, 0, STEP + 1, h);
    const a = ashAt(wx);
    if (a > 0.02) {
      ctx.fillStyle = `rgba(62,46,42,${(a * 0.8).toFixed(3)})`;
      ctx.fillRect(lx, 0, STEP + 1, h * (0.75 + 0.25 * a));
    }
  }

  for (let i = 0; i < 200; i++) {
    const x = -OFF + rnd() * w;
    const y = rnd() * h;
    const r = 30 + rnd() * 90;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.12 + (y / h) * 0.2), 0, 0, 6.28);
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,200,0.07)' : 'rgba(20,80,40,0.08)';
    ctx.fill();
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < 2200; i++) {
    const x = -OFF + rnd() * w;
    const y = rnd() * h;
    const s = 3 + (y / h) * 7;
    ctx.strokeStyle = rnd() > 0.5 ? 'rgba(40,120,50,0.45)' : 'rgba(190,240,120,0.45)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * 3, y - s);
    ctx.stroke();
  }
  if (chunk.era === 'cretaceous') {
    for (let i = 0; i < 260; i++) {
      const x = rnd() * CHUNK;
      const y = rnd() * h;
      ctx.beginPath();
      ctx.arc(x, y, 1.6 + (y / h) * 1.6, 0, 6.28);
      ctx.fillStyle = ['#fff', '#ffd23f', '#ff8fb8', '#c9a0ff'][Math.floor(rnd() * 4)];
      ctx.fill();
    }
  }

  for (const l of chunk.liquids) {
    const off = (b: Blob) => ({ x: b.x - x0, y: b.y - GROUND_TOP, rx: b.rx, ry: b.ry });
    const water = l.kind === 'water';
    for (const b0 of l.blobs) {
      const b = off(b0);
      ellipse(ctx, b.x, b.y + 3, b.rx * 1.12 + 6, b.ry * 1.18 + 4);
      ctx.fillStyle = water ? '#e8d59f' : '#2d2220';
      ctx.fill();
    }
    for (const b0 of l.blobs) {
      const b = off(b0);
      ellipse(ctx, b.x, b.y + 2, b.rx * 1.04, b.ry * 1.08);
      ctx.fillStyle = water ? '#c9b27a' : '#4a3029';
      ctx.fill();
    }
    for (const b0 of l.blobs) {
      const b = off(b0);
      ellipse(ctx, b.x, b.y, b.rx, b.ry);
      const g = ctx.createLinearGradient(0, b.y - b.ry, 0, b.y + b.ry);
      if (water) {
        g.addColorStop(0, '#4fd0d8');
        g.addColorStop(1, '#1f8ec2');
      } else {
        g.addColorStop(0, '#ff9a1f');
        g.addColorStop(1, '#e3380f');
      }
      ctx.fillStyle = g;
      ctx.fill();
    }
    for (const b0 of l.blobs) {
      const b = off(b0);
      ellipse(ctx, b.x - b.rx * 0.05, b.y - b.ry * 0.12, b.rx * 0.78, b.ry * 0.62);
      ctx.fillStyle = water ? 'rgba(140,240,240,0.22)' : 'rgba(255,230,80,0.45)';
      ctx.fill();
    }
  }

  const haze = ctx.createLinearGradient(0, 0, 0, 60);
  haze.addColorStop(0, 'rgba(255,248,220,0.65)');
  haze.addColorStop(1, 'rgba(255,248,220,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(-OFF, 0, w, 60);
  return cv;
}

/** Make sure visible chunks exist (built immediately) and prebuild near ones one per frame. */
export function ensureGround(x0: number, x1: number) {
  const a = chunkOf(x0), b = chunkOf(x1);
  for (let ci = a; ci <= b; ci++) if (!groundCache.has(ci)) groundCache.set(ci, buildChunkGround(ci));
  for (const ci of [b + 1, a - 1, b + 2, a - 2]) {
    if (!groundCache.has(ci)) { groundCache.set(ci, buildChunkGround(ci)); break; }
  }
  for (const k of groundCache.keys()) if (k < a - 4 || k > b + 4) groundCache.delete(k);
}

export function drawGround(ctx: C, camX: number, viewW: number) {
  const a = chunkOf(camX), b = chunkOf(camX + viewW);
  for (let ci = a; ci <= b; ci++) {
    const cv = groundCache.get(ci);
    if (cv) ctx.drawImage(cv, ci * CHUNK - OFF - camX, GROUND_TOP);
  }
}

/* -------------------------------------------------------------------------- */
/*  Parallax backdrop                                                         */
/* -------------------------------------------------------------------------- */

const ridgeN = (u: number) => Math.sin(u * 1.3) * 0.5 + Math.sin(u * 2.9 + 1.7) * 0.3 + Math.sin(u * 6.1 + 0.4) * 0.2;
const ridgeU = (layerX: number, seed: number) => layerX * 0.004 + seed;

function ridge(ctx: C, f: number, camX: number, viewW: number, baseY: number, amp: number, color: string, seed: number) {
  ctx.beginPath();
  ctx.moveTo(0, HORIZON + 12);
  for (let x = 0; x <= viewW + 12; x += 12) {
    ctx.lineTo(x, baseY - amp * (0.5 + 0.5 * ridgeN(ridgeU(x + camX * f, seed))));
  }
  ctx.lineTo(viewW, HORIZON + 12);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function cloud(ctx: C, x: number, y: number, s: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  const puffs: [number, number, number][] = [[0, 0, 26], [28, -10, 32], [62, -2, 28], [88, 6, 20], [-24, 8, 18]];
  for (const [px, py, r] of puffs) {
    ctx.beginPath();
    ctx.arc(x + px * s, y + py * s, r * s, 0, 6.28);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(180,215,240,0.35)';
  ctx.beginPath();
  ctx.ellipse(x + 40 * s, y + 20 * s, 66 * s, 8 * s, 0, 0, 6.28);
  ctx.fill();
}

function volcano(ctx: C, cx: number, w: number, h: number, t: number, seed: number, active: boolean) {
  const base = HORIZON + 8;
  const top = base - h;
  const rim = w * 0.07;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, base);
  ctx.quadraticCurveTo(cx - w * 0.16, base - h * 0.32, cx - rim, top);
  ctx.lineTo(cx + rim, top);
  ctx.quadraticCurveTo(cx + w * 0.16, base - h * 0.32, cx + w / 2, base);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, top, 0, base);
  g.addColorStop(0, '#6b4d48');
  g.addColorStop(0.5, '#8c6a5e');
  g.addColorStop(1, '#b08c78');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(40,20,30,0.28)';
  ctx.beginPath();
  ctx.moveTo(cx + rim * 0.3, top);
  ctx.lineTo(cx + w / 2, base);
  ctx.lineTo(cx + w * 0.05, base);
  ctx.closePath();
  ctx.fill();
  if (active) {
    const pulse = 0.65 + 0.35 * Math.sin(t * 1.7 + seed * 6);
    for (let k = 0; k < 3; k++) {
      const dx = (k - 1) * w * 0.07;
      ctx.beginPath();
      ctx.moveTo(cx + dx * 0.4, top + 4);
      ctx.bezierCurveTo(cx + dx * 2.5 + 14, top + h * 0.3, cx + dx * 3 - 16, top + h * 0.5, cx + dx * 4.6, top + h * (0.72 + k * 0.05));
      ctx.strokeStyle = `rgba(255,110,30,${0.55 * pulse})`;
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,220,90,${0.85 * pulse})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
  ctx.restore();
  ellipse(ctx, cx, top, rim, rim * 0.28);
  ctx.fillStyle = active ? '#ff8a2a' : '#4a3430';
  ctx.fill();
  if (!active) return;
  const cyc = (t + seed * 3) % 15;
  const erupt = cyc < 3.4 ? Math.sin((cyc / 3.4) * Math.PI) : 0;
  const glow = ctx.createRadialGradient(cx, top, 2, cx, top, w * (0.3 + erupt * 0.25));
  glow.addColorStop(0, `rgba(255,170,60,${0.55 + erupt * 0.35})`);
  glow.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - w, top - w, w * 2, w * 1.5);
  for (let i = 0; i < 16; i++) {
    const age = (t * 0.07 + i / 16 + seed) % 1;
    const y = top - age * h * (0.9 + erupt * 0.4);
    const x = cx + age * age * w * 0.7 + Math.sin(age * 6 + i) * 8;
    const r = w * 0.045 + age * w * 0.17;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.28);
    ctx.fillStyle = `rgba(${lerp(78, 150, age)},${lerp(64, 130, age)},${lerp(80, 150, age)},${(1 - age) * 0.42})`;
    ctx.fill();
  }
  if (erupt > 0) {
    const rnd = mulberry32(Math.floor((t + seed * 3) / 15) + 3);
    for (let i = 0; i < 26; i++) {
      const vx = (rnd() - 0.5) * 160;
      const vy = 150 + rnd() * 190;
      const tau = cyc - i * 0.045;
      if (tau <= 0) continue;
      const x = cx + vx * tau;
      const y = top - vy * tau + 130 * tau * tau;
      if (y > base) continue;
      ctx.beginPath();
      ctx.arc(x, y, 2.5 + rnd() * 2.5, 0, 6.28);
      ctx.fillStyle = 'rgba(255,200,70,0.95)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, 6.28);
      ctx.fillStyle = 'rgba(255,100,30,0.25)';
      ctx.fill();
    }
  }
}

export function drawBackdrop(ctx: C, camX: number, viewW: number, t: number) {
  const cx = camX + viewW / 2;
  const vn = volcanoNear(cx);
  const vol = vn ? Math.exp(-Math.pow((cx - vn.vx) / 900, 2)) : 0;
  const era = regionInfo(regionOf(cx)).era;
  const warm = era === 'triassic' ? 0.25 : 0;
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON + 10);
  sky.addColorStop(0, mix(mix('#3fa9e6', '#4aa0e0', warm), '#7a7ea8', vol * 0.8));
  sky.addColorStop(0.55, mix(mix('#8bd7f0', '#a8dcec', warm), '#f0a77f', vol * 0.9));
  sky.addColorStop(1, mix(mix('#fff3cf', '#ffe9b8', warm), '#ffd9a0', vol));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, viewW, HORIZON + 14);

  const sx = viewW * 0.78;
  const sg = ctx.createRadialGradient(sx, 92, 8, sx, 92, 190);
  sg.addColorStop(0, 'rgba(255,248,200,0.95)');
  sg.addColorStop(0.2, 'rgba(255,236,150,0.5)');
  sg.addColorStop(1, 'rgba(255,230,150,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(sx - 200, -100, 400, 400);
  ctx.beginPath();
  ctx.arc(sx, 92, 40, 0, 6.28);
  ctx.fillStyle = '#fff7c9';
  ctx.fill();

  // clouds: three parallax layers, cells hashed so the sky never runs out
  for (let layer = 0; layer < 3; layer++) {
    const f = 0.08 + layer * 0.05;
    const speed = 3 + layer * 3;
    const CELL = 640;
    const u0 = camX * f - t * speed - 220;
    for (let k = Math.floor(u0 / CELL); k <= Math.floor((u0 + viewW + 440) / CELL); k++) {
      if (hash01(k, 31 + layer) < 0.35) continue;
      const u = k * CELL + hash01(k, 41 + layer) * 400;
      const x = u + t * speed - camX * f;
      cloud(ctx, x, 30 + hash01(k, 51 + layer) * 150, 0.75 + hash01(k, 61 + layer) * 0.5 + layer * 0.1);
    }
  }

  ridge(ctx, 0.18, camX, viewW, HORIZON - 6, 150, mix('#b8cfe8', '#c9a5ad', vol * 0.6), 1.2);
  ridge(ctx, 0.3, camX, viewW, HORIZON - 2, 120, mix('#9fbddc', '#a98798', vol * 0.6), 4.1);

  // volcanoes anchored to their regions (parallax around the screen centre)
  const r0 = regionOf(cx);
  for (let r = r0 - 3; r <= r0 + 3; r++) {
    const info = regionInfo(r);
    if (!info.volcano) continue;
    const mainX = viewW / 2 + (info.vx - cx) * 0.4;
    if (mainX > -400 && mainX < viewW + 400) volcano(ctx, mainX, 640, 330, t, info.vseed, true);
    const compDir = hash01(r, 13) > 0.5 ? 1 : -1;
    const compX = viewW / 2 + (info.vx + compDir * 720 - cx) * 0.4;
    if (compX > -300 && compX < viewW + 300) volcano(ctx, compX, 380, 200, t, (info.vseed + 0.37) % 1, true);
  }

  // hills + tiny conifers
  const hillTint = era === 'triassic' ? ['#a8cd72', '#8fbf62'] : era === 'cretaceous' ? ['#8ad070', '#6cc25e'] : ['#7fc272', '#62b058'];
  ridge(ctx, 0.58, camX, viewW, HORIZON + 4, 70, hillTint[0], 7.7);
  const TC = 85;
  const f = 0.58;
  for (let k = Math.floor((camX * f - 30) / TC); k <= Math.floor((camX * f + viewW + 30) / TC); k++) {
    if (hash01(k, 71) < 0.45) continue;
    const lx = k * TC + hash01(k, 72) * TC;
    const x = lx - camX * f;
    const y = HORIZON + 4 - 70 * (0.5 + 0.5 * ridgeN(ridgeU(lx, 7.7)));
    const s = 0.7 + hash01(k, 73) * 0.7;
    ctx.fillStyle = era === 'cretaceous' ? '#4aa060' : '#3e8f55';
    ctx.beginPath();
    ctx.moveTo(x, y - 40 * s);
    ctx.lineTo(x + 11 * s, y + 2);
    ctx.lineTo(x - 11 * s, y + 2);
    ctx.fill();
  }
  ridge(ctx, 0.8, camX, viewW, HORIZON + 10, 38, hillTint[1], 11.3);
}

export function drawLiquidFx(ctx: C, camX: number, viewW: number, t: number) {
  ctx.save();
  ctx.translate(-camX, 0);
  for (let ci = chunkOf(camX); ci <= chunkOf(camX + viewW); ci++) {
    for (const l of getChunk(ci).liquids) {
      const water = l.kind === 'water';
      l.blobs.forEach((b, i) => {
        if (b.x + b.rx < camX || b.x - b.rx > camX + viewW) return;
        const n = water ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const h = Math.sin((i + 1) * 12.9898 + k * 78.233 + ci) * 43758.5453;
          const fr = h - Math.floor(h);
          const fr2 = h * 7.3 - Math.floor(h * 7.3);
          const ox = (fr - 0.5) * b.rx * 1.4 + Math.sin(t * 0.6 + i + k) * 8;
          const oy = (fr2 - 0.5) * b.ry * 1.1;
          if (water) {
            ctx.strokeStyle = `rgba(255,255,255,${0.2 + 0.3 * Math.max(0, Math.sin(t * 1.6 + i * 2 + k * 3))})`;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.ellipse(b.x + ox, b.y + oy, 10 + b.rx * 0.05, 2.5 + b.ry * 0.04, 0, 0, Math.PI);
            ctx.stroke();
          } else {
            const p = 0.5 + 0.5 * Math.sin(t * 2 + i);
            ctx.fillStyle = `rgba(255,240,120,${0.25 + 0.3 * p})`;
            ctx.beginPath();
            ctx.ellipse(b.x + ox, b.y + oy, 5 + p * 5, 2 + p * 2, 0, 0, 6.28);
            ctx.fill();
          }
        }
        if (!water) {
          const p = 0.5 + 0.5 * Math.sin(t * 1.3 + i * 0.7);
          ctx.fillStyle = `rgba(255,120,30,${0.12 + 0.12 * p})`;
          ctx.beginPath();
          ctx.ellipse(b.x, b.y - b.ry * 0.4, b.rx * 1.2, b.ry * 1.4, 0, 0, 6.28);
          ctx.fill();
        }
      });
    }
  }
  ctx.restore();
}

/** Big framing leaves close to the camera. */
export function drawForeground(ctx: C, camX: number, viewW: number, t: number) {
  const f = 1.3;
  const CELL = 230;
  for (let k = Math.floor((camX * f - 260) / CELL); k <= Math.floor((camX * f + viewW + 260) / CELL); k++) {
    if (hash01(k, 81) < 0.2) continue;
    const x = k * CELL + hash01(k, 82) * 120 - camX * f;
    const s = 1.8 + hash01(k, 83) * 1.4;
    const type = Math.floor(hash01(k, 84) * 3);
    ctx.save();
    ctx.translate(x, WORLD_H + 24);
    ctx.scale(s, s);
    if (type === 0) drawFrondFan(ctx, 0, 0, 7, 56, 2.2, t, k, '#3f9d45', '#2a6f33');
    else if (type === 1) drawFrondFan(ctx, 0, 0, 5, 40, 1.9, t, k, '#57b552', '#347f3b');
    else {
      ctx.strokeStyle = '#2f8a3f';
      ctx.lineCap = 'round';
      ctx.lineWidth = 3;
      for (let j = 0; j < 9; j++) {
        ctx.beginPath();
        ctx.moveTo((j - 4) * 6, 0);
        ctx.quadraticCurveTo((j - 4) * 8, -22, (j - 4) * 14 + Math.sin(t + j) * 3, -38 - (j % 3) * 8);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  const f2 = 1.15, C2 = 900;
  for (let k = Math.floor((camX * f2 - 300) / C2); k <= Math.floor((camX * f2 + viewW + 300) / C2); k++) {
    if (hash01(k, 91) < 0.4) continue;
    const x = k * C2 + hash01(k, 92) * 500 - camX * f2;
    ctx.save();
    ctx.translate(x, -14);
    ctx.scale((hash01(k, 93) > 0.5 ? 1 : -1) * 1.6, 1.6);
    drawFrondFan(ctx, 0, 0, 6, 120, 1.5, t, k, '#2f9a45', '#1f6a34', Math.PI / 2 - 0.2);
    ctx.restore();
  }
  void clamp;
  void smoothstep;
}
