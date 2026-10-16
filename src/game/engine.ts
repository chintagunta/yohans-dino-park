import { SPECIES, ERAS, variantOf } from './species';
import { audio } from './audio';
import { Weather } from './weather';
import { DayNight } from './daynight';
import type { TimeMode } from './daynight';
import type { DinoState, Era, Food, Pose, Species, Tool } from './types';
import { drawDino, makePose } from './draw/dino';
import { drawDecor } from './draw/flora';
import { drawBackdrop, drawForeground, drawGround, drawLiquidFx, ensureGround } from './draw/scene';
import { approach, clamp, ellipse, lerp, mulberry32, roundRect } from './draw/util';
import {
  CHUNK, ERA_ORDER, GROUND_MAX, GROUND_MIN, HORIZON, REGION_W, WORLD_H, blocked, chunkOf, depthScale, getChunk, inWater,
  liquidAt, liquidsIn, nearestRegionOfEra, pruneChunks, randomWaterPoint, regionInfo, regionOf, volcanoNear, zoneAt,
} from './world';

/* -------------------------------------------------------------------------- */
/*  Public types                                                              */
/* -------------------------------------------------------------------------- */

export interface Stats { fed: number; pets: number; discovered: number; total: number }
export interface ViewItem { id: string; count: number }
export interface DinoInfo {
  id: number;
  sp: Species;
  stateLabel: string;
  fullness: number;
  mood: number;
  moodLabel: string;
  fed: number;
  pets: number;
  following: boolean;
}
export interface Callbacks {
  onSelect: (info: DinoInfo | null) => void;
  onView: (items: ViewItem[]) => void;
  onDiscover: (sp: Species) => void;
  onStats: (s: Stats) => void;
  onZone: (era: Era, name: string) => void;
  onToast: (msg: string) => void;
  onSeason?: (label: string, index: number) => void;
}

interface Bubble { text: string; t: number }
interface Dino {
  id: number;
  sp: Species;
  x: number; y: number; z: number;
  vx: number; vy: number;
  face: 1 | -1;
  state: DinoState;
  stateT: number;
  tx: number; ty: number; tz: number;
  pose: Pose;
  scale: number;
  hunger: number;
  affection: number;
  home: { x: number; y: number };
  leash: number;
  food: Food | null;
  think: number;
  refuseCd: number;
  petCd: number;
  petHold: number;
  blinkT: number;
  fed: number;
  pets: number;
  bubble: Bubble | null;
  bubbleCd: number;
  roar: number;
  life: number;
  blockedFlag: boolean;
  fx: number; // particle timer
  waypoints: number;
  stepIdx: number;
  look: Species;
  panic: number;
}
interface HerdMember { dx: number; dy: number; ph: number; sc: number; look: Species; pose: Pose }
interface Herd {
  air: boolean; x: number; y: number; dir: 1 | -1; speed: number; age: number; members: HerdMember[];
}
interface Crack { x: number; y: number; len: number; seed: number }
interface Particle {
  x: number; y: number; vx: number; vy: number; g: number;
  life: number; max: number;
  kind: 'heart' | 'text' | 'crumb' | 'spark' | 'ring' | 'zzz';
  size: number; color: string; text?: string;
}

const STATE_LABEL: Record<DinoState, string> = {
  idle: 'Relaxing', walk: 'Wandering', graze: 'Grazing', sleep: 'Sleeping', swim: 'Swimming', goFood: 'Spotted food!',
  eat: 'Munching', pet: 'Loving the pets!', refuse: 'No thanks!', fly: 'Soaring', land: 'Coming in to land', perch: 'Perched',
};

const eatsGrass = (s: Species) => s.diet === 'herbivore' || s.diet === 'omnivore';
const eatsMeat = (s: Species) => s.diet === 'carnivore' || s.diet === 'piscivore' || s.diet === 'omnivore';

/* -------------------------------------------------------------------------- */

export class Engine {
  private ctx: CanvasRenderingContext2D;
  private populated = new Set<number>();
  private pending: { id: string; until: number } | null = null;
  private popT = 0;
  private weather = new Weather();
  private dn = new DayNight();
  private seasonLabel = '';
  private herds: Herd[] = [];
  private herdT = 2;
  private quake = { t: 0, dur: 0, mag: 0 };
  private quakeT = 40 + Math.random() * 30;
  private cracks: Crack[] = [];
  private dinos: Dino[] = [];
  private foods: Food[] = [];
  private parts: Particle[] = [];
  private rnd = mulberry32(1234);
  private raf = 0;
  private last = 0;
  private time = 0;
  private nextId = 1;

  private camX = 0;
  private targetCam = 0;
  private zoom = 1;
  private viewW = 1280;
  private cssW = 1280;
  private cssH = 720;
  private dpr = 1;

  private tool: Tool = 'look';
  private labels = false;
  private selected: Dino | null = null;
  private follow: Dino | null = null;
  private hover: Dino | null = null;
  private keys = { left: false, right: false };
  private discovered = new Set<string>();
  private stats: Stats = { fed: 0, pets: 0, discovered: 0, total: SPECIES.length };
  private viewSig = '';
  private viewT = 0;
  private infoT = 0;
  private zoneId = '';
  private mini: HTMLCanvasElement | null = null;
  private miniT = 0;

  private down: { sx: number; sy: number; cam: number; moved: boolean; pet: boolean } | null = null;
  private petTarget: Dino | null = null;
  private pointer = { x: 0, y: 0 };
  private disposers: (() => void)[] = [];

  constructor(private canvas: HTMLCanvasElement, private cb: Callbacks) {
    this.ctx = canvas.getContext('2d')!;
    this.bind();
    this.resize();
    this.camX = this.targetCam = 700 - this.viewW / 2;
    this.populate();
    this.pushStats();
  }

  /* ------------------------------------------------------------- lifecycle */

