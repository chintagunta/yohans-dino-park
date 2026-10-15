import { ellipse, mulberry32, shade, smoothClosed, Pt } from './util';

export type DecorKind =
  | 'fern' | 'palm' | 'conifer' | 'tree' | 'blossom' | 'horsetail' | 'shrub' | 'rock' | 'lavarock'
  | 'tuft' | 'flowers' | 'treefern' | 'ashplant';

export interface Decor {
  kind: DecorKind;
  x: number;
  y: number;
  s: number;
  v: number;
}

type C = CanvasRenderingContext2D;
const OL = 'rgba(20,50,30,0.55)';

/** One curved frond with leaflets, origin at (x0,y0). */
function frond(ctx: C, x0: number, y0: number, ang: number, len: number, droop: number, leaf: number, c1: string, c2: string) {
  const ex = x0 + Math.cos(ang) * len, ey = y0 + Math.sin(ang) * len + droop * len;
  const cx = x0 + Math.cos(ang) * len * 0.55, cy = y0 + Math.sin(ang) * len * 0.55 - len * 0.18 + droop * len * 0.2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = c2;
  ctx.lineWidth = Math.max(2, len * 0.05);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, ex, ey);
  ctx.stroke();
  ctx.strokeStyle = c1;
  ctx.lineWidth = Math.max(2.5, leaf * 0.35);
  ctx.beginPath();
  const n = 9;
  for (let i = 1; i <= n; i++) {
    const u = i / (n + 1);
    const m = 1 - u;
    const px = m * m * x0 + 2 * m * u * cx + u * u * ex;
    const py = m * m * y0 + 2 * m * u * cy + u * u * ey;
    const tx = 2 * m * (cx - x0) + 2 * u * (ex - cx);
    const ty = 2 * m * (cy - y0) + 2 * u * (ey - cy);
    const tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl, ny = tx / tl;
    const L = leaf * (1 - u * 0.65);
    ctx.moveTo(px - nx * L + tx / tl * L * 0.3, py - ny * L + ty / tl * L * 0.3 + L * 0.35);
    ctx.lineTo(px, py);
    ctx.lineTo(px + nx * L + tx / tl * L * 0.3, py + ny * L + ty / tl * L * 0.3 + L * 0.35);
  }
  ctx.stroke();
}

export function drawFrondFan(ctx: C, x: number, y: number, n: number, len: number, spread: number, t: number, seed: number, c1: string, c2: string, base = -Math.PI / 2) {
  for (let i = 0; i < n; i++) {
    const f = n > 1 ? i / (n - 1) : 0.5;
    const a = base + (f - 0.5) * spread + Math.sin(t * 1.2 + seed + i) * 0.025;
    const droop = Math.abs(f - 0.5) * 0.7;
    frond(ctx, x, y, a, len * (0.85 + 0.15 * Math.sin(i * 2.1 + seed)), droop, len * 0.16, c1, c2);
  }
}

function fern(ctx: C, v: number, t: number) {
  drawFrondFan(ctx, 0, 0, 9, 36 + v * 16, 2.5, t, v * 10, '#58b34a', '#3b8a3a');
}

function palm(ctx: C, v: number, t: number) {
  const h = 90 + v * 50;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#6a4630';
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(10 + v * 10, -h * 0.55, 4, -h);
  ctx.stroke();
  ctx.strokeStyle = '#8f6341';
  ctx.lineWidth = 11;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(60,35,20,0.5)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 9; i++) {
    const y = -h * (i / 9);
    const x = 2 + Math.sin(i / 9 * Math.PI) * 7 * (1 + v);
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 2);
    ctx.lineTo(x + 6, y - 2);
    ctx.stroke();
  }
  drawFrondFan(ctx, 4, -h, 10, 78 + v * 20, 3.7, t, v * 7, '#4eb24d', '#2f7f3c');
}

function treefern(ctx: C, v: number, t: number) {
  const h = 110 + v * 60;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#5a3d2a';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-8, -h * 0.5, 2, -h);
  ctx.stroke();
  ctx.strokeStyle = '#7a553a';
  ctx.lineWidth = 6;
  ctx.stroke();
  drawFrondFan(ctx, 2, -h, 8, 64 + v * 14, 3.3, t, v * 5, '#6cc04f', '#3f8f3b');
}

