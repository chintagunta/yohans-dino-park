import { HORIZON, hash01 } from '../world';
import { mulberry32 } from './util';

type C = CanvasRenderingContext2D;

/** Noah's ark, ~75 % built, on a far-background plateau (parallax layer ARK_F). */
export const ARK_F = 0.58;
const CELL = 4200;
export const ARK_SC = 0.72;
export const ARK_START = 1550; // where pairs of animals come into view, from the ark
export const ARK_RAMP0 = 300 * ARK_SC; // foot of the ramp
export const ARK_DOOR = 172 * ARK_SC; // hull door
export const ARK_RAMP_H = 46 * ARK_SC;
export const ARK_GY = HORIZON - 16;

export interface ArkSite { k: number; x: number; y: number; a: 1 | -1 }

/** Ark sites in view. `a` = direction the animals walk (+1: arrive from the left). */
export function arkSites(camX: number, viewW: number): ArkSite[] {
  const out: ArkSite[] = [];
  const u0 = camX * ARK_F;
  for (let k = Math.floor((u0 - 1900) / CELL); k <= Math.floor((u0 + viewW + 1900) / CELL); k++) {
    if (k === -1) continue;
    if (k !== 0 && hash01(k, 201) < 0.45) continue;
    const u = k === 0 ? 760 : k * CELL + 1900 + hash01(k, 202) * 400;
    out.push({ k, x: u - u0, y: ARK_GY, a: k === 0 ? 1 : hash01(k, 203) > 0.5 ? 1 : -1 });
  }
  return out;
}

function plank(ctx: C, x: number, y: number, w: number, h: number, c1: string, c2: string, seam: string) {
  ctx.fillStyle = c1;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = c2;
  ctx.fillRect(x, y + h * 0.55, w, h * 0.45);
  ctx.fillStyle = seam;
  ctx.fillRect(x, y + h - 1, w, 1);
}

function person(ctx: C, x: number, y: number, t: number, ph: number, col: string, hammer: boolean) {
  const sw = Math.sin(t * 6 + ph);
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#4a3322';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-1.5, -9); ctx.lineTo(-2.5, 0);
  ctx.moveTo(1.5, -9); ctx.lineTo(2.5, 0);
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.fillRect(-3.5, -17, 7, 9);
  ctx.beginPath();
  ctx.arc(0, -20, 3.1, 0, 6.28);
  ctx.fillStyle = '#e6b48a';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -21.3, 3.2, Math.PI, 0);
  ctx.fillStyle = '#5a3b22';
  ctx.fill();
  // arm with hammer
  const ang = hammer ? -0.9 + sw * 0.9 : -0.3 + sw * 0.35;
  const ax = Math.cos(ang) * 8, ay = -14 + Math.sin(ang) * 8;
  ctx.strokeStyle = '#e6b48a';
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(2, -14); ctx.lineTo(ax, ay); ctx.stroke();
  if (hammer) {
    ctx.strokeStyle = '#5a3b22';
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + Math.cos(ang - 1.2) * 4, ay + Math.sin(ang - 1.2) * 4); ctx.stroke();
    ctx.fillStyle = '#555';
    ctx.fillRect(ax + Math.cos(ang - 1.2) * 4 - 2, ay + Math.sin(ang - 1.2) * 4 - 1.5, 4, 3);
  }
  ctx.restore();
}

