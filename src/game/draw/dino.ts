import type { Pose, Shape, Species } from '../types';
import { clamp, lerp, Pt, shade, smoothClosed } from './util';

/* -------------------------------------------------------------------------- */
/*  Procedural, side-view dinosaur renderer.                                  */
/*  Unit space: 1 unit = species body size, origin = ground under the body,   */
/*  the creature faces +x (caller flips for the other direction).             */
/* -------------------------------------------------------------------------- */

export const makePose = (o: Partial<Pose> = {}): Pose => ({
  phase: 0, moving: 0, headLower: 0, jaw: 0, sleep: 0, swim: 0, t: 0, blink: 0, happy: 0, fold: 0, flap: 0, ...o,
});

interface Key { x: number; y: number; w: number }
interface Sample { x: number; y: number; w: number; nx: number; ny: number; tx: number; ty: number }

function resample(keys: Key[], per = 5) {
  const n = keys.length;
  const raw: Key[] = [];
  const keyIdx: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = keys[Math.max(0, i - 1)];
    const p1 = keys[i];
    const p2 = keys[i + 1];
    const p3 = keys[Math.min(n - 1, i + 2)];
    keyIdx.push(raw.length);
    for (let k = 0; k < per; k++) {
      const u = k / per;
      const u2 = u * u;
      const u3 = u2 * u;
      raw.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3),
        w: lerp(p1.w, p2.w, u),
      });
    }
  }
  keyIdx.push(raw.length);
  raw.push({ ...keys[n - 1] });
  const samples: Sample[] = raw.map((p, i) => {
    const a = raw[Math.max(0, i - 1)];
    const b = raw[Math.min(raw.length - 1, i + 1)];
    let tx = b.x - a.x;
    let ty = b.y - a.y;
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    return { x: p.x, y: p.y, w: p.w, tx, ty, nx: ty, ny: -tx };
  });
  return { samples, keyIdx };
}

function bezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, u: number): Pt {
  const m = 1 - u;
  const a = m * m * m, b = 3 * m * m * u, c = 3 * m * u * u, d = u * u * u;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

function tubePath(ctx: CanvasRenderingContext2D, s: Sample[], grow = 1) {
  ctx.beginPath();
  const top = s.map((p) => [p.x + p.nx * p.w * grow, p.y + p.ny * p.w * grow] as Pt);
  const bot = s.map((p) => [p.x - p.nx * p.w * grow, p.y - p.ny * p.w * grow] as Pt);
  ctx.moveTo(top[0][0], top[0][1]);
  for (let i = 1; i < top.length; i++) ctx.lineTo(top[i][0], top[i][1]);
  const e = s[s.length - 1];
  ctx.quadraticCurveTo(e.x + e.tx * e.w * 1.3, e.y + e.ty * e.w * 1.3, bot[bot.length - 1][0], bot[bot.length - 1][1]);
  for (let i = bot.length - 2; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
  ctx.closePath();
}

/** Two-bone IK. sign=+1 bends the middle joint forward (+x), -1 backward. */
function ik(hx: number, hy: number, fx: number, fy: number, l1: number, l2: number, sign: number): Pt {
  let dx = fx - hx;
  let dy = fy - hy;
  let d = Math.hypot(dx, dy) || 1e-5;
  const maxD = (l1 + l2) * 0.999;
  if (d > maxD) {
    dx *= maxD / d;
    dy *= maxD / d;
    d = maxD;
  }
  const a = (d * d + l1 * l1 - l2 * l2) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / d, uy = dy / d;
  return [hx + ux * a + uy * h * sign, hy + uy * a - ux * h * sign];
}

const HEADS: Record<string, { up: Pt[]; low: Pt[] }> = {
  rex: {
    up: [[-0.3, -0.05], [-0.1, -0.62], [0.25, -0.58], [0.6, -0.34], [1.0, -0.2], [1.05, 0.08], [0.72, 0.18], [0.3, 0.2], [0.0, 0.35]],
    low: [[0.0, 0.18], [0.5, 0.2], [0.95, 0.14], [0.9, 0.38], [0.5, 0.56], [0.1, 0.62]],
  },
  long: {
    up: [[-0.3, -0.05], [-0.1, -0.55], [0.25, -0.46], [0.6, -0.28], [1.0, -0.2], [1.1, -0.02], [0.95, 0.14], [0.5, 0.2], [0.0, 0.35]],
    low: [[0.0, 0.18], [0.5, 0.2], [1.0, 0.12], [0.97, 0.3], [0.5, 0.48], [0.1, 0.62]],
  },
  blunt: {
    up: [[-0.3, -0.1], [-0.05, -0.62], [0.4, -0.62], [0.8, -0.42], [1.02, -0.15], [1.03, 0.2], [0.6, 0.3], [0.2, 0.35], [0.0, 0.4]],
    low: [[0.0, 0.25], [0.6, 0.3], [1.0, 0.25], [0.95, 0.5], [0.5, 0.62], [0.1, 0.62]],
  },
  duck: {
    up: [[-0.3, -0.1], [-0.05, -0.62], [0.3, -0.52], [0.6, -0.3], [0.9, -0.2], [1.1, -0.12], [1.12, 0.12], [0.9, 0.22], [0.4, 0.25], [0.0, 0.38]],
    low: [[0.0, 0.22], [0.6, 0.26], [1.05, 0.2], [1.02, 0.4], [0.5, 0.55], [0.1, 0.6]],
  },
  beak: {
    up: [[-0.3, -0.1], [-0.05, -0.66], [0.3, -0.56], [0.6, -0.36], [0.9, -0.12], [1.06, 0.1], [0.85, 0.2], [0.4, 0.24], [0.0, 0.38]],
    low: [[0.0, 0.2], [0.55, 0.24], [0.9, 0.22], [0.85, 0.42], [0.5, 0.55], [0.1, 0.6]],
  },
};

interface Ctx2 {
  ctx: CanvasRenderingContext2D;
  sp: Species;
  pose: Pose;
  lw: number;
  ol: string; // outline colour
  far: string;
}

/* -------------------------------------------------------------------------- */
/*  Head                                                                      */
/* -------------------------------------------------------------------------- */

function drawHead(c: Ctx2, hx: number, hy: number, ang: number, flip = false) {
  const { ctx, sp, pose, lw, ol } = c;
  const sh = sp.shape;
  const col = sp.colors;
  const L = sh.head.len * 1.25;
  const H = sh.head.h * 1.3;
  const f = sh.feats ?? {};
  const set = HEADS[sh.head.style];
  const asleep = pose.sleep > 0.5;
  const jaw = clamp(pose.jaw, 0, 1) * 0.5;
  const sc = (p: Pt): Pt => [p[0] * L, p[1] * H];

  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(ang);
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = ol;

  // frill (ceratopsian) goes behind the head
  if (f.frill) {
    const R = f.frill;
    ctx.save();
    ctx.translate(-L * 0.05, -H * 0.25);
    ctx.rotate(-0.25);
    const spikes = 7;
    for (let i = 0; i < spikes; i++) {
      const a = -Math.PI * 0.95 + (i / (spikes - 1)) * Math.PI * 0.9;
      const bx = Math.cos(a) * R * 0.62, by = Math.sin(a) * R;
      const tipL = R * (i === 0 || i === spikes - 1 ? 0.3 : 0.5);
      ctx.beginPath();
      ctx.moveTo(bx - Math.sin(a) * R * 0.1, by + Math.cos(a) * R * 0.1);
      ctx.lineTo(bx + Math.cos(a) * R * 0.62 * (tipL / R) * 1.6, by + Math.sin(a) * tipL);
      ctx.lineTo(bx + Math.sin(a) * R * 0.1, by - Math.cos(a) * R * 0.1);
      ctx.closePath();
      ctx.fillStyle = col.accent;
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, R * 0.62, R, 0, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
    g.addColorStop(0, shade(col.extra ?? col.accent, 0.35));
    g.addColorStop(1, col.extra ?? col.accent);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = shade(col.extra ?? col.accent, -0.3, 0.7);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.5, R * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // back crests (drawn behind skull)
  if (f.crest === 'tube') {
    const pts: Pt[] = ([[0.3, -0.5], [0.45, -1.15], [0.15, -1.7], [-0.4, -1.4], [-0.55, -0.9], [-0.1, -0.5]] as Pt[]).map(sc);
    ctx.beginPath();
    smoothClosed(ctx, pts);
    ctx.fillStyle = col.accent;
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pts[1][0] * 0.9, pts[1][1] * 0.9);
    ctx.quadraticCurveTo(pts[2][0] * 0.8, pts[2][1] * 0.8, pts[3][0] * 0.6, pts[3][1] * 0.65);
    ctx.strokeStyle = shade(col.accent, 0.5, 0.8);
    ctx.stroke();
    ctx.strokeStyle = ol;
  }
  if (f.crest === 'plume') {
    const pts: Pt[] = ([[0.1, -0.5], [0.25, -1.15], [0.55, -1.4], [0.8, -0.95], [0.75, -0.5]] as Pt[]).map(sc);
    ctx.beginPath();
    smoothClosed(ctx, pts);
    ctx.fillStyle = col.accent;
    ctx.fill();
    ctx.stroke();
  }
  if (f.crest === 'twin') {
    for (let k = 0; k < 2; k++) {
      const o = k * 0.07 * L;
      ctx.beginPath();
      ctx.moveTo(0.1 * L + o, -0.5 * H);
      ctx.quadraticCurveTo(0.2 * L + o, -1.6 * H, 0.62 * L + o, -1.5 * H);
      ctx.lineTo(0.66 * L + o, -1.3 * H);
      ctx.quadraticCurveTo(0.62 * L + o, -0.8 * H, 0.55 * L + o, -0.5 * H);
      ctx.closePath();
      ctx.fillStyle = k ? shade(col.accent, -0.2) : col.accent;
      ctx.fill();
      ctx.stroke();
    }
  }
  if (f.wingCrest) {
    const lc = f.wingCrest;
    ctx.beginPath();
    ctx.moveTo(0.1 * L, -0.55 * H);
    ctx.quadraticCurveTo(-lc * 0.5, -1.0 * H, -lc, -1.05 * H);
    ctx.quadraticCurveTo(-lc * 0.5, -0.45 * H, -0.1 * L, -0.05 * H);
    ctx.closePath();
    ctx.fillStyle = col.accent;
    ctx.fill();
    ctx.stroke();
  }

  // mouth interior + lower jaw
  const hinge: Pt = [0.05 * L, 0.25 * H];
  ctx.save();
  ctx.translate(hinge[0], hinge[1]);
  ctx.rotate(jaw);
  ctx.translate(-hinge[0], -hinge[1]);
  if (jaw > 0.04) {
    ctx.beginPath();
    ctx.moveTo(0.05 * L, 0.2 * H);
    ctx.lineTo(0.95 * L, 0.18 * H);
    ctx.lineTo(0.9 * L, 0.45 * H);
    ctx.closePath();
    ctx.fillStyle = '#8a2234';
    ctx.fill();
  }
  ctx.beginPath();
  smoothClosed(ctx, set.low.map(sc));
  ctx.fillStyle = shade(col.body, -0.1);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // skull
  ctx.beginPath();
  smoothClosed(ctx, set.up.map(sc));
  ctx.fillStyle = col.body;
  ctx.fill();
  ctx.stroke();
  // cheek / snout lighter shading
  ctx.save();
  ctx.clip();
  ctx.fillStyle = shade(col.belly, 0, 0.6);
  ctx.beginPath();
  ctx.ellipse(0.6 * L, 0.22 * H, 0.5 * L, 0.18 * H, 0, 0, Math.PI * 2);
  ctx.fill();
  if (pose.happy > 0.3) {
    ctx.fillStyle = 'rgba(255,110,140,0.5)';
    ctx.beginPath();
    ctx.arc(0.28 * L, 0.06 * H, 0.17 * H, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // teeth
  if (f.teeth) {
    ctx.fillStyle = '#fffdf2';
    const nT = Math.max(3, Math.round(L * 30));
    for (let i = 0; i < nT; i++) {
      const x = L * (0.4 + (0.55 * i) / nT);
      const y = H * (0.19 + 0.02 * (i % 2));
      const tw = L * 0.022;
      ctx.beginPath();
      ctx.moveTo(x, y - H * 0.02);
      ctx.lineTo(x + tw, y - H * 0.02);
      ctx.lineTo(x + tw * 0.5, y + H * (0.14 + jaw * 0.1));
      ctx.closePath();
      ctx.fill();
    }
  }

  // brow
  if (sp.diet === 'carnivore' && !f.beak) {
    ctx.beginPath();
    ctx.moveTo(0.18 * L, -0.34 * H);
    ctx.quadraticCurveTo(0.38 * L, -0.5 * H, 0.58 * L, -0.28 * H);
    ctx.lineTo(0.58 * L, -0.34 * H);
    ctx.quadraticCurveTo(0.38 * L, -0.58 * H, 0.15 * L, -0.4 * H);
    ctx.closePath();
    ctx.fillStyle = shade(col.body, -0.35);
    ctx.fill();
  }

  // horns
  if (f.hornBrow) {
    const hb = f.hornBrow;
    for (const x0 of [0.28, 0.46]) {
      ctx.beginPath();
      ctx.moveTo(x0 * L, -0.5 * H);
      ctx.quadraticCurveTo((x0 - 0.02) * L, -(0.5 + 0.5 * hb) * H, (x0 - 0.1 * hb) * L, -(0.55 + 0.8 * hb) * H);
      ctx.quadraticCurveTo((x0 + 0.07) * L, -(0.6 + 0.2 * hb) * H, (x0 + 0.12) * L, -0.45 * H);
      ctx.closePath();
      ctx.fillStyle = '#f5ecd2';
      ctx.fill();
      ctx.stroke();
    }
  }
  if (f.hornNose) {
    ctx.beginPath();
    ctx.moveTo(0.78 * L, -0.32 * H);
    ctx.quadraticCurveTo(0.88 * L, -0.4 * H - f.hornNose * 0.6, 0.86 * L, -0.45 * H - f.hornNose);
    ctx.quadraticCurveTo(1.0 * L, -0.3 * H, 1.0 * L, -0.12 * H);
    ctx.closePath();
    ctx.fillStyle = '#f5ecd2';
    ctx.fill();
    ctx.stroke();
  }

  // eye
  const ex = 0.36 * L, ey = -0.18 * H;
  const er = Math.max(H * 0.15, 0.007);
  const closed = asleep || pose.blink > 0.5;
  if (closed) {
    ctx.beginPath();
    ctx.arc(ex, ey, er * 0.9, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.lineWidth = lw * 1.5;
    ctx.strokeStyle = '#2a1b14';
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fillStyle = '#fffbe8';
    ctx.fill();
    ctx.lineWidth = lw * 0.8;
    ctx.strokeStyle = ol;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ex + er * 0.25, ey + er * 0.05, er * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = sp.diet === 'carnivore' ? '#c8321e' : '#2a1b14';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + er * 0.3, ey + er * 0.05, er * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = '#120b08';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex + er * 0.05, ey - er * 0.3, er * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  // nostril
  ctx.fillStyle = shade(col.body, -0.5);
  ctx.beginPath();
  ctx.ellipse(0.93 * L, -0.08 * H, L * 0.018, H * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  void flip;
}

/* -------------------------------------------------------------------------- */
/*  Legs / arms                                                               */
/* -------------------------------------------------------------------------- */

function limb(ctx: CanvasRenderingContext2D, pts: Pt[], widths: number[], fill: string, ol: string, lw: number) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < pts.length - 1; i++) {
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
      ctx.lineWidth = widths[i] + (pass === 0 ? lw * 2 : 0);
      ctx.strokeStyle = pass === 0 ? ol : fill;
      ctx.stroke();
    }
  }
}

function drawLeg(
  c: Ctx2, ax: number, ay: number, fx: number, fy: number, lift: number,
  bend: number, kneeSign: number, fill: string, w1: number, w2: number, toes: boolean,
) {
  const { ctx, lw, ol } = c;
  const reach = Math.hypot(fx - ax, fy - ay);
  const total = Math.max(reach, Math.abs(ay)) * bend;
  const l1 = total * 0.5;
  const l2 = total * 0.5;
  const fyy = fy - lift;
  const knee = ik(ax, ay, fx, fyy, l1, l2, kneeSign);
  limb(ctx, [[ax, ay], knee, [fx, fyy]], [w1, w2], fill, ol, lw);
  // foot
  ctx.save();
  ctx.translate(fx, fyy);
  ctx.fillStyle = fill;
  ctx.strokeStyle = ol;
  ctx.lineWidth = lw;
  if (toes) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-w2 * 0.2, -w2 * 0.1);
      ctx.lineTo(w2 * (1.5 + i * 0.35), w2 * (0.2 + i * 0.12));
      ctx.lineTo(w2 * (1.2 + i * 0.3), w2 * (0.55 + i * 0.1));
      ctx.lineTo(-w2 * 0.4, w2 * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // claws
    ctx.fillStyle = '#fbf3da';
    ctx.beginPath();
    ctx.arc(w2 * 1.95, w2 * 0.55, w2 * 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(w2 * 0.35, w2 * 0.2, w2 * 0.95, w2 * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fbf3da';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(w2 * (0.8 + i * 0.12), w2 * (0.1 + i * 0.12), w2 * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/* -------------------------------------------------------------------------- */
/*  Land dinosaur                                                             */
/* -------------------------------------------------------------------------- */

function drawLand(c: Ctx2) {
  const { ctx, sp, pose, lw, ol, far } = c;
  const sh = sp.shape;
  const col = sp.colors;
  const f = sh.feats ?? {};
  const biped = sh.kind === 'biped';
  const sleep = pose.sleep;
  const lowerHead = Math.max(pose.headLower, sleep * 0.9);

  const breathe = 1 + 0.01 * Math.sin(pose.t * 1.6) + sleep * 0.03 * Math.sin(pose.t * 1.8);
  const bh = sh.bodyH * breathe;
  const legH = sh.legH * 0.78 * (1 - 0.8 * sleep);
  const bob = -Math.abs(Math.sin(pose.phase)) * 0.008 * pose.moving;
  const hy = -(legH + bh * 0.5) + bob;
  const halfDy = (sh.bodyLen / 2) * Math.sin(sh.tilt);
  const halfDx = (sh.bodyLen / 2) * Math.cos(sh.tilt);
  const hip: Pt = [-halfDx, hy - halfDy];
  const shoulder: Pt = [halfDx, hy + halfDy];

  // ------------------------------------------------------------- spine keys
  const keys: Key[] = [];
  const tb = bh * 0.5 * (sh.tail.thick ?? 0.6);
  const wag = 0.3 + pose.moving;
  for (const tt of [1, 0.72, 0.46, 0.22]) {
    const y =
      hip[1] +
      (-sh.tail.lift * Math.sin(tt * Math.PI * 0.9) + sh.tail.droop * tt * tt) * (1 - sleep * 0.5) +
      Math.sin(pose.phase - tt * 2.2) * 0.012 * tt * wag +
      Math.sin(pose.t * 1.4 - tt * 2) * 0.008 * tt * (1 - sleep) +
      Math.sin(pose.t * 11) * 0.01 * tt * pose.happy;
    keys.push({ x: hip[0] - sh.tail.len * tt, y, w: lerp(tb, 0.004, Math.pow(tt, 0.85)) });
  }
  const hipKey = keys.length;
  keys.push({ x: hip[0], y: hip[1], w: bh * 0.47 });
  keys.push({ x: 0, y: (hip[1] + shoulder[1]) / 2 - bh * 0.03, w: bh * 0.5 });
  const shKey = keys.length;
  keys.push({ x: shoulder[0], y: shoulder[1], w: bh * 0.45 });

  // neck
  const L = sh.neck.len;
  const a = sh.neck.ang;
  const nb = bh * 0.5 * (sh.neck.thick ?? 0.5);
  const ne = Math.max(sh.head.h * 0.3, nb * 0.55);
  const eUp: Pt = [shoulder[0] + L * Math.cos(a), shoulder[1] - L * Math.sin(a)];
  const c1Up: Pt = [shoulder[0] + L * 0.45 * Math.cos(a + 0.55), shoulder[1] - L * 0.45 * Math.sin(a + 0.55)];
  const c2Up: Pt = [eUp[0] - L * 0.25 * Math.cos(a - 0.25), eUp[1] + L * 0.25 * Math.sin(a - 0.25)];
  const groundDist = -shoulder[1] - 0.012;
  const eLow: Pt = [shoulder[0] + L * 0.8, shoulder[1] + Math.min(L * 0.92, groundDist)];
  const c1Low: Pt = [shoulder[0] + L * 0.45, shoulder[1] + L * 0.02];
  const c2Low: Pt = [eLow[0] - L * 0.1, eLow[1] - L * 0.3];
  const lw2 = lowerHead;
  const e: Pt = [lerp(eUp[0], eLow[0], lw2), lerp(eUp[1], eLow[1], lw2)];
  const c1: Pt = [lerp(c1Up[0], c1Low[0], lw2), lerp(c1Up[1], c1Low[1], lw2)];
  const c2: Pt = [lerp(c2Up[0], c2Low[0], lw2), lerp(c2Up[1], c2Low[1], lw2)];
  const nod = Math.sin(pose.phase * 2) * 0.008 * pose.moving + Math.sin(pose.t * 1.5) * 0.005 * (1 - sleep);
  e[1] += nod;
  e[0] += Math.sin(pose.t * 9) * 0.012 * pose.happy;
  c2[1] += nod * 0.6;
  const p0 = shoulder;
  for (const u of [0.12, 0.3, 0.52, 0.76, 1]) {
    const q = bezier(p0, c1, c2, e, u);
    const w = u < 0.2 ? lerp(bh * 0.45, nb, 0.6) : lerp(nb, ne, Math.pow((u - 0.12) / 0.88, 0.85));
    keys.push({ x: q[0], y: q[1], w });
  }

  const { samples, keyIdx } = resample(keys.map((k) => ({ ...k, w: k.w * 1.55 })), 5);
  const last = samples.length - 1;
  const idxHip = keyIdx[hipKey];
  const idxSh = keyIdx[shKey];
  const S = (u: number): Sample => {
    let idx: number;
    if (u <= 1) idx = u * idxHip;
    else if (u <= 2) idx = idxHip + (u - 1) * (idxSh - idxHip);
    else idx = idxSh + (u - 2) * (last - idxSh);
    idx = clamp(idx, 0, last);
    const i0 = Math.floor(idx);
    const i1 = Math.min(last, i0 + 1);
    const t = idx - i0;
    const A = samples[i0], B = samples[i1];
    return { x: lerp(A.x, B.x, t), y: lerp(A.y, B.y, t), w: lerp(A.w, B.w, t), nx: lerp(A.nx, B.nx, t), ny: lerp(A.ny, B.ny, t), tx: lerp(A.tx, B.tx, t), ty: lerp(A.ty, B.ty, t) };
  };

  // ------------------------------------------------------------- legs setup
  const hAnchor: Pt = [hip[0] + 0.035, hip[1] + bh * 0.12];
  const fAnchor: Pt = [shoulder[0] - 0.035, shoulder[1] + bh * 0.12];
  const hipH = -hAnchor[1];
  const strideH = (biped ? 0.4 : 0.3) * hipH * pose.moving;
  const liftH = 0.3 * hipH * pose.moving + 0.002;
  const bend = biped || sh.digi ? 1.16 : 1.05;
  const legFill = col.body;
  const legFar = far;
  const w1 = sh.legW * (biped ? 1.7 : 1.3);
  const w2 = sh.legW * (biped ? 1.0 : 1.15);
  const tuck = sleep * 0.04;

  const legAt = (anchor: Pt, ph: number, near: boolean, front: boolean) => {
    const sx = Math.sin(ph) * strideH;
    const lf = Math.max(0, Math.cos(ph)) * liftH;
    const fx = anchor[0] + sx + (front ? tuck : -tuck * 0.5) + (front ? 0.01 : 0.0);
    drawLeg(c, anchor[0], anchor[1], fx, 0, lf, bend, front && !biped ? -1 : 1, near ? legFill : legFar, w1, w2, biped);
  };

  // arms for bipeds
  const armScale = sh.arms ?? 0;
  const drawArm = (near: boolean, off: number) => {
    if (!armScale) return;
    const ax = shoulder[0] - 0.005 + off, ay = shoulder[1] + bh * 0.25 - sleep * 0.02;
    const sw = Math.sin(pose.phase + (near ? 0 : Math.PI)) * 0.015 * pose.moving;
    const hxp = ax + 0.055 * armScale + sw + Math.sin(pose.t * 9) * 0.015 * pose.happy;
    const hyp = ay + 0.075 * armScale;
    const total = Math.hypot(hxp - ax, hyp - ay) * 1.2;
    const el = ik(ax, ay, hxp, hyp, total * 0.5, total * 0.5, -1);
    limb(ctx, [[ax, ay], el, [hxp, hyp]], [sh.legW * 0.55, sh.legW * 0.42], near ? col.body : legFar, ol, lw);
    ctx.fillStyle = '#fbf3da';
    ctx.beginPath();
    ctx.arc(hxp + 0.008, hyp + 0.006, sh.legW * 0.3, 0, Math.PI * 2);
    ctx.fill();
    if (f.thumbSpike && near) {
      ctx.beginPath();
      ctx.moveTo(hxp - 0.01, hyp - 0.01);
      ctx.lineTo(hxp + 0.025, hyp - 0.03);
      ctx.lineTo(hxp + 0.005, hyp + 0.005);
      ctx.closePath();
      ctx.fillStyle = '#f5ecd2';
      ctx.fill();
      ctx.stroke();
    }
  };

  const ph = pose.phase;
  // ------------------------------------------------------------ far legs
  if (sleep < 0.95) {
    if (!biped) {
      legAt(hAnchor, ph + Math.PI, false, false);
      legAt(fAnchor, ph, false, true);
    } else {
      legAt(hAnchor, ph + Math.PI, false, false);
    }
  }
  drawArm(false, -0.012);

  // --------------------------------------------------- behind-body features
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = ol;

  if (f.sail) {
    const sl = f.sail;
    const N = 18;
    const top: Pt[] = [];
    const base: Pt[] = [];
    for (let i = 0; i <= N; i++) {
      const fr = i / N;
      const u = lerp(sl.from, sl.to, fr);
      const s = S(u);
      const hh = sl.h * Math.pow(Math.sin(Math.PI * clamp(fr * 0.96 + 0.02, 0, 1)), 0.7);
      base.push([s.x + s.nx * s.w * 0.55, s.y + s.ny * s.w * 0.55]);
      top.push([s.x + s.nx * (s.w * 0.9 + hh), s.y + s.ny * (s.w * 0.9 + hh)]);
    }
    const mem = sl.membrane ?? 0.8;
    ctx.beginPath();
    ctx.moveTo(base[0][0], base[0][1]);
    for (const p of top) ctx.lineTo(p[0], p[1]);
    for (let i = N; i >= 0; i--) ctx.lineTo(base[i][0], base[i][1]);
    ctx.closePath();
    ctx.globalAlpha = mem;
    const g = ctx.createLinearGradient(0, top[Math.floor(N / 2)][1], 0, base[Math.floor(N / 2)][1]);
    g.addColorStop(0, col.accent);
    g.addColorStop(1, shade(col.accent, 0.35));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (mem > 0.5) ctx.stroke();
    ctx.strokeStyle = shade(col.accent, -0.35);
    ctx.lineWidth = lw * (sl.rays ? 2.2 : 1);
    ctx.lineCap = 'round';
    const step = sl.rays ? 1 : 2;
    for (let i = 1; i < N; i += step) {
      ctx.beginPath();
      ctx.moveTo(base[i][0], base[i][1]);
      ctx.lineTo(top[i][0], top[i][1]);
      ctx.stroke();
    }
    ctx.strokeStyle = ol;
    ctx.lineWidth = lw;
  }

  if (f.plates) {
    const pl = f.plates;
    for (let k = 0; k < pl.n; k++) {
      const fr = pl.n > 1 ? k / (pl.n - 1) : 0.5;
      const s = S(lerp(pl.from, pl.to, fr));
      const bump = Math.sin(Math.PI * (0.1 + 0.8 * fr));
      const hgt = pl.h * (0.45 + 0.55 * bump);
      const bw = hgt * 0.7;
      const alt = k % 2 ? 1 : -1;
      const bx = s.x + s.nx * s.w * 0.7 + s.tx * alt * bw * 0.18;
      const by = s.y + s.ny * s.w * 0.7 + s.ty * alt * bw * 0.18;
      const tipx = bx + s.nx * hgt - s.tx * hgt * 0.25;
      const tipy = by + s.ny * hgt - s.ty * hgt * 0.25;
      const mx = bx + s.nx * hgt * 0.45, my = by + s.ny * hgt * 0.45;
      ctx.beginPath();
      ctx.moveTo(bx - s.tx * bw * 0.45, by - s.ty * bw * 0.45);
      ctx.quadraticCurveTo(mx - s.tx * bw * 0.6, my - s.ty * bw * 0.6, tipx, tipy);
      ctx.quadraticCurveTo(mx + s.tx * bw * 0.65, my + s.ty * bw * 0.65, bx + s.tx * bw * 0.45, by + s.ty * bw * 0.45);
      ctx.closePath();
      ctx.fillStyle = alt > 0 ? col.accent : shade(col.accent, -0.12);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + s.nx * hgt * 0.65 - s.tx * hgt * 0.12, by + s.ny * hgt * 0.65 - s.ty * hgt * 0.12);
      ctx.strokeStyle = shade(col.accent, 0.5, 0.7);
      ctx.lineWidth = lw * 1.4;
      ctx.stroke();
      ctx.strokeStyle = ol;
      ctx.lineWidth = lw;
    }
  }

  // ------------------------------------------------------------------ body
  tubePath(ctx, samples);
  ctx.fillStyle = col.body;
  ctx.fill();
  ctx.save();
  tubePath(ctx, samples);
  ctx.clip();
  // belly
  ctx.beginPath();
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const x = s.x - s.nx * s.w * 0.18, y = s.y - s.ny * s.w * 0.18;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = samples.length - 1; i >= 0; i--) {
    const s = samples[i];
    ctx.lineTo(s.x - s.nx * s.w * 1.6, s.y - s.ny * s.w * 1.6);
  }
  ctx.closePath();
  ctx.fillStyle = col.belly;
  ctx.fill();
  // soft shade under the belly line
  ctx.strokeStyle = shade(col.body, -0.1, 0.5);
  ctx.lineWidth = lw * 2;
  ctx.beginPath();
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const x = s.x - s.nx * s.w * 0.18, y = s.y - s.ny * s.w * 0.18;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // stripes
  if (f.stripes) {
    ctx.strokeStyle = col.stripe ?? shade(col.body, -0.3);
    ctx.globalAlpha = 0.55;
    ctx.lineCap = 'round';
    for (let i = 3; i < idxSh + 3; i += 3) {
      const s = samples[i];
      if (s.w < 0.012) continue;
      ctx.lineWidth = s.w * 0.4;
      ctx.beginPath();
      ctx.moveTo(s.x + s.nx * s.w * 1.2 - s.tx * s.w * 0.4, s.y + s.ny * s.w * 1.2 - s.ty * s.w * 0.4);
      ctx.lineTo(s.x - s.nx * s.w * 0.1 + s.tx * s.w * 0.3, s.y - s.ny * s.w * 0.1 + s.ty * s.w * 0.3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (f.spots) {
    ctx.fillStyle = col.accent;
    ctx.globalAlpha = 0.75;
    for (let i = 4; i < last; i += 4) {
      const s = samples[i];
      const k = (i * 37) % 7;
      const off = (k / 7) * 0.9 - 0.2;
      ctx.beginPath();
      ctx.arc(s.x + s.nx * s.w * off, s.y + s.ny * s.w * off, s.w * (0.16 + (k % 3) * 0.05), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // top highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = bh * 0.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 2; i < last - 2; i++) {
    const s = samples[i];
    const x = s.x + s.nx * s.w * 0.62, y = s.y + s.ny * s.w * 0.62;
    if (i === 2) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
  tubePath(ctx, samples);
  ctx.lineWidth = lw;
  ctx.strokeStyle = ol;
  ctx.stroke();

  // ---------------------------------------------------------------- near legs
  if (sleep < 0.95) {
    if (!biped) {
      legAt(hAnchor, ph, true, false);
      legAt(fAnchor, ph + Math.PI, true, true);
    } else {
      legAt(hAnchor, ph, true, false);
    }
  } else {
    // lying: tuck a visible leg
    ctx.fillStyle = col.body;
    ctx.strokeStyle = ol;
    ctx.beginPath();
    ctx.ellipse(hAnchor[0] + 0.03, -0.012, sh.legW * 1.4, sh.legW * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // ------------------------------------------------------- front body features
  if (f.armor) {
    const ar = f.armor;
    for (let k = 0; k < ar.n; k++) {
      const fr = ar.n > 1 ? k / (ar.n - 1) : 0.5;
      const s = S(lerp(ar.from, ar.to, fr));
      const r = Math.max(s.w * 0.36, 0.008);
      for (const row of [0.78, 0.3]) {
        ctx.save();
        ctx.translate(s.x + s.nx * s.w * row, s.y + s.ny * s.w * row);
        ctx.rotate(Math.atan2(s.ty, s.tx));
        ctx.beginPath();
        ctx.ellipse(0, 0, r * (row > 0.5 ? 1.1 : 0.9), r * (row > 0.5 ? 0.7 : 0.6), 0, 0, Math.PI * 2);
        ctx.fillStyle = row > 0.5 ? col.accent : shade(col.accent, -0.1);
        ctx.fill();
        ctx.lineWidth = lw;
        ctx.strokeStyle = ol;
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(-r * 0.2, -r * 0.2, r * 0.4, r * 0.2, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fill();
        ctx.restore();
      }
    }
  }
  if (f.spikes) {
    const spk = f.spikes;
    for (let k = 0; k < spk.n; k++) {
      const fr = spk.n > 1 ? k / (spk.n - 1) : 0.5;
      const s = S(lerp(spk.from, spk.to, fr));
      const h = spk.h * (0.7 + 0.3 * Math.sin(Math.PI * fr));
      const bw = h * 0.42;
      const bx = s.x + s.nx * s.w * 0.88, by = s.y + s.ny * s.w * 0.88;
      ctx.beginPath();
      ctx.moveTo(bx - s.tx * bw, by - s.ty * bw);
      ctx.lineTo(bx + s.nx * h - s.tx * h * 0.35, by + s.ny * h - s.ty * h * 0.35);
      ctx.lineTo(bx + s.tx * bw, by + s.ty * bw);
      ctx.closePath();
      ctx.fillStyle = shade(col.accent, 0.1);
      ctx.fill();
      ctx.strokeStyle = ol;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }
  if (f.club) {
    const s = S(0.03);
    const r = f.club;
    ctx.save();
    ctx.translate(s.x - s.tx * r * 0.7, s.y - s.ty * r * 0.7);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.2, r * 0.95, 0, 0, Math.PI * 2);
    ctx.fillStyle = col.accent;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = ol;
    ctx.stroke();
    for (const [dx, dy] of [[-0.3, -0.85], [0.35, -0.85], [-0.2, 0.9], [0.5, 0.2]]) {
      ctx.beginPath();
      ctx.moveTo(dx * r - r * 0.18, dy * r * 0.9);
      ctx.lineTo(dx * r * 1.25, dy * r * 1.25);
      ctx.lineTo(dx * r + r * 0.18, dy * r * 0.9);
      ctx.closePath();
      ctx.fillStyle = shade(col.accent, 0.3);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
  if (f.feathers) {
    const s = S(0.02);
    const base: Pt = [s.x, s.y];
    for (let i = 0; i < 7; i++) {
      const fa = Math.PI + (i - 3) * 0.17 + Math.sin(pose.t * 3 + i) * 0.03;
      const len = 0.1 - Math.abs(i - 3) * 0.008;
      ctx.beginPath();
      ctx.moveTo(base[0], base[1]);
      ctx.quadraticCurveTo(base[0] + Math.cos(fa) * len * 0.5, base[1] + Math.sin(fa) * len * 0.5 - 0.01, base[0] + Math.cos(fa) * len, base[1] + Math.sin(fa) * len);
      ctx.lineWidth = 0.012;
      ctx.lineCap = 'round';
      ctx.strokeStyle = i % 2 ? col.accent : shade(col.accent, 0.3);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  drawArm(true, 0.0);

  // ------------------------------------------------------------------- head
  let headAng = lerp(sh.head.ang ?? 0.15, 1.18, lowerHead) + Math.sin(pose.t * 9) * 0.05 * pose.happy;
  if (sleep > 0.5) headAng = lerp(headAng, 1.0, sleep);
  ctx.lineWidth = lw;
  drawHead(c, e[0] - 0.012, e[1], headAng);
  ctx.lineCap = 'butt';
}

/* -------------------------------------------------------------------------- */
/*  Pterosaur                                                                 */
/* -------------------------------------------------------------------------- */

function drawPtero(c: Ctx2) {
  const { ctx, sp, pose, lw, ol } = c;
  const sh = sp.shape;
  const col = sp.colors;
  const f = sh.feats ?? {};
  const fold = pose.fold;
  const bl = sh.bodyLen;
  const wingL = clamp(0.5 + sp.length * 0.1, 0.7, 1.15);
  const cy = -(sh.legH * fold + 0.06 + sh.bodyH * 0.5) + Math.sin(pose.t * 2) * 0.004 * (1 - fold);
  const keys: Key[] = [];
  const tl = sh.tail.len;
  const wag = Math.sin(pose.phase * 0.5) * 0.01;
  keys.push({ x: -bl / 2 - tl, y: cy + 0.01 + wag, w: 0.004 });
  keys.push({ x: -bl / 2 - tl * 0.5, y: cy + 0.004 + wag * 0.5, w: sh.bodyH * 0.12 });
  keys.push({ x: -bl / 2, y: cy, w: sh.bodyH * 0.4 });
  keys.push({ x: 0, y: cy - 0.004, w: sh.bodyH * 0.5 });
  keys.push({ x: bl / 2, y: cy - 0.012, w: sh.bodyH * 0.42 });
  keys.push({ x: bl / 2 + sh.neck.len * 0.5, y: cy - 0.03, w: sh.bodyH * 0.25 });
  const end: Pt = [bl / 2 + sh.neck.len * 0.95, cy - 0.055 + 0.02 * pose.headLower];
  keys.push({ x: end[0], y: end[1], w: sh.bodyH * 0.2 });
  const { samples } = resample(keys.map((k) => ({ ...k, w: k.w * 1.5 })), 4);

  const rootX = bl * 0.12;
  const rootY = cy - 0.025;
  const backX = -bl * 0.32, backY = cy + 0.015;

  const wing = (near: boolean, off: number) => {
    const flap = pose.flap;
    const aFly = Math.sin(pose.phase + off) * 0.85 * flap + 0.2 * flap;
    const a = lerp(aFly, -0.1, fold);
    const L = wingL * lerp(1, 0.42, fold);
    const rx = rootX + (near ? 0 : -0.03), ry = rootY + (near ? 0 : -0.01);
    const tip: Pt = [rx + L * (-0.5 * Math.cos(a) - 0.1 * fold), ry - L * (Math.sin(a) * 0.9 + 0.15 * (1 - fold)) + (fold > 0.5 ? L * 0.15 : 0)];
    const wrist: Pt = [rx + (tip[0] - rx) * 0.45 + L * 0.08, ry + (tip[1] - ry) * 0.45 - L * 0.1 * (1 - fold * 0.7)];
    const mid: Pt = [(tip[0] + backX) / 2 - L * 0.04, (tip[1] + backY) / 2 + L * 0.12];
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(wrist[0], wrist[1]);
    ctx.lineTo(tip[0], tip[1]);
    ctx.quadraticCurveTo(mid[0] + L * 0.1, mid[1] + L * 0.05, mid[0], mid[1]);
    ctx.quadraticCurveTo((mid[0] + backX) / 2, (mid[1] + backY) / 2 + L * 0.06, backX, backY);
    ctx.closePath();
    const g = ctx.createLinearGradient(rx, ry, tip[0], tip[1]);
    const wc = col.extra ?? col.body;
    g.addColorStop(0, near ? shade(wc, 0.15) : shade(wc, -0.1));
    g.addColorStop(1, near ? wc : shade(wc, -0.2));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = ol;
    ctx.stroke();
    ctx.strokeStyle = shade(wc, -0.4, 0.8);
    ctx.lineWidth = lw * 0.8;
    for (const t of [0.35, 0.65]) {
      ctx.beginPath();
      ctx.moveTo(wrist[0], wrist[1]);
      ctx.lineTo(lerp(tip[0], backX, t), lerp(tip[1], backY, t) + (t - 0.2) * L * 0.1);
      ctx.stroke();
    }
    ctx.strokeStyle = ol;
  };

  wing(false, 0.6);

  // legs
  ctx.lineCap = 'round';
  const legBase: Pt = [-bl * 0.15, cy + 0.02];
  if (fold > 0.5) {
    for (const k of [0, 1]) {
      const sw = Math.sin(pose.phase + k * Math.PI) * 0.03 * pose.moving;
      const lf = Math.max(0, Math.cos(pose.phase + k * Math.PI)) * 0.02 * pose.moving;
      drawLeg(c, legBase[0] + 0.02, legBase[1], legBase[0] + 0.02 + sw, 0, lf, 1.1, 1, k ? col.body : c.far, 0.017, 0.012, true);
    }
  } else {
    limb(ctx, [legBase, [legBase[0] - 0.06, legBase[1] + 0.025]], [0.016], col.body, ol, lw);
  }

  tubePath(ctx, samples);
  ctx.fillStyle = col.body;
  ctx.fill();
  ctx.save();
  tubePath(ctx, samples);
  ctx.clip();
  ctx.beginPath();
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (i === 0) ctx.moveTo(s.x - s.nx * s.w * 0.1, s.y - s.ny * s.w * 0.1);
    else ctx.lineTo(s.x - s.nx * s.w * 0.1, s.y - s.ny * s.w * 0.1);
  }
  for (let i = samples.length - 1; i >= 0; i--) ctx.lineTo(samples[i].x - samples[i].nx * samples[i].w * 2, samples[i].y - samples[i].ny * samples[i].w * 2);
  ctx.closePath();
  ctx.fillStyle = col.belly;
  ctx.fill();
  ctx.restore();
  tubePath(ctx, samples);
  ctx.lineWidth = lw;
  ctx.strokeStyle = ol;
  ctx.stroke();

  if (f.longTail) {
    const s = samples[0];
    ctx.beginPath();
    ctx.moveTo(s.x + 0.012, s.y);
    ctx.lineTo(s.x - 0.02, s.y - 0.028);
    ctx.lineTo(s.x - 0.055, s.y);
    ctx.lineTo(s.x - 0.02, s.y + 0.028);
    ctx.closePath();
    ctx.fillStyle = col.accent;
    ctx.fill();
    ctx.stroke();
  }

  wing(true, 0);

  const hAng = lerp(sh.head.ang ?? 0.1, 0.7, pose.headLower) + (fold < 0.5 ? 0.2 : 0);
  drawHead(c, end[0] - 0.01, end[1], hAng);
  ctx.lineCap = 'butt';
}

/* -------------------------------------------------------------------------- */
/*  Turtle-like marine reptile                                                */
/* -------------------------------------------------------------------------- */

function drawTurtle(c: Ctx2) {
  const { ctx, sp, pose, lw, ol, far } = c;
  const sh = sp.shape;
  const col = sp.colors;
  const f = sh.feats ?? {};
  const k = sh.bodyLen / 0.5;
  const y0 = -0.045 + Math.sin(pose.t * 1.4) * 0.006;
  const fl = f.flipper ?? 1;
  const flapAmp = 0.25 + pose.moving * 0.5;
  const fa = (off: number) => Math.sin(pose.phase * 1.2 + off) * flapAmp;

  ctx.save();
  ctx.translate(0, y0);
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw / k;
  ctx.strokeStyle = ol;
  const lwl = lw / k;

  const flipper = (x: number, y: number, len: number, wid: number, rot: number, fill: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, -wid * 0.5);
    ctx.quadraticCurveTo(len * 0.6, -wid * 0.9, len, -wid * 0.1);
    ctx.quadraticCurveTo(len * 0.5, wid * 0.7, 0, wid * 0.5);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = lwl;
    ctx.stroke();
    ctx.restore();
  };

  // far flippers
  flipper(0.12, 0.0, 0.22 * fl, 0.06, 0.5 + fa(Math.PI), far);
  flipper(-0.2, -0.01, 0.12 * Math.min(fl, 1), 0.045, 2.6 + fa(1) * 0.5, far);

  // neck + head
  const ext = 0.04 * Math.sin(pose.t * 1.2) + 0.03 * (1 - pose.sleep);
  const hx = 0.3 + sh.neck.len + ext;
  const hyy = -0.1 + pose.headLower * 0.05;
  limb(ctx, [[0.2, -0.08], [0.3, -0.1], [hx - 0.03, hyy]], [0.055, 0.05], col.body, ol, lwl);

  // shell
  const box = !!f.boxShell;
  const pts: Pt[] = box
    ? [[-0.31, -0.01], [-0.33, -0.12], [-0.2, -0.2], [0.0, -0.215], [0.2, -0.2], [0.33, -0.12], [0.31, -0.01], [0.0, 0.02]]
    : [[-0.33, -0.015], [-0.31, -0.1], [-0.17, -0.19], [0.05, -0.23], [0.24, -0.17], [0.33, -0.07], [0.29, -0.005], [0.0, 0.02]];
  ctx.beginPath();
  smoothClosed(ctx, pts);
  const sc = col.extra ?? col.body;
  const g = ctx.createLinearGradient(0, -0.23, 0, 0.02);
  g.addColorStop(0, shade(sc, 0.25));
  g.addColorStop(0.55, sc);
  g.addColorStop(1, shade(sc, -0.25));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // scutes
  ctx.strokeStyle = shade(sc, -0.4, 0.7);
  ctx.lineWidth = lwl * 1.3;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 0.085, -0.22);
    ctx.quadraticCurveTo(i * 0.1, -0.12, i * 0.115, 0.0);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-0.34, -0.1);
  ctx.quadraticCurveTo(0, -0.09, 0.34, -0.1);
  ctx.stroke();
  ctx.fillStyle = shade(col.accent, 0, 0.55);
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.ellipse(i * 0.12, -0.155, 0.032, 0.02, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.ellipse(-0.05, -0.2, 0.2, 0.025, -0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  smoothClosed(ctx, pts);
  ctx.strokeStyle = ol;
  ctx.lineWidth = lwl;
  ctx.stroke();
  // rim
  ctx.beginPath();
  ctx.moveTo(-0.32, -0.012);
  ctx.quadraticCurveTo(0, 0.03, 0.31, -0.012);
  ctx.strokeStyle = col.belly;
  ctx.lineWidth = 0.022;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineCap = 'butt';

  // near flippers
  flipper(0.14, -0.015, 0.26 * fl, 0.07, 0.65 + fa(0), col.body);
  flipper(-0.22, -0.02, 0.14 * Math.min(fl, 1), 0.05, 2.7 + fa(2) * 0.5, col.body);

  // head
  const sub = { ...c, lw: lwl };
  const hsp = sp;
  void hsp;
  drawHead(sub, hx, hyy, lerp(sh.head.ang ?? 0.05, 0.5, pose.headLower));
  ctx.restore();
}

/* -------------------------------------------------------------------------- */

export function drawDino(ctx: CanvasRenderingContext2D, sp: Species, pose: Pose, px: number) {
  const sh = sp.shape;
  const lw = Math.max(0.005, 1.6 / px);
  const c: Ctx2 = { ctx, sp, pose, lw, ol: shade(sp.colors.body, -0.62), far: shade(sp.colors.body, -0.28) };
  ctx.save();
  ctx.lineJoin = 'round';

  const swim = pose.swim;
  if (swim > 0.01) {
    const turtle = sh.kind === 'turtle';
    const waterY = turtle ? -0.035 : -sh.bodyH * 0.12 - 0.01;
    ctx.beginPath();
    ctx.rect(-4, -6, 8, 6 + waterY);
    ctx.clip();
    if (!turtle) ctx.translate(0, swim * (sh.legH + sh.bodyH * 0.38) + Math.sin(pose.t * 2) * 0.006 * swim);
  }

  if (sh.kind === 'ptero') drawPtero(c);
  else if (sh.kind === 'turtle') drawTurtle(c);
  else drawLand(c);
  ctx.restore();
}

/** Draw a species centred inside a small canvas (field guide / portraits). */
export function drawPortrait(canvas: HTMLCanvasElement, sp: Species, opts: { dim?: boolean } = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const sh = sp.shape;
  let uw = 1.05, uh = sp.hitH + 0.06;
  if (sh.kind === 'ptero') { uw = 1.5; uh = 0.75; }
  if (sh.kind === 'turtle') { uw = 0.95; uh = 0.34; }
  const scale = Math.min((w * 0.94) / uw, (h * 0.9) / uh);
  ctx.save();
  ctx.translate(w / 2, h * 0.5 + (uh * scale) / 2 - (sh.kind === 'ptero' ? uh * scale * 0.05 : 0) - h * 0.02);
  ctx.scale(scale, scale);
  const pose = makePose({ t: 1.2, headLower: 0, flap: 0.6, phase: 0.9, fold: 0 });
  if (opts.dim) ctx.filter = 'grayscale(1) brightness(0.55) contrast(0.8)';
  // centre horizontally using the rough bounding box of the unit space
  const cx = sh.kind === 'turtle' ? 0.08 : sh.kind === 'ptero' ? -0.05 : (sh.neck.len * 0.3 - sh.tail.len * 0.3) * 0.5;
  ctx.translate(-cx, 0);
  drawDino(ctx, sp, pose, scale);
  ctx.restore();
}