  start() {
    const loop = (ts: number) => {
      const dt = Math.min(0.05, (ts - this.last) / 1000 || 0.016);
      this.last = ts;
      try {
        this.tick(dt);
        this.render();
      } catch (err) {
        console.error('[dino-park] frame error', err);
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame((ts) => {
      this.last = ts;
      loop(ts);
    });
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.disposers.forEach((d) => d());
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cssW = r.width;
    this.cssH = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.zoom = this.cssH / WORLD_H;
    this.viewW = this.cssW / this.zoom;
  }

  /* ------------------------------------------------------------- UI hooks  */

  setTool(t: Tool) { this.tool = t; this.canvas.style.cursor = this.cursorFor(null); }
  setLabels(v: boolean) { this.labels = v; }
  setMinimap(c: HTMLCanvasElement | null) { this.mini = c; }
  setKey(dir: 'left' | 'right', down: boolean) { this.keys[dir] = down; if (down) this.follow = null; }
  panBy(dx: number) { this.follow = null; this.targetCam += dx; }
  jumpTo(x: number) { this.follow = null; this.targetCam = x - this.viewW / 2; }
  jumpZone(era: Era) {
    const r = nearestRegionOfEra(era, this.camX + this.viewW / 2);
    this.jumpTo(r.r * REGION_W + (r.volcano ? CHUNK * 0.5 + 520 : REGION_W / 2));
  }
  private static readonly MINI_SPAN = 7200;
  minimapClick(frac: number) { this.jumpTo(this.camX + this.viewW / 2 + (frac - 0.5) * Engine.MINI_SPAN); }

  selectSpecies(id: string) {
    const cx = this.camX + this.viewW / 2;
    let best: Dino | null = null;
    for (const d of this.dinos) if (d.sp.id === id && (!best || Math.abs(d.x - cx) < Math.abs(best.x - cx))) best = d;
    if (best && Math.abs(best.x - cx) < CHUNK * 2.5) {
      this.select(best);
      this.jumpTo(best.x);
      return;
    }
    // not nearby: head to a region of the species' era and look there
    const sp = SPECIES.find((q) => q.id === id)!;
    this.cb.onToast(`Searching for ${sp.name}…`);
    this.pending = { id, until: this.time + 12 };
    this.jumpZone(sp.era);
  }
  toggleFollow() {
    if (!this.selected) return;
    this.follow = this.follow === this.selected ? null : this.selected;
    this.emitSelected();
  }
  deselect() { this.select(null); }
  setTimeMode(m: TimeMode) { this.dn.setMode(m); }
  nextSeason() { this.weather.next(); }
  setSeason(i: number) { this.weather.set(i); }
  setAutoSeason(on: boolean) { this.weather.auto = on; }
  triggerQuake() { this.startQuake(0.6 + this.rnd() * 0.4); }

  getInfo(): DinoInfo | null {
    const d = this.selected;
    if (!d) return null;
    const fullness = 1 - d.hunger;
    const mood = clamp(0.5 + d.affection * 0.5 - Math.max(0, d.hunger - 0.5) * 0.9, 0, 1);
    const moodLabel = d.state === 'sleep' ? 'Sleepy' : mood > 0.85 ? 'Delighted' : mood > 0.62 ? 'Happy' : mood > 0.4 ? 'Content' : 'Hungry';
    let stateLabel = STATE_LABEL[d.state];
    if (d.state === 'graze' && !eatsGrass(d.sp)) stateLabel = 'Sniffing around';
    if (d.state === 'graze' && eatsGrass(d.sp)) stateLabel = 'Grazing';
    return { id: d.id, sp: d.sp, stateLabel, fullness, mood, moodLabel, fed: d.fed, pets: d.pets, following: this.follow === d };
  }

  /* ----------------------------------------------------------------- spawn */

  private populate() {
    const cx = this.camX + this.viewW / 2;
    const c = chunkOf(cx);
    for (let ci = c - 3; ci <= c + 3; ci++) {
      if (this.populated.has(ci)) continue;
      this.populated.add(ci);
      this.spawnChunk(ci);
    }
    for (const ci of [...this.populated]) if (Math.abs(ci - c) > 4) this.populated.delete(ci);
    this.dinos = this.dinos.filter((d) => d === this.selected || d === this.follow || Math.abs(d.x - cx) < CHUNK * 5);
    this.foods = this.foods.filter((f) => Math.abs(f.x - cx) < CHUNK * 5);
    pruneChunks(c, 8);
  }

  private spawnChunk(ci: number) {
    const ch = getChunk(ci);
    const rnd = mulberry32((Math.random() * 1e9) | 0);
    const existing = this.dinos.filter((d) => chunkOf(d.x) === ci).length;
    if (existing >= 2 || this.dinos.length > 90) return;
    const hasWater = ch.liquids.some((l) => l.kind === 'water');
    const groups = 2 + (rnd() < 0.6 ? 1 : 0) + (rnd() < 0.25 ? 1 : 0);
    const land = SPECIES.filter((s) => !s.aquatic);
    const aquatic = SPECIES.filter((s) => s.aquatic);
    for (let g = 0; g < groups; g++) {
      let sp: Species;
      if (hasWater && g === 0 && rnd() < 0.7) {
        const w = aquatic.map((s) => (s.era === ch.era ? 3 : 1));
        let r = rnd() * w.reduce((x, y) => x + y, 0);
        sp = aquatic[0];
        for (let i = 0; i < aquatic.length; i++) {
          r -= w[i];
          if (r <= 0) { sp = aquatic[i]; break; }
        }
      }
      else {
        const w = land.map((s) => (s.era === ch.era ? 3 : 0.7) * (s.flies ? 1.1 : 1) * (s.id === 'tyrannosaurus' ? 2.2 : 1) * (ch.volcano && s.era === 'jurassic' ? 1.3 : 1));
        let r = rnd() * w.reduce((a, b) => a + b, 0);
        sp = land[0];
        for (let i = 0; i < land.length; i++) {
          r -= w[i];
          if (r <= 0) { sp = land[i]; break; }
        }
      }
      const count = sp.count > 1 ? sp.count : sp.length < 4 ? 2 + Math.floor(rnd() * 2) : rnd() < 0.25 ? 2 : 1;
      const hx = ch.x0 + 140 + rnd() * (CHUNK - 280);
      for (let i = 0; i < count; i++) this.spawn(sp, hx + i * 70, rnd);
    }
  }

  private spawn(sp: Species, hx: number, rnd: () => number) {
    let x = hx, y = lerp(GROUND_MIN + 20, GROUND_MAX - 10, rnd());
    if (sp.aquatic) {
      const p = randomWaterPoint(rnd, hx, 600);
      if (!p) return;
      x = p.x; y = p.y;
    } else {
      for (let k = 0; k < 40 && (blocked(x, y, 1.2) || inWater(x, y, 1.15)); k++) {
        x = hx + (rnd() - 0.5) * 500;
        y = lerp(GROUND_MIN + 20, GROUND_MAX - 10, rnd());
      }
    }
    const deg = rnd() < 0.45 ? 0 : (rnd() < 0.5 ? -1 : 1) * Math.round(30 + rnd() * 120);
    const light = deg === 0 ? 0 : Math.round((rnd() - 0.5) * 10) / 100;
    const d: Dino = {
      id: this.nextId++, sp, look: variantOf(sp, deg, light), x, y, z: sp.flies ? 130 + rnd() * 150 : 0, vx: 0, vy: 0, face: rnd() > 0.5 ? 1 : -1,
      state: sp.flies ? 'fly' : 'idle', stateT: rnd() * 3, tx: x, ty: y, tz: 0, pose: makePose({ phase: rnd() * 6 }),
      scale: 0.9 + rnd() * 0.2, hunger: 0.2 + rnd() * 0.5, affection: 0.2, home: { x: hx, y }, leash: sp.flies ? 900 : 480,
      food: null, think: rnd(), refuseCd: 0, petCd: 0, petHold: 0, blinkT: 1 + rnd() * 3, fed: 0, pets: 0, bubble: null,
      bubbleCd: 6 + rnd() * 10, roar: 0, life: rnd() * 10, blockedFlag: false, fx: 0, waypoints: 0, stepIdx: 0, panic: 0,
    };
    if (sp.flies) this.pickFly(d);
    this.dinos.push(d);
  }

  /* ------------------------------------------------------------------- sim */

  private tick(dt: number) {
    this.time += dt;
    // camera
    const dir = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    if (dir) this.targetCam += dir * 650 * dt;
    if (this.follow) this.targetCam = this.follow.x - this.viewW / 2;
    if (!this.down?.moved) this.camX += (this.targetCam - this.camX) * Math.min(1, dt * 6);

    for (const d of this.dinos) this.updateDino(d, dt);
    this.updateAudio(dt);
    this.updateHerds(dt);
    this.updateQuake(dt);
    this.weather.update(dt, this.viewW);
    this.dn.update(dt);
    if (this.weather.thunder) { this.weather.thunder = false; audio.thunder(); }
    const lab = this.weather.label;
    if (lab !== this.seasonLabel) { this.seasonLabel = lab; this.cb.onSeason?.(lab, this.weather.season); }
    this.popT -= dt;
    if (this.popT <= 0) {
      this.popT = 0.5;
      this.populate();
      if (this.pending) {
        const cx = this.camX + this.viewW / 2;
        const hit = this.dinos.find((d) => d.sp.id === this.pending!.id && Math.abs(d.x - cx) < this.viewW * 0.9);
        if (hit) { this.select(hit); this.jumpTo(hit.x); this.pending = null; }
        else if (this.time > this.pending.until) { this.cb.onToast('Keep exploring, it is out there somewhere!'); this.pending = null; }
      }
    }
    for (const f of this.foods) { f.age += dt; f.pop = Math.min(1, f.pop + dt * 3.5); }
    this.foods = this.foods.filter((f) => f.bites > 0 && f.age < 90);

    for (const p of this.parts) {
      p.life -= dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);

    // continuous petting
    if (this.petTarget && this.down) this.petDino(this.petTarget, false);

    // view tracking
    this.viewT -= dt;
    if (this.viewT <= 0) { this.viewT = 0.3; this.updateView(); }
    this.infoT -= dt;
    if (this.infoT <= 0) { this.infoT = 0.25; this.emitSelected(); }
    const z = zoneAt(this.camX + this.viewW / 2);
    if (z.name !== this.zoneId) { this.zoneId = z.name; this.cb.onZone(z.era, z.name); }
  }

  private emitSelected() { this.cb.onSelect(this.getInfo()); }
  private pushStats() { this.stats.discovered = this.discovered.size; this.cb.onStats({ ...this.stats }); }

  private updateView() {
    const x0 = this.camX + 10, x1 = this.camX + this.viewW - 10;
    const counts = new Map<string, number>();
    const order: { id: string; x: number }[] = [];
    for (const d of this.dinos) {
      if (d.x < x0 || d.x > x1) continue;
      if (!counts.has(d.sp.id)) order.push({ id: d.sp.id, x: d.x });
      counts.set(d.sp.id, (counts.get(d.sp.id) ?? 0) + 1);
      if (!this.discovered.has(d.sp.id)) {
        this.discovered.add(d.sp.id);
        this.cb.onDiscover(d.sp);
        audio.chime();
        this.pushStats();
      }
    }
    order.sort((a, b) => a.x - b.x);
    const items = order.map((o) => ({ id: o.id, count: counts.get(o.id)! }));
    const sig = items.map((i) => i.id + i.count).join(',');
    if (sig !== this.viewSig) { this.viewSig = sig; this.cb.onView(items); }
  }

  private say(d: Dino, text: string, t = 1.8) { d.bubble = { text, t }; }
  private onScreen(d: Dino) { return d.x > this.camX - 60 && d.x < this.camX + this.viewW + 60; }
  private pan(x: number) { return clamp(((x - this.camX) / this.viewW) * 2 - 1, -1, 1); }
  private audioT = 0;
  private updateAudio(dt: number) {
    this.audioT -= dt;
    if (this.audioT > 0) return;
    this.audioT = 0.2;
    const c = this.camX + this.viewW / 2;
    let water = 0, lava = 0;
    for (const l of liquidsIn(c - 1500, c + 1500)) {
      for (const b of l.blobs) {
        const d = Math.max(0, Math.abs(b.x - c) - b.rx - this.viewW * 0.25);
        const v = clamp(1 - d / 600, 0, 1);
        if (l.kind === 'water') water = Math.max(water, v);
        else lava = Math.max(lava, v);
      }
    }
    const vn = volcanoNear(c);
    const volc = vn ? clamp(1 - Math.abs(vn.vx - c) / 1500, 0, 1) : 0;
    const zi = ERA_ORDER.indexOf(zoneAt(c).era);
    audio.update(c, this.time, water, lava, volc, zi, vn ? vn.vseed : 0);
    audio.setWeather(this.weather.rain, this.weather.snow);
    audio.setNight(this.dn.night);
  }

  private updateDino(d: Dino, dt: number) {
    const sp = d.sp;
    const rnd = this.rnd;
    const p = d.pose;
    d.life += dt;
    d.hunger = Math.min(1, d.hunger + dt * 0.0055);
    d.affection = Math.max(0, d.affection - dt * 0.008);
    d.refuseCd -= dt;
    d.petCd -= dt;
    d.stateT -= dt;
    d.think -= dt;
    d.bubbleCd -= dt;
    d.roar = Math.max(0, d.roar - dt);
    if (d.bubble && (d.bubble.t -= dt) <= 0) d.bubble = null;
    d.blinkT -= dt;
    if (d.blinkT <= 0) { p.blink = 1; d.blinkT = 2 + rnd() * 4; }
    p.blink = Math.max(0, p.blink - dt * 7);
    d.petHold = Math.max(0, d.petHold - dt);
    if (d.panic > 0) {
      d.panic -= dt;
      if (!sp.flies && !sp.aquatic && (d.state === 'idle' || d.state === 'graze' || d.state === 'sleep' || d.state === 'refuse') && this.pickWander(d)) this.enter(d, 'walk', 3 + rnd() * 2);
    }

    const inW = inWater(d.x, d.y, 0.97);
    const wantSwim = (sp.aquatic || sp.swims) && inW && d.z < 2 ? 1 : 0;
    p.swim = approach(p.swim, wantSwim, dt * 2.5);

    // ----- food awareness
    if (d.think <= 0) {
      d.think = 0.4;
      this.lookForFood(d);
    }
    // hungry hint
    if (d.bubbleCd <= 0 && !d.bubble && d.hunger > 0.78 && (d.state === 'idle' || d.state === 'walk' || d.state === 'graze')) {
      this.say(d, eatsMeat(sp) && !eatsGrass(sp) ? '🍖' : eatsGrass(sp) && !eatsMeat(sp) ? '🌿' : '🍖🌿', 2.4);
      d.bubbleCd = 14;
    }

    let speed = 0; // px/s actually moved this frame (for animation)
    const S = sp.size * d.scale * depthScale(d.y);
    let headT = 0, jawT = 0;

    switch (d.state) {
      case 'idle':
        if (sp.flies) { this.pickFly(d); break; }
        if (d.stateT <= 0) this.choose(d);
        if (sp.diet === 'carnivore' && !sp.flies && d.stateT > 0 && d.roar <= 0 && rnd() < dt * 0.02) { d.roar = 1; this.say(d, 'RAWR!', 1.2); if (this.onScreen(d)) audio.roar(S, this.pan(d.x)); }
        break;
      case 'walk': {
        const dist = this.moveTo(d, d.tx, d.ty, sp.speed * d.scale * (p.swim > 0.5 ? 0.6 : 1) * (d.panic > 0 ? 2.3 : 1), dt);
        speed = Math.hypot(d.vx, d.vy);
        if (dist < 10 || d.blockedFlag || d.stateT <= 0) this.enter(d, 'idle', 0.6 + rnd() * 2.5);
        break;
      }
      case 'swim': {
        const dist = this.moveTo(d, d.tx, d.ty, sp.speed * d.scale * 0.55, dt);
        speed = Math.hypot(d.vx, d.vy);
        if (dist < 12 || d.blockedFlag || d.stateT <= 0) this.enter(d, 'idle', 2 + rnd() * 5);
        break;
      }
      case 'graze':
        headT = 1;
        jawT = 0.25 + 0.2 * Math.abs(Math.sin(d.life * 6));
        if (eatsGrass(sp)) d.hunger = Math.max(0, d.hunger - dt * 0.02);
        if (d.stateT <= 0) this.choose(d);
        break;
      case 'sleep':
        if (Math.sin(d.life * 2) > 0.995 || (d.fx -= dt) <= 0) {
          d.fx = 1.6;
          this.spawnPart({ x: d.x + d.face * S * 0.3, y: d.y - S * sp.hitH * 0.6, vx: 8, vy: -16, g: 0, life: 2.2, max: 2.2, kind: 'zzz', size: 13 + rnd() * 5, color: '#ffffff' });
        }
        d.hunger = Math.max(0, d.hunger - dt * 0.001);
        if (d.stateT <= 0) this.enter(d, 'idle', 1);
        break;
      case 'goFood': {
        const f = d.food;
        if (!f || !this.foods.includes(f)) { this.enter(d, 'idle', 0.5); break; }
        const reach = S * (0.28 + (sp.shape.kind === 'quad' ? sp.shape.neck.len * 0.45 : 0.04));
        const side = Math.sign(d.x - f.x) || 1;
        const gx = f.x + side * reach, gy = f.y;
        const dist = Math.hypot(gx - d.x, (gy - d.y) * 2);
        if (sp.flies) {
          d.z = approach(d.z, dist < 220 ? 0 : d.z, dt * 70);
        }
        this.moveTo(d, gx, gy, sp.speed * d.scale * 1.7, dt);
        speed = Math.hypot(d.vx, d.vy);
        if (dist < 14 && d.z < 3) {
          d.face = (f.x > d.x ? 1 : -1);
          this.enter(d, 'eat', 99);
          d.fx = 0.7;
        } else if (d.blockedFlag) { d.food = null; this.enter(d, 'idle', 0.5); }
        break;
      }
      case 'eat': {
        const f = d.food;
        headT = 1;
        jawT = 0.3 + 0.35 * Math.abs(Math.sin(d.life * 9));
        if (!f || !this.foods.includes(f)) { this.enter(d, 'idle', 1); break; }
        d.fx -= dt;
        if (d.fx <= 0) {
          d.fx = 0.85;
          f.bites--;
          if (this.onScreen(d)) audio.crunch(f.kind, this.pan(d.x));
          d.hunger = Math.max(0, d.hunger - 0.17);
          d.affection = Math.min(1, d.affection + 0.05);
          for (let i = 0; i < 6; i++) {
            this.spawnPart({
              x: f.x, y: f.y - 6, vx: (rnd() - 0.5) * 70, vy: -50 - rnd() * 50, g: 260, life: 0.7, max: 0.7, kind: 'crumb',
              size: 2 + rnd() * 2, color: f.kind === 'grass' ? (rnd() > 0.5 ? '#79d055' : '#3f9a3a') : (rnd() > 0.5 ? '#d9573b' : '#8a2c20'),
            });
          }
          if (f.bites <= 0) {
            d.fed++;
            this.stats.fed++;
            this.pushStats();
            this.say(d, '😋', 2);
            if (this.onScreen(d)) audio.call(S, this.pan(d.x), 0.1);
            this.heartsAround(d, 3);
            d.food = null;
            this.enter(d, 'idle', 1.5);
          }
        }
        break;
      }
      case 'pet':
        headT = 0.55;
        jawT = 0;
        d.vx *= 0.8; d.vy *= 0.8;
        if (d.stateT <= 0 && d.petHold <= 0) this.enter(d, 'idle', 1.5);
        break;
      case 'refuse':
        headT = 0;
        if (d.stateT <= 0) this.enter(d, 'idle', 1);
        break;
      case 'fly': {
        const dx = d.tx - d.x, dy = d.ty - d.y;
        const dist = Math.hypot(dx, dy * 2);
        const sp2 = sp.speed * 2.6 * d.scale;
        const k = dist > 1 ? sp2 / dist : 0;
        d.vx += (dx * k - d.vx) * Math.min(1, dt * 1.5);
        d.vy += (dy * k * 0.5 - d.vy) * Math.min(1, dt * 1.5);
        d.x += d.vx * dt;
        d.y = clamp(d.y + d.vy * dt, GROUND_MIN, GROUND_MAX);
        d.z = approach(d.z, d.tz + Math.sin(d.life * 1.3) * 12, dt * 45);
        if (Math.abs(d.vx) > 4) d.face = d.vx > 0 ? 1 : -1;
        speed = 40;
        if (dist < 40) {
          d.waypoints++;
          if (d.waypoints % 4 === 0 && d.hunger > 0.3 || d.waypoints % 7 === 0) this.landSpot(d);
          else this.pickFly(d);
        }
        break;
      }
      case 'land': {
        const dx = d.tx - d.x, dy = d.ty - d.y;
        const dist = Math.hypot(dx, dy * 2);
        const k = dist > 1 ? (sp.speed * 1.6) / dist : 0;
        d.vx += (dx * k - d.vx) * Math.min(1, dt * 2);
        d.vy += (dy * k * 0.5 - d.vy) * Math.min(1, dt * 2);
        d.x += d.vx * dt;
        d.y = clamp(d.y + d.vy * dt, GROUND_MIN, GROUND_MAX);
        d.z = approach(d.z, 0, dt * (30 + Math.min(120, dist * 0.6)));
        if (Math.abs(d.vx) > 4) d.face = d.vx > 0 ? 1 : -1;
        speed = 40;
        if (d.z <= 1 && dist < 30) this.enter(d, 'perch', 7 + rnd() * 8);
        break;
      }
      case 'perch':
        d.vx *= 0.8; d.vy *= 0.8;
        if (d.stateT <= 0) { d.waypoints = 1; this.pickFly(d); d.state = 'fly'; }
        else if (rnd() < dt * 0.25) { headT = 0; }
        break;
    }

    // petted visuals
    const petting = d.state === 'pet';
    p.happy = approach(p.happy, petting ? 1 : 0, dt * 4);
    if (petting && (d.fx -= dt) <= 0 && d.state === 'pet') {
      d.fx = 0.28;
    }

    // visual smoothing
    p.headLower = approach(p.headLower, headT, dt * 2.6);
    p.jaw = approach(p.jaw, d.roar > 0 ? 1 : jawT, dt * 9);
    p.sleep = approach(p.sleep, d.state === 'sleep' ? 1 : 0, dt * 1.2);
    const moveAmt = d.state === 'fly' || d.state === 'land' ? 0 : clamp(speed / Math.max(10, sp.speed * d.scale * 1.1), 0, 1);
    p.moving = approach(p.moving, moveAmt * (p.swim > 0.5 ? 0.6 : 1), dt * 4);
    if (sp.flies) {
      const airborne = d.z > 6 || d.state === 'fly' || d.state === 'land';
      p.fold = approach(p.fold, airborne ? 0 : 1, dt * 3);
      const glide = Math.sin(d.life * 0.45 + d.id) > 0.55 && d.state === 'fly';
      p.flap = approach(p.flap, airborne ? (glide ? 0.25 : 1) : 0, dt * 3);
      p.phase += dt * (airborne ? (glide ? 4 : 9) : 0);
      if (!airborne) p.phase += dt * Math.min(12, Math.hypot(d.vx, d.vy) / (S * 0.08));
      p.moving = approach(p.moving, airborne ? 0 : clamp(Math.hypot(d.vx, d.vy) / 40, 0, 1), dt * 4);
    } else if (sp.shape.kind === 'turtle' || sp.shape.kind === 'marine') {
      p.phase += dt * (2.2 + Math.hypot(d.vx, d.vy) / 12);
      p.moving = approach(p.moving, clamp(Math.hypot(d.vx, d.vy) / 25, 0, 1), dt * 3);
    } else {
      const sv = Math.hypot(d.vx, d.vy * 1.8);
      p.phase += dt * Math.min(15, sv / Math.max(8, S * 0.075));
      const si = Math.floor(p.phase / Math.PI);
      if (si !== d.stepIdx) {
        d.stepIdx = si;
        if (p.moving > 0.35 && d.z < 2 && this.onScreen(d)) audio.step(S, this.pan(d.x), p.swim > 0.4, (d.y - GROUND_MIN) / (GROUND_MAX - GROUND_MIN));
      }
    }
    p.t = d.life;
    if (d.state !== 'goFood' && d.state !== 'walk' && d.state !== 'swim' && !sp.flies) { d.vx *= 0.85; d.vy *= 0.85; }
  }

  private enter(d: Dino, s: DinoState, t: number) {
    d.state = s;
    d.stateT = t;
    d.blockedFlag = false;
  }

  private moveTo(d: Dino, tx: number, ty: number, speed: number, dt: number): number {
    const dx = tx - d.x, dy = ty - d.y;
    const dist = Math.hypot(dx, dy);
    let wx = 0, wy = 0;
    if (dist > 2) {
      const k = speed / dist;
      wx = dx * k;
      wy = dy * k * 0.55;
    }
    const a = Math.min(1, dt * 4);
    d.vx += (wx - d.vx) * a;
    d.vy += (wy - d.vy) * a;
    const nx = d.x + d.vx * dt;
    const ny = clamp(d.y + d.vy * dt, GROUND_MIN, GROUND_MAX);
    d.blockedFlag = false;
    if (this.canStand(d, nx, ny)) { d.x = nx; d.y = ny; }
    else if (this.canStand(d, nx, d.y)) { d.x = nx; d.vy = 0; }
    else if (this.canStand(d, d.x, ny)) { d.y = ny; d.vx = 0; }
    else { d.vx = d.vy = 0; d.blockedFlag = true; }
    if (Math.abs(d.vx) > 3) d.face = d.vx > 0 ? 1 : -1;
    return dist;
  }

  private canStand(d: Dino, x: number, y: number) {
    if (blocked(x, y, 1.08)) return false;
    const w = inWater(x, y, 1.0);
    if (d.sp.aquatic) return inWater(x, y, 0.88);
    if (w && !d.sp.swims && !(d.sp.flies && d.z > 3)) return false;
    return true;
  }

  private pickWander(d: Dino): boolean {
    const rnd = this.rnd;
    for (let i = 0; i < 12; i++) {
      const x = d.home.x + (rnd() - 0.5) * 2 * d.leash;
      const y = lerp(GROUND_MIN, GROUND_MAX, rnd());
      if (blocked(x, y, 1.25) || inWater(x, y, 1.12)) continue;
      d.tx = x; d.ty = y;
      return true;
    }
    return false;
  }

  private pickFly(d: Dino) {
    const rnd = this.rnd;
    d.tx = d.home.x + (rnd() - 0.5) * 2 * d.leash;
    d.ty = lerp(GROUND_MIN, GROUND_MAX - 80, rnd());
    d.tz = 110 + rnd() * 190;
    d.state = 'fly';
  }

  private landSpot(d: Dino) {
    const rnd = this.rnd;
    for (let i = 0; i < 12; i++) {
      const x = d.x + (rnd() - 0.5) * 500;
      const y = lerp(GROUND_MIN + 10, GROUND_MAX - 20, rnd());
      if (liquidAt(x, y, 1.2)) continue;
      d.tx = x; d.ty = y;
      d.state = 'land';
      return;
    }
    this.pickFly(d);
  }

  private choose(d: Dino) {
    const sp = d.sp;
    const rnd = this.rnd;
    const r = rnd();
    if (sp.aquatic) {
      const w = randomWaterPoint(rnd, d.home.x);
      if (w && r < 0.75) { d.tx = w.x; d.ty = w.y; this.enter(d, 'swim', 14); }
      else this.enter(d, 'idle', 2 + rnd() * 4);
      return;
    }
    if (d.hunger < 0.6 && r < 0.12 + this.dn.night * 0.35) { this.enter(d, 'sleep', 14 + rnd() * 14); return; }
    if (sp.swims && r < 0.3) {
      const w = randomWaterPoint(rnd, d.home.x);
      if (w && Math.abs(w.x - d.x) < 800) { d.tx = w.x; d.ty = w.y; this.enter(d, 'swim', 16); return; }
    }
    if (r < 0.4) { this.enter(d, 'graze', 4 + rnd() * 6); return; }
    if (r < 0.52) { this.enter(d, 'idle', 2 + rnd() * 3); return; }
    if (this.pickWander(d)) this.enter(d, 'walk', 20);
    else this.enter(d, 'idle', 2);
  }

  private lookForFood(d: Dino) {
    const sp = d.sp;
    if (d.state === 'eat' || d.state === 'goFood' || d.state === 'pet' || d.state === 'refuse') return;
    if (d.state === 'sleep' && d.hunger < 0.5) return;
    let best: Food | null = null;
    let bestD = 1e9;
    const S = sp.size * d.scale * depthScale(d.y);
    for (const f of this.foods) {
      const dist = Math.hypot(f.x - d.x, (f.y - d.y) * 2);
      const w = inWater(f.x, f.y, 1);
      const match = f.kind === 'grass' ? eatsGrass(sp) : eatsMeat(sp);
      if (match) {
        const reachable = sp.aquatic ? w : !w || !!sp.swims || !!sp.flies;
        const range = d.state === 'sleep' ? 350 : 950;
        if (reachable && dist < range && dist < bestD) { best = f; bestD = dist; }
      } else if (dist < 120 + S * 0.4 && d.refuseCd <= 0 && !sp.aquatic) {
        d.refuseCd = 7;
        d.face = f.x > d.x ? 1 : -1;
        this.enter(d, 'refuse', 1.4);
        this.say(d, f.kind === 'meat' ? '🤢' : '🙅', 1.6);
        if (this.onScreen(d)) audio.snort(this.pan(d.x));
        for (let i = 0; i < 4; i++) this.spawnPart({ x: d.x + d.face * S * 0.3, y: d.y - S * 0.25, vx: (Math.random() - 0.5) * 60, vy: -30, g: 40, life: 0.8, max: 0.8, kind: 'spark', size: 3, color: '#cfd8c0' });
        return;
      }
    }
    if (best) {
      d.food = best;
      d.face = best.x > d.x ? 1 : -1;
      if (d.state === 'sleep') this.say(d, '❗', 1.2);
      this.enter(d, 'goFood', 30);
    }
  }

  private heartsAround(d: Dino, n: number) {
    const S = d.sp.size * d.scale * depthScale(d.y);
    for (let i = 0; i < n; i++) {
      this.spawnPart({
        x: d.x + d.face * S * 0.25 + (Math.random() - 0.5) * S * 0.3, y: d.y - d.z - S * d.sp.hitH * (0.75 + Math.random() * 0.2),
        vx: (Math.random() - 0.5) * 24, vy: -34 - Math.random() * 20, g: -4, life: 1.4, max: 1.4, kind: 'heart', size: 12 + Math.random() * 8,
        color: ['#ff5c8a', '#ff7aa8', '#ff3d6e'][i % 3],
      });
    }
  }

  private spawnPart(p: Particle) { if (this.parts.length < 400) this.parts.push(p); }

  /* ----------------------------------------------------------- interaction */

  private petDino(d: Dino, first: boolean) {
    if (d.sp.flies && d.z > 6) {
      if (first) { this.say(d, '❓', 1.4); this.landSpot(d); d.tx = d.x; d.ty = d.y; }
      return;
    }
    d.petHold = 0.35;
    if (d.state !== 'pet') {
      if (d.state === 'sleep') this.say(d, '❤️', 1.5);
      this.enter(d, 'pet', 1.2);
      d.food = null;
    }
    d.stateT = Math.max(d.stateT, 0.5);
    d.face = this.pointer.x >= d.x ? 1 : -1;
    if (d.petCd <= 0) {
      d.petCd = 0.4;
      d.pets++;
      if (d.pets % 2 === 1) audio.purr(this.pan(d.x));
      d.affection = Math.min(1, d.affection + 0.1);
      this.stats.pets++;
      this.heartsAround(d, 2);
      this.pushStats();
    }
  }

  private dropFood(kind: 'grass' | 'meat', x: number, y: number) {
    const fx = x;
    const fy = clamp(y, GROUND_MIN, GROUND_MAX);
    const l = liquidAt(fx, fy, 1);
    if (l?.kind === 'lava') {
      this.cb.onToast('Poof! The lava burned it up. 🔥');
      for (let i = 0; i < 8; i++) this.spawnPart({ x: fx, y: fy, vx: (Math.random() - 0.5) * 80, vy: -70, g: 120, life: 0.8, max: 0.8, kind: 'spark', size: 3, color: '#ff9a2a' });
      return;
    }
    if (this.foods.length >= 12) this.foods.shift();
    this.foods.push({ id: this.nextId++, kind, x: fx, y: fy, bites: 4, age: 0, pop: 0 });
    audio.pop(kind === 'grass');
    for (let i = 0; i < 7; i++) {
      this.spawnPart({ x: fx, y: fy - 8, vx: (Math.random() - 0.5) * 80, vy: -60 - Math.random() * 40, g: 240, life: 0.6, max: 0.6, kind: 'spark', size: 2.5, color: kind === 'grass' ? '#b6f08a' : '#ffd0a0' });
    }
  }

  private toWorld(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (clientX - r.left) / this.zoom + this.camX, y: (clientY - r.top) / this.zoom, sx: clientX - r.left, sy: clientY - r.top };
  }

  private hit(wx: number, wy: number): Dino | null {
    let best: Dino | null = null;
    for (const d of this.dinos) {
      const S = d.sp.size * d.scale * depthScale(d.y);
      const w = d.sp.hitW * S, h = d.sp.hitH * S;
      const yb = d.y - d.z;
      const cx = d.x + d.face * (d.sp.shape.kind === 'quad' ? 0 : 0);
      if (Math.abs(wx - cx) < w / 2 && wy < yb + 10 && wy > yb - h - 8) {
        if (!best || d.y > best.y) best = d;
      }
    }
    return best;
  }

  private select(d: Dino | null) {
    this.selected = d;
    if (d) audio.click();
    if (!d) this.follow = null;
    this.emitSelected();
  }

  private cursorFor(d: Dino | null) {
    if (this.tool === 'pet') return d ? 'grab' : 'default';
    if (this.tool === 'grass' || this.tool === 'meat') return 'copy';
    return d ? 'pointer' : 'grab';
  }

  private bind() {
    const c = this.canvas;
    const onDown = (e: PointerEvent) => {
      c.setPointerCapture(e.pointerId);
      const w = this.toWorld(e.clientX, e.clientY);
      this.pointer = { x: w.x, y: w.y };
      const d = this.hit(w.x, w.y);
      const pet = this.tool === 'pet' && !!d;
      this.down = { sx: e.clientX, sy: e.clientY, cam: this.camX, moved: false, pet };
      if (pet && d) { this.petTarget = d; this.petDino(d, true); this.select(d); c.style.cursor = 'grabbing'; }
    };
    const onMove = (e: PointerEvent) => {
      const w = this.toWorld(e.clientX, e.clientY);
      this.pointer = { x: w.x, y: w.y };
      if (this.down) {
        const dx = e.clientX - this.down.sx, dy = e.clientY - this.down.sy;
        if (!this.down.pet && !this.down.moved && Math.abs(dx) + Math.abs(dy) > 7) this.down.moved = true;
        if (this.down.moved) {
          this.follow = null;
          this.camX = this.down.cam - dx / this.zoom;
          this.targetCam = this.camX;
          c.style.cursor = 'grabbing';
        }
        if (this.down.pet) {
          const d = this.hit(w.x, w.y);
          if (d) this.petTarget = d;
        }
      } else {
        this.hover = this.hit(w.x, w.y);
        c.style.cursor = this.cursorFor(this.hover);
      }
    };
    const onUp = (e: PointerEvent) => {
      const dn = this.down;
      this.down = null;
      this.petTarget = null;
      c.style.cursor = this.cursorFor(this.hover);
      if (!dn || dn.moved || dn.pet) return;
      const w = this.toWorld(e.clientX, e.clientY);
      const d = this.hit(w.x, w.y);
      if (this.tool === 'look') this.select(d);
      else if (this.tool === 'pet') this.select(d);
      else {
        const kind = this.tool;
        if (d) {
          const S = d.sp.size * d.scale * depthScale(d.y);
          this.dropFood(kind, d.x + d.face * S * 0.34, d.y + 2);
          this.select(d);
        } else this.dropFood(kind, w.x, w.y);
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      this.panBy((Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 1.2);
    };
    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointermove', onMove);
    c.addEventListener('pointerup', onUp);
    c.addEventListener('pointercancel', onUp);
    const onLeave = () => { if (!this.down) this.hover = null; };
    c.addEventListener('pointerleave', onLeave);
    c.addEventListener('wheel', onWheel, { passive: false });
    this.disposers.push(() => {
      c.removeEventListener('pointerdown', onDown);
      c.removeEventListener('pointermove', onMove);
      c.removeEventListener('pointerup', onUp);
      c.removeEventListener('pointercancel', onUp);
      c.removeEventListener('wheel', onWheel);
      c.removeEventListener('pointerleave', onLeave);
    });
  }


  /* ------------------------------------------------------------ earthquakes */

  private startQuake(mag: number) {
    if (this.quake.t > 0) return;
    const dur = 3.5 + mag * 3;
    this.quake = { t: dur, dur, mag };
    this.cracks = [];
    for (let i = 0; i < 7; i++) {
      this.cracks.push({ x: this.camX + this.rnd() * this.viewW, y: lerp(GROUND_MIN + 10, GROUND_MAX - 10, this.rnd()), len: 60 + this.rnd() * 120, seed: this.rnd() * 100 });
    }
    this.cb.onToast('Earthquake! The ground is shaking! 🌋');
    audio.quake(mag, dur);
    const cx = this.camX + this.viewW / 2;
    for (const d of this.dinos) {
      if (Math.abs(d.x - cx) > this.viewW * 1.1 || d.sp.aquatic) continue;
      d.panic = dur + 2.5;
      if (d.state === 'sleep') this.enter(d, 'idle', 0.1);
      if (!d.sp.flies && this.rnd() < 0.5) this.say(d, '😱', 2);
      if (!d.sp.flies && d.sp.length > 6 && this.rnd() < 0.3 && this.onScreen(d)) {
        d.roar = 1;
        audio.roar(d.sp.size * d.scale * depthScale(d.y), this.pan(d.x));
      }
    }
  }

  private quakeEnv() {
    const q = this.quake;
    if (q.t <= 0) return 0;
    const k = 1 - q.t / q.dur;
    return q.mag * Math.pow(Math.sin(Math.PI * k), 0.6);
  }

  private updateQuake(dt: number) {
    if (this.quake.t > 0) {
      this.quake.t -= dt;
      const env = this.quakeEnv();
      if (this.rnd() < env * dt * 45) {
        const x = this.camX + this.rnd() * this.viewW;
        const y = lerp(GROUND_MIN, GROUND_MAX, this.rnd());
        this.spawnPart({ x, y, vx: (this.rnd() - 0.5) * 40, vy: -40 - this.rnd() * 60, g: 160, life: 1.1, max: 1.1, kind: 'crumb', size: 3 + this.rnd() * 4, color: this.rnd() > 0.5 ? '#b89a6a' : '#8a6f4a' });
      }
      return;
    }
    this.quakeT -= dt;
    if (this.quakeT <= 0) {
      const vn = volcanoNear(this.camX + this.viewW / 2);
      this.quakeT = (vn ? 45 : 85) + this.rnd() * 60;
      this.startQuake(0.4 + this.rnd() * 0.6);
    }
  }

  /* -------------------------------------------------- background herds / flocks */

  private herdS(h: Herd, m: HerdMember) {
    return h.air ? m.look.size * 0.3 * m.sc : m.look.size * depthScale(h.y) * 0.85 * m.sc;
  }

  private spawnHerd() {
    const rnd = this.rnd;
    const cx = this.camX + this.viewW / 2;
    const era = zoneAt(cx).era;
    const dir: 1 | -1 = rnd() < 0.5 ? 1 : -1;
    const startX = dir === 1 ? this.camX - 550 : this.camX + this.viewW + 550;
    const pick = (pool: Species[]) => {
      const w = pool.map((s) => (s.era === era ? 3 : 1));
      let r = rnd() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
      return pool[0];
    };
    const make = (sp: Species, n: number, air: boolean, x: number, y: number, speed: number): Herd => {
      const deg = rnd() < 0.5 ? 0 : (rnd() < 0.5 ? -1 : 1) * Math.round(30 + rnd() * 120);
      const look = variantOf(sp, deg, 0);
      const members: HerdMember[] = [];
      for (let i = 0; i < n; i++) {
        members.push({
          dx: (rnd() - 0.5) * (air ? 260 : 190) - dir * i * 6, dy: air ? (rnd() - 0.5) * 70 : (rnd() - 0.5) * 16,
          ph: rnd() * 6, sc: 0.85 + rnd() * 0.3, look,
          pose: makePose({ moving: 1, flap: 1, fold: 0, phase: rnd() * 6 }),
        });
      }
      members.sort((a, b) => a.dy - b.dy);
      return { air, x, y, dir, speed, age: 0, members };
    };
    if (rnd() < 0.35) {
      const pool = SPECIES.filter((s) => s.flies);
      const sp = pick(pool);
      this.herds.push(make(sp, 5 + Math.floor(rnd() * 6), true, startX, 90 + rnd() * 150, 80 + rnd() * 60));
      return;
    }
    const pool = SPECIES.filter((s) => !s.aquatic && !s.flies && s.diet !== 'carnivore' && s.diet !== 'piscivore' && s.length >= 2 && s.length <= 14);
    const sp = pick(pool);
    const speed = clamp(sp.speed * 1.7, 90, 210) * (0.9 + rnd() * 0.2);
    const y = 388 + rnd() * 18;
    this.herds.push(make(sp, 5 + Math.floor(rnd() * 5), false, startX, y, speed));
    if (rnd() < 0.35) {
      const preds = SPECIES.filter((s) => !s.aquatic && !s.flies && (s.diet === 'carnivore') && s.length >= 1.5 && s.length <= 9);
      const ps = pick(preds);
      this.herds.push(make(ps, 3, false, startX - dir * 460, y + 6, speed * 1.08));
    }
  }

  private updateHerds(dt: number) {
    this.herdT -= dt;
    if (this.herdT <= 0) {
      this.herdT = 7 + this.rnd() * 9;
      if (this.herds.length < 4) this.spawnHerd();
    }
    const cx = this.camX + this.viewW / 2;
    for (const h of this.herds) {
      h.x += h.dir * h.speed * dt;
      h.age += dt;
      for (const m of h.members) {
        const S = this.herdS(h, m);
        const p = m.pose;
        p.t = this.time + m.ph;
        if (h.air) p.phase += dt * 9;
        else p.phase += dt * Math.min(15, h.speed / Math.max(8, S * 0.075));
      }
    }
    this.herds = this.herds.filter((h) => Math.abs(h.x - cx) < 3200 && h.age < 90 && !(h.dir === 1 ? h.x > this.camX + this.viewW + 700 : h.x < this.camX - 700));
  }

  private drawHerds(air: boolean) {
    const ctx = this.ctx;
    const t = this.time;
    ctx.save();
    ctx.translate(-this.camX, 0);
    for (const h of this.herds) {
      if (h.air !== air) continue;
      for (const m of h.members) {
        const x = h.x + m.dx;
        if (x < this.camX - 200 || x > this.camX + this.viewW + 200) continue;
        const S = this.herdS(h, m);
        const y = air ? h.y + m.dy + Math.sin(t * 1.4 + m.ph) * 7 : h.y + m.dy;
        if (!air) {
          ellipse(ctx, x, y + 2, S * 0.36, S * 0.07);
          ctx.fillStyle = 'rgba(20,40,20,0.22)';
          ctx.fill();
          for (let k = 0; k < 3; k++) {
            const f = (t * 1.7 + m.ph + k / 3) % 1;
            ctx.beginPath();
            ctx.arc(x - h.dir * S * (0.3 + f * 0.8), y - S * 0.04 - f * S * 0.16, S * (0.04 + f * 0.1), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(200,170,120,${0.32 * (1 - f)})`;
            ctx.fill();
          }
        }
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(S * h.dir, S);
        if (air) ctx.globalAlpha = 0.92;
        drawDino(ctx, m.look, m.pose, S);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  private drawCracks() {
    const env = this.quakeEnv();
    if (env <= 0.02) return;
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const c of this.cracks) {
      const grow = clamp(1 - this.quake.t / this.quake.dur * 1.4, 0, 1);
      const len = c.len * (0.4 + grow * 0.6);
      const fade = this.quake.t < 1.2 ? this.quake.t / 1.2 : 1;
      const pts: [number, number][] = [[c.x, c.y]];
      let px = c.x, py = c.y;
      const r = mulberry32((c.seed * 977) | 0);
      for (let i = 0; i < 9; i++) {
        px += (len / 9) * (0.6 + r() * 0.8);
        py += (r() - 0.5) * 12;
        pts.push([px, py]);
      }
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts) ctx.lineTo(p[0], p[1]);
      ctx.strokeStyle = `rgba(35,22,14,${0.8 * fade})`;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = `rgba(0,0,0,${0.9 * fade})`;
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
  }

  /* ---------------------------------------------------------------- render */

  private render() {
    const ctx = this.ctx;
    const t = this.time;
    ctx.setTransform(this.dpr * this.zoom, 0, 0, this.dpr * this.zoom, 0, 0);
    ctx.clearRect(0, 0, this.viewW, WORLD_H);
    const env = this.quakeEnv();
    if (env > 0) {
      const amp = env * 6;
      ctx.translate(this.viewW / 2, WORLD_H / 2);
      ctx.scale(1.025, 1.025);
      ctx.translate(-this.viewW / 2 + (Math.random() - 0.5) * 2 * amp, -WORLD_H / 2 + (Math.random() - 0.5) * 2 * amp);
    }
    drawBackdrop(ctx, this.camX, this.viewW, t, this.dn.night);
    this.drawHerds(true);
    ensureGround(this.camX, this.camX + this.viewW);
    drawGround(ctx, this.camX, this.viewW);
    if (this.weather.snowCover > 0.02) {
      const cx = this.camX + this.viewW / 2;
      const vn = volcanoNear(cx);
      const far = vn ? clamp((Math.abs(vn.vx - cx) - 500) / 1500, 0, 1) : 1;
      const holes = liquidsIn(this.camX - 100, this.camX + this.viewW + 100).flatMap((l) => l.blobs);
      this.weather.drawSnowCover(ctx, this.canvas.width, this.canvas.height, this.dpr * this.zoom, this.camX, this.viewW, this.weather.snowCover * far, holes);
    }
    drawLiquidFx(ctx, this.camX, this.viewW, t);
    this.drawHerds(false);

    ctx.save();
    ctx.translate(-this.camX, 0);
    this.drawCracks();
    const x0 = this.camX - 260, x1 = this.camX + this.viewW + 260;

    type Item = { y: number; k: 0 | 1 | 2; d?: import('./draw/flora').Decor; dino?: Dino; food?: Food };
    const items: Item[] = [];
    for (let ci = chunkOf(x0); ci <= chunkOf(x1); ci++) for (const dc of getChunk(ci).decor) if (dc.x > x0 && dc.x < x1) items.push({ y: dc.y, k: 0, d: dc });
    for (const f of this.foods) if (f.x > x0 && f.x < x1) items.push({ y: f.y, k: 2, food: f });
    for (const d of this.dinos) if (d.x > x0 && d.x < x1) items.push({ y: d.y, k: 1, dino: d });
    items.sort((a, b) => a.y - b.y);

    for (const it of items) {
      if (it.k === 0) drawDecor(ctx, it.d!, depthScale(it.y), t);
      else if (it.k === 2) this.drawFood(it.food!);
      else this.drawDinoEntity(it.dino!);
    }

    // particles
    for (const p of this.parts) this.drawParticle(p);
    // bubbles, labels
    for (const it of items) {
      if (it.k !== 1) continue;
      const d = it.dino!;
      if (d.bubble) this.drawBubble(d);
    }
    for (const it of items) if (it.k === 1 && (this.labels || it.dino === this.hover || it.dino === this.selected)) this.drawLabel(it.dino!);
    ctx.restore();

    drawForeground(ctx, this.camX, this.viewW, t);
    if (this.dn.night > 0.01) {
      const lava = liquidsIn(this.camX - 200, this.camX + this.viewW + 200).filter((l) => l.kind === 'lava').flatMap((l) => l.blobs);
      this.dn.draw(ctx, this.viewW, t, this.camX, lava);
    }
    this.weather.drawOverlay(ctx, this.viewW);

    if (env > 0) {
      ctx.setTransform(this.dpr * this.zoom, 0, 0, this.dpr * this.zoom, 0, 0);
      ctx.fillStyle = `rgba(120,90,50,${env * 0.16})`;
      ctx.fillRect(0, 0, this.viewW, WORLD_H);
    }
    // gentle vignette
    const vg = ctx.createRadialGradient(this.viewW / 2, WORLD_H / 2, WORLD_H * 0.55, this.viewW / 2, WORLD_H / 2, Math.max(this.viewW, WORLD_H) * 0.75);
    vg.addColorStop(0, 'rgba(20,40,20,0)');
    vg.addColorStop(1, 'rgba(20,40,20,0.28)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.viewW, WORLD_H);

    if (--this.miniT <= 0) { this.miniT = 4; this.drawMinimap(); }
  }

  private drawDinoEntity(d: Dino) {
    const ctx = this.ctx;
    const sp = d.sp;
    const S = sp.size * d.scale * depthScale(d.y);
    const air = d.z;
    // shadow
    const sw = S * (sp.shape.kind === 'ptero' ? 0.3 : 0.38) * (1 - Math.min(0.6, air / 400)) * (1 - d.pose.swim * 0.8);
    if (sw > 1) {
      ellipse(ctx, d.x, d.y + 2, sw, sw * 0.2);
      ctx.fillStyle = `rgba(20,40,20,${0.28 - Math.min(0.15, air / 900)})`;
      ctx.fill();
    }
    ctx.save();
    ctx.translate(d.x, d.y - air);
    ctx.scale(S * d.face, S);
    drawDino(ctx, d.look, d.pose, S);
    ctx.restore();

    // water ripples
    if (d.pose.swim > 0.2) {
      const wob = (this.time * 0.8 + d.id) % 1;
      ctx.lineWidth = 1.6;
      for (let k = 0; k < 2; k++) {
        const f = (wob + k * 0.5) % 1;
        ctx.strokeStyle = `rgba(255,255,255,${(1 - f) * 0.7 * d.pose.swim})`;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y + 1, S * (0.22 + f * 0.25), S * (0.05 + f * 0.06), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // selection ring
    if (this.selected === d) {
      const pulse = 1 + Math.sin(this.time * 4) * 0.05;
      ctx.strokeStyle = '#fff6b0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y + 2, S * 0.42 * pulse, S * 0.1 * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = ERAS[sp.era].color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  private drawFood(f: Food) {
    const ctx = this.ctx;
    const k = f.pop < 1 ? 1 + Math.sin(f.pop * Math.PI) * 0.35 : 1;
    const sc = (0.55 + 0.45 * (f.bites / 4)) * Math.min(1, f.pop * 1.5) * k * depthScale(f.y) * 1.15;
    const w = inWater(f.x, f.y, 1);
    ctx.save();
    ctx.translate(f.x, f.y + (w ? Math.sin(this.time * 2 + f.id) * 1.5 : 0));
    ctx.scale(sc, sc);
    ellipse(ctx, 0, 2, 20, 5);
    ctx.fillStyle = 'rgba(20,40,20,0.25)';
    ctx.fill();
    if (w) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 3, 24 + Math.sin(this.time * 3) * 2, 6, 0, 0, 6.28);
      ctx.stroke();
    }
    if (f.kind === 'grass') {
      ctx.lineCap = 'round';
      for (let i = 0; i < 13; i++) {
        const a = (i / 12 - 0.5) * 2.1;
        ctx.strokeStyle = i % 3 === 0 ? '#9be06a' : i % 3 === 1 ? '#5fc050' : '#3f9a3a';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(a * 6, 0);
        ctx.quadraticCurveTo(a * 16, -16, a * 24 + (i % 2 ? 4 : -4), -26 + Math.abs(a) * 8);
        ctx.stroke();
      }
      ctx.fillStyle = '#6a4630';
      ctx.fillRect(-9, -3, 18, 5);
    } else {
      ctx.rotate(-0.35);
      ctx.fillStyle = '#f7efe0';
      ctx.strokeStyle = '#7a5a40';
      ctx.lineWidth = 1.5;
      roundRect(ctx, 6, -5, 22, 8, 4);
      ctx.fill();
      ctx.stroke();
      for (const dy of [-6, 4]) {
        ctx.beginPath();
        ctx.arc(29, dy, 4.4, 0, 6.28);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.ellipse(-4, -2, 17, 13, 0, 0, 6.28);
      const g = ctx.createRadialGradient(-8, -8, 2, -4, -2, 18);
      g.addColorStop(0, '#ff8a72');
      g.addColorStop(1, '#b32f22');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = '#6e1a14';
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-9, -8, 6, 3, -0.5, 0, 6.28);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
    }
    ctx.restore();
  }

  private drawParticle(p: Particle) {
    const ctx = this.ctx;
    const a = clamp(p.life / p.max, 0, 1);
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 1.6);
    switch (p.kind) {
      case 'heart': {
        ctx.translate(p.x, p.y);
        const s = p.size * (0.7 + (1 - a) * 0.3);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.35);
        ctx.bezierCurveTo(-s * 0.9, -s * 0.3, -s * 0.35, -s * 0.9, 0, -s * 0.35);
        ctx.bezierCurveTo(s * 0.35, -s * 0.9, s * 0.9, -s * 0.3, 0, s * 0.35);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1;
        ctx.stroke();
        break;
      }
      case 'zzz':
        ctx.font = `800 ${p.size}px "Baloo 2", sans-serif`;
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#3a6ea5';
        ctx.lineWidth = 3;
        ctx.strokeText('Z', p.x, p.y);
        ctx.fillText('Z', p.x, p.y);
        break;
      case 'ring':
        ctx.strokeStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size * (1 - a) * 3, p.size * (1 - a), 0, 0, 6.28);
        ctx.stroke();
        break;
      default:
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.kind === 'spark' ? a : 1), 0, 6.28);
        ctx.fill();
    }
    ctx.restore();
  }

  private drawBubble(d: Dino) {
    const ctx = this.ctx;
    const S = d.sp.size * d.scale * depthScale(d.y);
    const b = d.bubble!;
    const x = d.x + d.face * S * 0.15;
    const y = d.y - d.z - S * d.sp.hitH - 26 - Math.sin(this.time * 4) * 2;
    ctx.save();
    ctx.font = '700 22px "Baloo 2", "Segoe UI Emoji", sans-serif';
    const w = ctx.measureText(b.text).width + 18;
    ctx.globalAlpha = Math.min(1, b.t * 3);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#33495f';
    ctx.lineWidth = 2;
    roundRect(ctx, x - w / 2, y - 18, w, 34, 14);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 15);
    ctx.lineTo(x, y + 25);
    ctx.lineTo(x + 6, y + 15);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.fillStyle = '#26384c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.text, x, y);
    ctx.restore();
  }

  private drawLabel(d: Dino) {
    const ctx = this.ctx;
    if (d.x < this.camX - 40 || d.x > this.camX + this.viewW + 40) return;
    const sel = this.selected === d || this.hover === d;
    const era = ERAS[d.sp.era];
    ctx.save();
    ctx.font = `${sel ? 800 : 700} ${sel ? 14 : 12}px "Baloo 2", "Segoe UI", sans-serif`;
    const text = d.sp.name;
    const w = ctx.measureText(text).width + 16;
    const x = d.x, y = d.y - d.z + 18;
    ctx.globalAlpha = sel ? 1 : 0.88;
    ctx.fillStyle = sel ? '#fffbe9' : 'rgba(255,251,233,0.82)';
    ctx.strokeStyle = era.color;
    ctx.lineWidth = sel ? 3 : 2;
    roundRect(ctx, x - w / 2, y - 11, w, 21, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#16364d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  private drawMinimap() {
    const c = this.mini;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = c.width, h = c.height;
    const span = Engine.MINI_SPAN;
    const k = w / span;
    const cx = this.camX + this.viewW / 2;
    const left = cx - span / 2;
    ctx.clearRect(0, 0, w, h);
    for (let px = 0; px < w; px += 6) {
      ctx.fillStyle = ERAS[zoneAt(left + px / k).era].color;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(px, 0, 7, h);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(250,245,225,0.55)';
    ctx.fillRect(0, h * 0.18, w, h * 0.74);
    for (const l of liquidsIn(left, left + span)) {
      ctx.fillStyle = l.kind === 'water' ? '#3bb0d8' : '#ff6a1a';
      for (const b of l.blobs) {
        ctx.beginPath();
        ctx.ellipse((b.x - left) * k, h * (0.18 + 0.74 * ((b.y - HORIZON) / (WORLD_H - HORIZON))), Math.max(1, b.rx * k), Math.max(1, b.ry * k * 1.3), 0, 0, 6.28);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#7a5648';
    for (let r = regionOf(left) - 1; r <= regionOf(left + span) + 1; r++) {
      const info = regionInfo(r);
      if (!info.volcano) continue;
      const vx = (info.vx - left) * k;
      ctx.beginPath();
      ctx.moveTo(vx - 9, h * 0.3);
      ctx.lineTo(vx, 2);
      ctx.lineTo(vx + 9, h * 0.3);
      ctx.fill();
    }
    for (const d of this.dinos) {
      if (d.x < left || d.x > left + span) continue;
      ctx.fillStyle = this.selected === d ? '#fff' : ERAS[d.sp.era].ink;
      const r = this.selected === d ? 3 : 1.8;
      ctx.beginPath();
      ctx.arc((d.x - left) * k, h * (0.18 + 0.74 * ((d.y - GROUND_MIN) / (GROUND_MAX - GROUND_MIN))), r, 0, 6.28);
      ctx.fill();
      if (this.selected === d) { ctx.strokeStyle = '#d33'; ctx.lineWidth = 1.2; ctx.stroke(); }
    }
    const vx0 = (this.camX - left) * k;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(vx0 + 1, 1, this.viewW * k - 2, h - 2);
    ctx.strokeStyle = '#16364d';
    ctx.lineWidth = 1;
    ctx.strokeRect(vx0, 0, this.viewW * k, h);
  }
}