/** The ark itself, local coords: ground at y = 0, ramp on the left, unfinished end on the right. */
function ark(ctx: C, t: number, night: number) {
  const XB = -170 + 0.75 * 340; // build front: everything left of this is finished
  const hull = () => {
    ctx.beginPath();
    ctx.moveTo(-178, -80);
    ctx.bezierCurveTo(-182, -30, -132, -6, -90, -6);
    ctx.lineTo(90, -6);
    ctx.bezierCurveTo(132, -6, 182, -30, 178, -80);
    ctx.closePath();
  };

  // ground clutter behind: keel blocks
  ctx.fillStyle = '#6b4a2b';
  for (const bx of [-130, -45, 45, 130]) ctx.fillRect(bx - 12, -8, 24, 8);

  // ---- hull: dark interior + ribs, then planks row by row up to the build front
  ctx.save();
  hull();
  ctx.fillStyle = '#34220f';
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = '#b47c45';
  ctx.lineWidth = 5;
  for (let x = XB - 4; x < 190; x += 17) {
    ctx.beginPath();
    ctx.moveTo(x, -82);
    ctx.quadraticCurveTo(x + (x - XB) * 0.12, -40, x * 0.86, -4);
    ctx.stroke();
  }
  const rnd = mulberry32(77);
  for (let y = -84, i = 0; y < -4; y += 9, i++) {
    const lim = XB + (rnd() - 0.4) * 46;
    plank(ctx, -200, y, lim + 200, 9, i % 2 ? '#a87140' : '#b27a46', i % 2 ? '#94602f' : '#9d6a38', 'rgba(50,28,10,0.55)');
  }
  ctx.restore();
  // gunwale
  ctx.fillStyle = '#6a4424';
  ctx.fillRect(-182, -86, XB + 182 + 6, 7);
  ctx.fillStyle = '#4a2f18';
  ctx.fillRect(XB + 6, -84, 180 - XB, 4);
  // door
  ctx.fillStyle = '#2a1a0a';
  ctx.fillRect(-176, -76, 12, 34);

  // ---- cabin: finished wall + roof left of the front, posts / rafters beyond
  ctx.save();
  ctx.beginPath(); ctx.rect(-200, -190, XB + 200, 120); ctx.clip();
  for (let y = -142, i = 0; y < -86; y += 9, i++) plank(ctx, -140, y, 280, 9, i % 2 ? '#bd8c56' : '#c8975e', '#a77846', 'rgba(70,40,16,0.5)');
  ctx.fillStyle = '#2d1c0c';
  for (const wx of [-100, -50, 0, 50]) { ctx.fillRect(wx, -128, 11, 14); ctx.fillStyle = night > 0.3 ? `rgba(255,200,90,${0.9 * night})` : '#2d1c0c'; ctx.fillRect(wx + 1, -127, 9, 12); ctx.fillStyle = '#2d1c0c'; }
  // roof
  ctx.beginPath();
  ctx.moveTo(-156, -140); ctx.lineTo(-112, -178); ctx.lineTo(112, -178); ctx.lineTo(156, -140); ctx.closePath();
  ctx.fillStyle = '#7c4b2a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,20,8,0.5)';
  ctx.lineWidth = 1;
  for (let y = -174; y < -142; y += 7) { ctx.beginPath(); ctx.moveTo(-170, y); ctx.lineTo(170, y); ctx.stroke(); }
  ctx.fillStyle = '#5c3318';
  ctx.fillRect(-160, -143, 320, 5);
  ctx.restore();

  // unfinished end of the cabin: posts, beams, a few loose rafters
  ctx.strokeStyle = '#c28f58';
  ctx.lineWidth = 5;
  for (let x = XB + 10; x <= 140; x += 28) { ctx.beginPath(); ctx.moveTo(x, -86); ctx.lineTo(x, -140); ctx.stroke(); }
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(XB + 4, -140); ctx.lineTo(150, -140); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(XB + 4, -178); ctx.lineTo(112, -178); ctx.lineTo(156, -140); ctx.stroke();
  for (let x = XB + 4; x <= 112; x += 24) { ctx.beginPath(); ctx.moveTo(x, -140); ctx.lineTo(x, -178); ctx.stroke(); }
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(XB + 28, -86); ctx.lineTo(XB + 56, -140); ctx.moveTo(XB + 56, -86); ctx.lineTo(XB + 28, -140); ctx.stroke();

  // ---- ramp up to the door
  ctx.fillStyle = '#9b6b3a';
  ctx.beginPath();
  ctx.moveTo(-300, 0); ctx.lineTo(-172, -48); ctx.lineTo(-172, -42); ctx.lineTo(-296, 4); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#5b3a1c';
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 9; i++) { const f = i / 9; ctx.beginPath(); ctx.moveTo(-300 + f * 128, -f * 48 + 4); ctx.lineTo(-300 + f * 128, -f * 48 - 1); ctx.stroke(); }

  // ---- scaffolding on the open end
  ctx.strokeStyle = '#d2a56a';
  ctx.lineWidth = 3.5;
  for (const px of [168, 205, 242]) { ctx.beginPath(); ctx.moveTo(px, 2); ctx.lineTo(px, -170); ctx.stroke(); }
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const y0 = -(i * 56);
    ctx.beginPath(); ctx.moveTo(168, y0); ctx.lineTo(205, y0 - 56); ctx.moveTo(205, y0); ctx.lineTo(168, y0 - 56); ctx.moveTo(205, y0); ctx.lineTo(242, y0 - 56); ctx.stroke();
  }
  for (const py of [-56, -112]) plank(ctx, 150, py, 110, 5, '#c79a5c', '#b0834a', 'rgba(60,36,12,0.5)');
  // ladder
  ctx.strokeStyle = '#a97b45';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(262, 0); ctx.lineTo(262, -112); ctx.moveTo(272, 0); ctx.lineTo(272, -112); ctx.stroke();
  ctx.lineWidth = 1.5;
  for (let y = -6; y > -112; y -= 9) { ctx.beginPath(); ctx.moveTo(262, y); ctx.lineTo(272, y); ctx.stroke(); }
  // builders
  person(ctx, 195, -112, t, 0.4, '#b85c38', true);
  person(ctx, 232, -56, t, 2.1, '#3f7ab0', true);
  person(ctx, 150, -86 - 0, t, 4.0, '#6a9a48', true);
  person(ctx, 300, 0, t, 1.2, '#c9a23a', false);
  person(ctx, -240, 0, t, 3.3, '#8a5ab0', false);

  // ---- derrick lifting a beam
  ctx.strokeStyle = '#8f6334';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(335, 2); ctx.lineTo(335, -205); ctx.moveTo(335, -205); ctx.lineTo(180, -196); ctx.moveTo(335, -120); ctx.lineTo(290, -200); ctx.stroke();
  const ly = -150 - Math.sin(t * 0.45) * 22;
  const lx = 182 + Math.sin(t * 1.3) * 3;
  ctx.strokeStyle = '#d8c29a';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(180, -196); ctx.lineTo(lx - 24, ly); ctx.moveTo(180, -196); ctx.lineTo(lx + 24, ly); ctx.stroke();
  ctx.save();
  ctx.translate(lx, ly);
  ctx.rotate(Math.sin(t * 1.3) * 0.04);
  plank(ctx, -30, -3, 60, 7, '#b57d46', '#9a6634', 'rgba(50,28,10,0.6)');
  ctx.restore();

  // ---- piles on the ground: logs, planks, camp fire
  for (let i = 0; i < 6; i++) {
    const r = 5.5;
    const row = i < 3 ? 0 : i < 5 ? 1 : 2;
    ctx.beginPath();
    ctx.arc(-196 + (i < 3 ? i * 11 : i < 5 ? (i - 3) * 11 + 5.5 : 11), -r - row * 9, r, 0, 6.28);
    ctx.fillStyle = '#8b5a2e';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-196 + (i < 3 ? i * 11 : i < 5 ? (i - 3) * 11 + 5.5 : 11), -r - row * 9, r * 0.5, 0, 6.28);
    ctx.fillStyle = '#d6aa72';
    ctx.fill();
  }
  for (let i = 0; i < 4; i++) plank(ctx, 360, -3 - i * 4, 52, 3.5, '#c79a5c', '#b0834a', 'rgba(60,36,12,0.4)');
  // fire + smoke
  const fx = 345, fy = 0;
  for (let k = 0; k < 6; k++) {
    const f = (t * 0.35 + k / 6) % 1;
    ctx.beginPath();
    ctx.arc(fx + Math.sin(f * 6 + k) * 6 + f * 14, fy - 10 - f * 70, 3 + f * 9, 0, 6.28);
    ctx.fillStyle = `rgba(190,190,195,${0.42 * (1 - f)})`;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(fx - 5, fy); ctx.quadraticCurveTo(fx - 2 + Math.sin(t * 9) * 1.5, fy - 12, fx + Math.sin(t * 7), fy - 14); ctx.quadraticCurveTo(fx + 3, fy - 8, fx + 5, fy);
  ctx.fillStyle = '#ff9a30';
  ctx.fill();

  if (night > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [gx, gy, gr] of [[fx, -8, 55], [190, -118, 42], [-70, -120, 50]] as const) {
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      g.addColorStop(0, `rgba(255,170,70,${0.5 * night})`);
      g.addColorStop(1, 'rgba(255,150,50,0)');
      ctx.fillStyle = g;
      ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    }
    ctx.restore();
  }
}