function conifer(ctx: C, v: number, t: number) {
  const h = 160 + v * 90;
  const sway = Math.sin(t * 0.9 + v * 9) * 1.5;
  ctx.fillStyle = '#6b4a32';
  ctx.fillRect(-6, -h * 0.25, 12, h * 0.25);
  const tiers = 6;
  for (let i = 0; i < tiers; i++) {
    const f = i / tiers;
    const y = -h * (0.16 + f * 0.8);
    const w = (h * 0.34) * (1 - f * 0.82);
    const th = h * 0.22;
    const sx = sway * f;
    ctx.beginPath();
    ctx.moveTo(sx - w, y);
    ctx.quadraticCurveTo(sx - w * 0.5, y - th * 0.2, sx, y - th);
    ctx.quadraticCurveTo(sx + w * 0.5, y - th * 0.2, sx + w, y);
    ctx.quadraticCurveTo(sx + w * 0.5, y + th * 0.15, sx, y + th * 0.1);
    ctx.quadraticCurveTo(sx - w * 0.5, y + th * 0.15, sx - w, y);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? '#2f8a58' : '#37985f';
    ctx.fill();
    ctx.strokeStyle = OL;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx - w * 0.9, y);
    ctx.quadraticCurveTo(sx - w * 0.45, y - th * 0.25, sx - w * 0.05, y - th * 0.95);
    ctx.quadraticCurveTo(sx - w * 0.4, y - th * 0.1, sx - w * 0.9, y);
    ctx.fillStyle = 'rgba(160,230,130,0.35)';
    ctx.fill();
  }
}

function canopy(ctx: C, v: number, t: number, flower: boolean) {
  const h = 120 + v * 60;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#5b3d2a';
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-12, -h * 0.5, 0, -h);
  ctx.stroke();
  ctx.strokeStyle = '#7e563a';
  ctx.lineWidth = 15;
  ctx.stroke();
  ctx.strokeStyle = '#6a4630';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-2, -h * 0.65);
  ctx.quadraticCurveTo(-30, -h * 0.75, -46, -h * 0.95);
  ctx.moveTo(0, -h * 0.55);
  ctx.quadraticCurveTo(26, -h * 0.7, 48, -h * 0.9);
  ctx.stroke();
  const rnd = mulberry32(Math.floor(v * 1e5));
  const base = flower ? ['#5fb85a', '#78c96a'] : ['#3f9a4a', '#58b358'];
  const blobs: [number, number, number][] = [
    [-46, -h * 0.95, 38], [48, -h * 0.9, 40], [0, -h - 12, 56], [-22, -h - 36, 40], [26, -h - 30, 42], [-62, -h * 0.82, 26], [64, -h * 0.78, 28],
  ];
  const sw = Math.sin(t * 0.8 + v * 7) * 2;
  for (const [bx, by, r] of blobs) {
    ellipse(ctx, bx + sw * 0.5, by, r, r * 0.82);
    ctx.fillStyle = base[0];
    ctx.fill();
    ctx.strokeStyle = OL;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  for (const [bx, by, r] of blobs) {
    ellipse(ctx, bx - r * 0.2 + sw * 0.5, by - r * 0.25, r * 0.6, r * 0.45);
    ctx.fillStyle = base[1];
    ctx.fill();
  }
  if (flower) {
    for (let i = 0; i < 34; i++) {
      const b = blobs[Math.floor(rnd() * blobs.length)];
      const a = rnd() * 6.28, d = rnd() * b[2] * 0.85;
      ctx.beginPath();
      ctx.arc(b[0] + Math.cos(a) * d, b[1] + Math.sin(a) * d * 0.8, 3.5 + rnd() * 2.5, 0, 6.28);
      ctx.fillStyle = rnd() > 0.5 ? '#ff8fb8' : '#ffd0e4';
      ctx.fill();
    }
  }
}

function horsetail(ctx: C, v: number, t: number) {
  const rnd = mulberry32(Math.floor(v * 1e5));
  for (let k = 0; k < 6; k++) {
    const x = (k - 2.5) * 7 + rnd() * 4;
    const h = 50 + rnd() * 50;
    const lean = (rnd() - 0.5) * 8 + Math.sin(t + k) * 1.2;
    ctx.strokeStyle = k % 2 ? '#78bd57' : '#5aa34a';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + lean, -h);
    ctx.stroke();
    ctx.strokeStyle = '#3d7d3a';
    ctx.lineWidth = 1.6;
    for (let n = 1; n < 8; n++) {
      const f = n / 8;
      const px = x + lean * f, py = -h * f;
      const L = 7 * (1 - f * 0.5);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - L, py - L * 0.9);
      ctx.moveTo(px, py);
      ctx.lineTo(px + L, py - L * 0.9);
      ctx.stroke();
    }
  }
}

