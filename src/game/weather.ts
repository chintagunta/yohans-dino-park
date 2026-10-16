import { approach, clamp, lerp, mulberry32 } from './draw/util';
import { HORIZON, WORLD_H, hash01 } from './world';
import type { Blob } from './world';

/* -------------------------------------------------------------------------- */
/*  Seasons, rain, snow, falling leaves/petals and thunder                    */
/* -------------------------------------------------------------------------- */

export interface Season { id: string; name: string; icon: string; tint: [number, number, number, number] }

export const SEASONS: Season[] = [
  { id: 'spring', name: 'Spring', icon: '🌸', tint: [255, 170, 210, 0.07] },
  { id: 'summer', name: 'Summer', icon: '☀️', tint: [255, 215, 100, 0.07] },
  { id: 'autumn', name: 'Autumn', icon: '🍂', tint: [255, 125, 30, 0.14] },
  { id: 'winter', name: 'Winter', icon: '❄️', tint: [175, 210, 255, 0.22] },
];

const SEASON_LEN = 90; // seconds
const BLEND = 14; // cross-fade at the end of a season
const N_DROPS = 320;
const N_FLAKES = 260;
const N_LEAVES = 30;

interface Drop { x: number; y: number; spd: number; landY: number; splash: number; depth: number }
interface Flake { x: number; y: number; vy: number; ph: number; size: number }
interface Leaf { x: number; y: number; vy: number; ph: number; rot: number; size: number; col: string }

const LEAF_COLS = ['#e8742a', '#d9482b', '#f2b134', '#b8601f', '#e89a2c'];
const PETAL_COLS = ['#ffc2d9', '#ffffff', '#ff9ec4', '#ffe0ec'];

export class Weather {
  season = 0;
  seasonT = 20;
  rain = 0;
  snow = 0;
  leafLevel = 0;
  snowCover = 0;
  flash = 0;
  thunder = false;
  auto = true;

  private eventT = 30 + Math.random() * 25;
  private eventLeft = 0;
  private eventLevel = 0;
  private flashT = 6;
  private rnd = mulberry32(777);
  private drops: Drop[] = [];
  private flakes: Flake[] = [];
  private leaves: Leaf[] = [];
  private off: HTMLCanvasElement | null = null;
  private time = 0;

  constructor() {
    const r = this.rnd;
    for (let i = 0; i < N_DROPS; i++) this.drops.push(this.newDrop(true, 1280));
    for (let i = 0; i < N_FLAKES; i++) this.flakes.push({ x: r() * 1280, y: r() * WORLD_H, vy: 28 + r() * 60, ph: r() * 6, size: 1.2 + r() * 2.6 });
    for (let i = 0; i < N_LEAVES; i++) this.leaves.push({ x: r() * 1280, y: r() * WORLD_H, vy: 30 + r() * 45, ph: r() * 6, rot: r() * 6, size: 4 + r() * 4, col: LEAF_COLS[i % LEAF_COLS.length] });
  }

  get current() { return SEASONS[this.season]; }
  get label() {
    const s = this.current;
    const extra = this.rain > 0.2 ? ' · Rain' : this.snow > 0.55 ? ' · Snowing' : '';
    return `${s.icon} ${s.name}${extra}`;
  }

  set(i: number) {
    this.season = ((i % SEASONS.length) + SEASONS.length) % SEASONS.length;
    this.seasonT = 0;
  }

  next() {
    this.season = (this.season + 1) % SEASONS.length;
    this.seasonT = 0;
  }

  private newDrop(init: boolean, w: number): Drop {
    const r = this.rnd;
    const landY = HORIZON + 10 + Math.pow(r(), 0.8) * (WORLD_H - HORIZON - 10);
    const depth = 0.4 + 0.6 * ((landY - HORIZON) / (WORLD_H - HORIZON));
    return { x: r() * (w + 120) - 20, y: init ? r() * WORLD_H : -20 - r() * 100, spd: (700 + r() * 400) * (0.7 + depth * 0.4), landY, splash: -1, depth };
  }