/**
 * Draws the ark layer (plateau + ark) for each site, then lets the caller draw
 * the walking pairs on top before the nearer hills cover the foot of it.
 */
export function drawArkLayer(
  ctx: C, camX: number, viewW: number, t: number, night: number, grass: string,
  pairs?: (sites: ArkSite[]) => void,
) {
  const sites = arkSites(camX, viewW);
  for (const s of sites) {
    // plateau the ark stands on + a worn path leading in
    ctx.beginPath();
    ctx.moveTo(s.x - 1850, s.y + 50);
    ctx.bezierCurveTo(s.x - 1700, s.y + 50, s.x - 1650, s.y + 4, s.x - 1450, s.y + 4);
    ctx.lineTo(s.x + 1450, s.y + 4);
    ctx.bezierCurveTo(s.x + 1650, s.y + 4, s.x + 1700, s.y + 50, s.x + 1850, s.y + 50);
    ctx.closePath();
    ctx.fillStyle = grass;
    ctx.fill();
    ctx.fillStyle = 'rgba(205,170,110,0.55)';
    ctx.fillRect(s.x - 1500, s.y + 4, 3000, 5);

    ctx.save();
    ctx.translate(s.x, s.y + 3);
    ctx.scale(s.a * ARK_SC, ARK_SC);
    ark(ctx, t, night);
    ctx.restore();
  }
  if (pairs && sites.length) pairs(sites);
}
