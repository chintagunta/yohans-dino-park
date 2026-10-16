import { approach, clamp, smoothstep } from './draw/util';
import { WORLD_H } from './world';
import type { Blob } from './world';

export type TimeMode = 'day' | 'night' | 'auto';
const CYCLE = 300; // seconds for a full day in auto mode
const N_FLIES = 40;

interface Fly { x: number; y: number; ph: number; sp: number; r: number }

/** Day / night: darkness level (0 day … 1 full-moon night), fireflies and lava glow. */
export class DayNight {
  mode: TimeMode = 'auto';
  night = 0;
  private t = 0;
  private flies: Fly[] = [];

  constructor() {
    for (let i = 0; i < N_FLIES; i++) {
      this.flies.push({ x: Math.random() * 1280, y: 400 + Math.random() * 260, ph: Math.random() * 6.28, sp: 0.3 + Math.random() * 0.6, r: 40 + Math.random() * 60 });
    }
  }

  setMode(m: TimeMode) {
    this.mode = m;
    if (m === 'auto') this.t = CYCLE * (this.night > 0.5 ? 0.5 : 0); // continue from the current look
  }

  update(dt: number) {
    this.t += dt;
    let target: number;
    if (this.mode === 'day') target = 0;
    else if (this.mode === 'night') target = 1;
    else {
      const c = Math.cos((this.t / CYCLE) * Math.PI * 2);
      target = smoothstep(-0.15, 0.4, -c);
    }
    this.night = this.mode === 'auto' ? approach(this.night, target, dt * 0.5) : approach(this.night, target, dt * 0.4);
  }

  draw(ctx: CanvasRenderingContext2D, viewW: number, time: number, camX: number, lava: Blob[]) {
    const n = this.night;
    if (n < 0.01) return;
    // moonlit blue wash
    ctx.fillStyle = `rgba(10,22,70,${0.5 * n})`;
    ctx.fillRect(0, 0, viewW, WORLD_H);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // lava keeps glowing in the dark
    for (const b of lava) {
      const x = b.x - camX;
      if (x + b.rx < -50 || x - b.rx > viewW + 50) continue;
      const r = Math.max(b.rx * 1.5, 40);
      const pulse = 0.85 + 0.15 * Math.sin(time * 2 + b.x * 0.01);
      const g = ctx.createRadialGradient(x, b.y, 0, x, b.y, r);
      g.addColorStop(0, `rgba(255,110,25,${0.28 * n * pulse})`);
      g.addColorStop(1, 'rgba(255,90,10,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, b.y - r, r * 2, r * 2);
    }
    // fireflies
    for (const f of this.flies) {
      const x = (f.x + Math.sin(time * f.sp + f.ph) * f.r + camX * 0.0) % (viewW + 40);
      const y = f.y + Math.cos(time * f.sp * 0.8 + f.ph) * 22;
      const blink = clamp(0.35 + 0.65 * Math.sin(time * 2.2 * f.sp + f.ph * 3), 0, 1);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 11);
      g.addColorStop(0, `rgba(230,255,120,${0.95 * blink * n})`);
      g.addColorStop(0.3, `rgba(190,255,90,${0.4 * blink * n})`);
      g.addColorStop(1, 'rgba(190,255,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 11, y - 11, 22, 22);
    }
    ctx.restore();
  }
}