  update(dt: number, viewW: number) {
    this.time += dt;
    this.seasonT += dt;
    if (this.seasonT >= SEASON_LEN) {
      if (this.auto) { this.season = (this.season + 1) % SEASONS.length; this.seasonT = 0; }
      else this.seasonT = SEASON_LEN - BLEND - 1; // hold the chosen season
    }
    const winter = this.season === 3;
    const r = this.rnd;

    // periodic downpours (snowstorms in winter)
    if (this.eventLeft > 0) {
      this.eventLeft -= dt;
      if (this.eventLeft <= 0) { this.eventLevel = 0; this.eventT = (this.season === 1 ? 80 : 45) + r() * 55; }
    } else {
      this.eventT -= dt;
      if (this.eventT <= 0) { this.eventLeft = 24 + r() * 22; this.eventLevel = 0.6 + r() * 0.4; }
    }
    this.rain = approach(this.rain, winter ? 0 : this.eventLevel, dt * 0.35);
    this.snow = approach(this.snow, winter ? Math.max(0.38, this.eventLevel) : 0, dt * 0.3);
    this.leafLevel = approach(this.leafLevel, this.season === 2 ? 0.8 : this.season === 0 ? 0.5 : 0, dt * 0.3);
    this.snowCover = approach(this.snowCover, winter && this.seasonT > 6 ? 1 : 0, dt * (winter ? 0.03 : 0.045));

    // lightning in heavy rain
    this.flash = Math.max(0, this.flash - dt * 2.4);
    if (this.rain > 0.7) {
      this.flashT -= dt;
      if (this.flashT <= 0) {
        this.flashT = 7 + r() * 12;
        this.flash = 1;
        this.thunder = true;
      }
    }

    // particles
    const wind = -140;
    const nd = Math.floor(N_DROPS * this.rain);
    for (let i = 0; i < nd; i++) {
      const d = this.drops[i];
      if (d.splash >= 0) {
        d.splash += dt;
        if (d.splash > 0.3) Object.assign(d, this.newDrop(false, viewW));
        continue;
      }
      d.y += d.spd * dt;
      d.x += wind * dt * d.depth;
      if (d.y >= d.landY) { d.y = d.landY; d.splash = 0; }
    }
    const nf = Math.floor(N_FLAKES * this.snow);
    for (let i = 0; i < nf; i++) {
      const f = this.flakes[i];
      f.y += f.vy * dt;
      f.x += Math.sin(this.time * 0.9 + f.ph) * 18 * dt - 14 * dt;
      if (f.y > WORLD_H + 8) { f.y = -8; f.x = r() * (viewW + 60); }
      if (f.x < -20) f.x += viewW + 40;
    }
    const nl = Math.floor(N_LEAVES * this.leafLevel);
    const petals = this.season === 0;
    for (let i = 0; i < nl; i++) {
      const l = this.leaves[i];
      l.y += l.vy * dt;
      l.x += Math.sin(this.time * 1.2 + l.ph) * 40 * dt - 20 * dt;
      l.rot += dt * 2;
      if (l.y > WORLD_H + 10) {
        l.y = -10; l.x = r() * (viewW + 60);
        l.col = petals ? PETAL_COLS[Math.floor(r() * PETAL_COLS.length)] : LEAF_COLS[Math.floor(r() * LEAF_COLS.length)];
      }
      if (l.x < -20) l.x += viewW + 40;
    }
  }