function shrub(ctx: C, v: number, t: number) {
  const rnd = mulberry32(Math.floor(v * 1e5));
  const berry = ['#ff6f91', '#ffd23f', '#b88cff', '#ff9a3c', '#ff5f5f'][Math.floor(rnd() * 5)];
  const n = 5;
  const pts: [number, number, number][] = [];
  for (let i = 0; i < n; i++) pts.push([(i - 2) * 14 + rnd() * 6, -14 - rnd() * 16, 20 + rnd() * 10]);
  for (const [x, y, r] of pts) {
    ellipse(ctx, x, y, r, r * 0.85);
    ctx.fillStyle = '#3f9a47';
    ctx.fill();
    ctx.strokeStyle = OL;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  for (const [x, y, r] of pts) {
    ellipse(ctx, x - r * 0.2 + Math.sin(t + x) * 0.8, y - r * 0.25, r * 0.6, r * 0.45);
    ctx.fillStyle = '#62bb56';
    ctx.fill();
  }
  for (let i = 0; i < 9; i++) {
    const p = pts[Math.floor(rnd() * n)];
    ctx.beginPath();
    ctx.arc(p[0] + (rnd() - 0.5) * p[2] * 1.2, p[1] + (rnd() - 0.5) * p[2], 3.2, 0, 6.28);
    ctx.fillStyle = berry;
    ctx.fill();
  }
}

function rock(ctx: C, v: number, dark: boolean) {
  const rnd = mulberry32(Math.floor(v * 1e5));
  const R = 34 + v * 30;
  const pts: Pt[] = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / n) * Math.PI * 2;
    const rr = R * (0.8 + rnd() * 0.3);
    pts.push([Math.cos(a) * rr * 1.25, Math.min(0, Math.sin(a) * rr * 0.9) - (Math.sin(a) < 0 ? 0 : -2)]);
  }
  const top = dark ? '#6b5a54' : '#b3a79c';
  const bot = dark ? '#3a2e2b' : '#7d7168';
  const g = ctx.createLinearGradient(0, -R, 0, 0);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  ctx.beginPath();
  smoothClosed(ctx, pts);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,20,15,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(-R * 0.35, -R * 0.55, R * 0.4, R * 0.16, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = dark ? 'rgba(255,170,110,0.25)' : 'rgba(255,255,255,0.35)';
  ctx.fill();
  if (!dark && v > 0.5) {
    ctx.beginPath();
    ctx.ellipse(R * 0.3, -R * 0.1, R * 0.45, R * 0.12, 0.1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(90,170,70,0.75)';
    ctx.fill();
  }
}

function tuft(ctx: C, v: number, t: number) {
  const rnd = mulberry32(Math.floor(v * 1e5));
  ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const x = (i - 4) * 2.6;
    const h = 14 + rnd() * 18;
    const lean = (rnd() - 0.5) * 12 + Math.sin(t * 1.5 + v * 9 + i) * 2.5;
    ctx.strokeStyle = i % 2 ? '#6cc254' : '#4aa046';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x + lean * 0.3, -h * 0.6, x + lean, -h);
    ctx.stroke();
  }
}

function flowers(ctx: C, v: number, t: number) {
  const rnd = mulberry32(Math.floor(v * 1e5));
  const cols = ['#ff7aa8', '#ffd23f', '#b98cff', '#ff9a3c', '#ffffff'];
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * 6 + rnd() * 4;
    const h = 14 + rnd() * 14;
    const lean = Math.sin(t * 1.4 + i + v * 5) * 2;
    ctx.strokeStyle = '#3f9a47';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + lean, -h);
    ctx.stroke();
    const c = cols[Math.floor(rnd() * cols.length)];
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * 6.28;
      ctx.beginPath();
      ctx.arc(x + lean + Math.cos(a) * 3.2, -h + Math.sin(a) * 3.2, 2.4, 0, 6.28);
      ctx.fillStyle = c;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x + lean, -h, 1.8, 0, 6.28);
    ctx.fillStyle = '#ffb703';
    ctx.fill();
  }
}

function ashplant(ctx: C, v: number, t: number) {
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 9;
    const h = 28 + (i % 2) * 14 + v * 10;
    ctx.strokeStyle = '#6b5a4a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x + 4 + Math.sin(t + i) * 1.5, -h * 0.5, x + 8, -h);
    ctx.stroke();
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(x + 3 + k * 2, -h * (0.4 + k * 0.25), 2.4, 0, 6.28);
      ctx.fillStyle = k === 2 ? '#ff7a2a' : '#8a7a68';
      ctx.fill();
    }
  }
}

export function drawDecor(ctx: C, d: Decor, scale: number, t: number) {
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.scale(scale * d.s, scale * d.s);
  switch (d.kind) {
    case 'fern': fern(ctx, d.v, t); break;
    case 'palm': palm(ctx, d.v, t); break;
    case 'treefern': treefern(ctx, d.v, t); break;
    case 'conifer': conifer(ctx, d.v, t); break;
    case 'tree': canopy(ctx, d.v, t, false); break;
    case 'blossom': canopy(ctx, d.v, t, true); break;
    case 'horsetail': horsetail(ctx, d.v, t); break;
    case 'shrub': shrub(ctx, d.v, t); break;
    case 'rock': rock(ctx, d.v, false); break;
    case 'lavarock': rock(ctx, d.v, true); break;
    case 'tuft': tuft(ctx, d.v, t); break;
    case 'flowers': flowers(ctx, d.v, t); break;
    case 'ashplant': ashplant(ctx, d.v, t); break;
  }
  ctx.restore();
}

export { shade };