  /** White snow blanket on the ground (not on water or lava). */
  drawSnowCover(ctx: CanvasRenderingContext2D, pxW: number, pxH: number, k: number, camX: number, viewW: number, cover: number, holes: Blob[]) {
    if (cover < 0.02) return;
    const oc = this.off ?? (this.off = document.createElement('canvas'));
    if (oc.width !== pxW || oc.height !== pxH) { oc.width = pxW; oc.height = pxH; }
    const o = oc.getContext('2d');
    if (!o) return;
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.clearRect(0, 0, pxW, pxH);
    o.setTransform(k, 0, 0, k, 0, 0);
    const g = o.createLinearGradient(0, HORIZON, 0, WORLD_H);
    g.addColorStop(0, `rgba(238,246,255,${0.78 * cover})`);
    g.addColorStop(1, `rgba(214,232,250,${0.7 * cover})`);
    o.fillStyle = g;
    o.fillRect(0, HORIZON, viewW, WORLD_H - HORIZON);
    // drifts
    o.fillStyle = `rgba(255,255,255,${0.7 * cover})`;
    const CELL = 90;
    for (let c = Math.floor((camX - 60) / CELL); c <= Math.floor((camX + viewW + 60) / CELL); c++) {
      for (let j = 0; j < 2; j++) {
        const x = c * CELL + hash01(c, 40 + j) * CELL - camX;
        const y = HORIZON + 20 + hash01(c, 50 + j) * (WORLD_H - HORIZON - 30);
        const rx = (18 + hash01(c, 60 + j) * 40) * (0.6 + (y - HORIZON) / (WORLD_H - HORIZON) * 0.7);
        o.beginPath();
        o.ellipse(x, y, rx, rx * 0.22, 0, 0, Math.PI * 2);
        o.fill();
      }
    }
    o.globalCompositeOperation = 'destination-out';
    o.fillStyle = '#000';
    for (const b of holes) {
      o.beginPath();
      o.ellipse(b.x - camX, b.y, b.rx * 1.08 + 7, b.ry * 1.12 + 5, 0, 0, Math.PI * 2);
      o.fill();
    }
    o.globalCompositeOperation = 'source-over';
    ctx.drawImage(oc, 0, 0, viewW, WORLD_H);
  }

  /** Season tint, darkening, lightning and the falling particles (screen space). */
  drawOverlay(ctx: CanvasRenderingContext2D, viewW: number) {
    // season tint with cross-fade
    const blend = clamp((this.seasonT - (SEASON_LEN - BLEND)) / BLEND, 0, 1);
    const a = SEASONS[this.season].tint;
    const b = SEASONS[(this.season + 1) % SEASONS.length].tint;
    const c = [lerp(a[0], b[0], blend), lerp(a[1], b[1], blend), lerp(a[2], b[2], blend), lerp(a[3], b[3], blend)];
    ctx.fillStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${c[3]})`;
    ctx.fillRect(0, 0, viewW, WORLD_H);
    const autumn = (this.season === 2 ? 1 - blend : 0) + (this.season === 1 ? blend : 0);
    if (autumn > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = `rgba(255,120,20,${0.5 * autumn})`;
      ctx.fillRect(0, 0, viewW, WORLD_H);
      ctx.restore();
    }
    // storm gloom
    const gloom = Math.max(this.rain * 0.3, this.snow > 0.6 ? (this.snow - 0.6) * 0.2 : 0);
    if (gloom > 0.01) {
      ctx.fillStyle = `rgba(28,48,78,${gloom})`;
      ctx.fillRect(0, 0, viewW, WORLD_H);
    }

    // rain
    const nd = Math.floor(N_DROPS * this.rain);
    ctx.lineCap = 'round';
    for (let i = 0; i < nd; i++) {
      const d = this.drops[i];
      if (d.x > viewW + 40) continue;
      if (d.splash >= 0) {
        const f = d.splash / 0.3;
        ctx.strokeStyle = `rgba(235,248,255,${0.7 * (1 - f) * d.depth})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, (3 + f * 9) * d.depth, (1 + f * 3) * d.depth, 0, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      const len = 0.035 * d.depth;
      ctx.strokeStyle = `rgba(220,238,255,${0.35 + 0.35 * d.depth})`;
      ctx.lineWidth = 1 + d.depth * 0.9;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 140 * len * d.depth, d.y - d.spd * len);
      ctx.stroke();
    }

    // snow
    const nf = Math.floor(N_FLAKES * this.snow);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < nf; i++) {
      const f = this.flakes[i];
      if (f.x > viewW + 20) continue;
      ctx.globalAlpha = 0.55 + f.size * 0.12;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // leaves / petals
    const nl = Math.floor(N_LEAVES * this.leafLevel);
    for (let i = 0; i < nl; i++) {
      const l = this.leaves[i];
      if (l.x > viewW + 20) continue;
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rot);
      ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(l.rot * 0.7 + l.ph)));
      ctx.fillStyle = l.col;
      ctx.beginPath();
      ctx.ellipse(0, 0, l.size, l.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // lightning
    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(235,240,255,${this.flash * 0.45})`;
      ctx.fillRect(0, 0, viewW, WORLD_H);
    }
  }
}
