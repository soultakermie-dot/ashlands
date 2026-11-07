// План рельєфу «Зелені пагорби» 320 × 240 м: де пагорби, стежки, тераса, западина, річка, скелі, ліс.
// Головне — heightAt(x, z): висота землі в будь-якій точці. Інші файли беруть звідси «маски» (ліс, скелі, річка).
//   Центр (160 × 120) — пагорби, бруковані стежки, тераса на 3 рівні, западина зі сходами.
//   Позаду (z < -80) — скелі (туди не пройти), з ущелини витікає річка.
//   Схід — річка з кам'яним мостом. Захід — ліс, крізь нього стежка-вихід. Спереду — луки.
import { clamp, lerp, makeNoise, smoothstep } from '../../lib/noise.js';

// ---------- Розміри ----------
export const X0 = -160; export const X1 = 160; export const Z0 = -120; export const Z1 = 120;
export const BOTTOM = -12;           // низ «зрізу» ґрунту
export const PATH_Y = 0.15;          // висота стежок
export const HALF = 1.8;             // пів ширини стежки
export const STAIR_HALF = 1.6;       // пів ширини сходів
export const WATER_Y = -0.5;         // рівень води в річці
export const RIVER_HALF = 6;         // пів ширини річки (до берега)
export const inside = (x, z) => x >= X0 - 1e-6 && x <= X1 + 1e-6 && z >= Z0 - 1e-6 && z <= Z1 + 1e-6;

export const { fbm, noise } = makeNoise(7);

// ---------- Пагорби ----------
const HILLS = [
  // центр
  { x: -45, z: 26, rx: 17, rz: 15, h: 12 }, { x: -30, z: 38, rx: 9, rz: 9, h: 6 }, { x: -10, z: -32, rx: 20, rz: 9, h: 9 },
  { x: -40, z: -22, rx: 12, rz: 11, h: 7 }, { x: -64, z: -24, rx: 9, rz: 10, h: 5 }, { x: 4, z: 37, rx: 11, rz: 11, h: 8 },
  { x: 35, z: 5, rx: 7, rz: 5, h: 3 }, { x: 40, z: -46, rx: 11, rz: 9, h: 6 }, { x: 74, z: 40, rx: 5, rz: 11, h: 3 },
  { x: -28, z: -2, rx: 6, rz: 5, h: 2.5 },
  // луки спереду
  { x: 20, z: 98, rx: 22, rz: 13, h: 6 }, { x: -52, z: 96, rx: 18, rz: 12, h: 5 }, { x: 92, z: 98, rx: 12, rz: 10, h: 4 },
  { x: -100, z: 105, rx: 16, rz: 10, h: 6 },
  // за річкою
  { x: 150, z: 40, rx: 10, rz: 18, h: 6 }, { x: 150, z: -55, rx: 10, rz: 12, h: 7 }, { x: 148, z: 0, rx: 8, rz: 8, h: 3 },
  // ліс
  { x: -122, z: 68, rx: 20, rz: 18, h: 8 }, { x: -128, z: -42, rx: 18, rz: 16, h: 7 }, { x: -112, z: -2, rx: 12, rz: 10, h: 4 },
];
export function hills(x, z) {
  let h = 0;
  const wobble = 1 + 0.3 * noise(x * 0.08, z * 0.08);
  for (const H of HILLS) {
    const r2 = (((x - H.x) / H.rx) ** 2 + ((z - H.z) / H.rz) ** 2) * wobble;
    if (r2 < 6) h += H.h * Math.exp(-r2 * 1.3) * (1 + 0.12 * noise(x * 0.3 + H.x, z * 0.3));
  }
  return h;
}

// ---------- Криві (стежки, річка) ----------
// Плавна крива через точки (Catmull-Rom), точки кожні 0.25 м з напрямком.
export function sampleCurve({ pts, closed }) {
  const P = closed ? pts : [pts[0], ...pts, pts[pts.length - 1]];
  const n = closed ? P.length : P.length - 3;
  const at = (i) => P[(i + P.length) % P.length];
  const out = [];
  for (let s = 0; s < n; s++) {
    const [p0, p1, p2, p3] = closed ? [at(s - 1), at(s), at(s + 1), at(s + 2)] : [P[s], P[s + 1], P[s + 2], P[s + 3]];
    const steps = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.25));
    for (let k = 0; k < steps; k++) {
      const t = k / steps; const t2 = t * t; const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      const df = (a, b, c, d) => 0.5 * ((-a + c) + 2 * (2 * a - 5 * b + 4 * c - d) * t + 3 * (-a + 3 * b - 3 * c + d) * t2);
      let tx = df(p0[0], p1[0], p2[0], p3[0]); let tz = df(p0[1], p1[1], p2[1], p3[1]);
      const l = Math.hypot(tx, tz) || 1;
      tx /= l; tz /= l;
      out.push({ x: f(p0[0], p1[0], p2[0], p3[0]), z: f(p0[1], p1[1], p2[1], p3[1]), tx, tz });
    }
  }
  if (!closed) { const e = pts[pts.length - 1]; const last = out[out.length - 1]; out.push({ x: e[0], z: e[1], tx: last.tx, tz: last.tz }); }
  return out;
}

// Мережа стежок (бруківка).
export const NETWORK = {
  loop: { closed: true, pts: [[-12, 5], [-25, 7], [-40, 3], [-56, 2], [-68, 12], [-71, 30], [-64, 47], [-48, 54], [-30, 52], [-18, 42], [-13, 25]] },
  front: { pts: [[-95, 25], [-97, 2], [-88, -28], [-60, -50], [-35, -54], [-10, -52], [10, -46], [18, -34], [14, -20], [6, -8], [-4, 0], [-12, 5]] },
  terrace: { pts: [[-12, 5], [0, 15], [12, 20], [19.8, 30.4]] },
  hollow: { pts: [[6, -8], [12, -11], [18.2, -12]] },
  ring: { pts: [[14, -20], [22, -28], [40, -27], [54, -22], [64, -12], [70, 4], [70, 15], [58, 17], [40, 15], [26, 17], [12, 20]] },
  back: { pts: [[-18, 42], [-5, 50], [10, 54], [24, 57], [40, 58.5], [55, 59.9]] },
  meadow: { pts: [[55, 59.9], [70, 74], [58, 94], [25, 100], [-10, 92], [-35, 78], [-48, 54]] },
  forest: { pts: [[-71, 30], [-95, 25], [-118, 34], [-138, 27], [-159.9, 31]] },       // вихід через ліс
  bridge: { pts: [[70, 4], [88, 2], [106, -4], [118, -7], [132, -9], [144, -3], [150, 12]] },  // через міст на схід
};
export const PATHS = Object.values(NETWORK).map(sampleCurve);
export const RIVER = sampleCurve({ pts: [[110, -120], [108, -98], [102, -76], [110, -45], [123, -12], [118, 25], [127, 60], [139, 92], [146, 120]] });

// ---------- Поля відстаней (на сітці 0.5 м) ----------
const DSTEP = 0.5;
const DNX = Math.round((X1 - X0) / DSTEP) + 1;
const DNZ = Math.round((Z1 - Z0) / DSTEP) + 1;
function distanceField(curves, radius) {
  const grid = new Float32Array(DNX * DNZ).fill(1e9);
  const r = Math.ceil(radius / DSTEP);
  for (const curve of curves) {
    for (const p of curve) {
      const ci = Math.round((p.x - X0) / DSTEP); const cj = Math.round((p.z - Z0) / DSTEP);
      for (let j = Math.max(0, cj - r); j <= Math.min(DNZ - 1, cj + r); j++) {
        for (let i = Math.max(0, ci - r); i <= Math.min(DNX - 1, ci + r); i++) {
          const d = Math.hypot(X0 + i * DSTEP - p.x, Z0 + j * DSTEP - p.z);
          if (d < grid[j * DNX + i]) grid[j * DNX + i] = d;
        }
      }
    }
  }
  return (x, z) => {
    const fx = clamp((x - X0) / DSTEP, 0, DNX - 1.001); const fz = clamp((z - Z0) / DSTEP, 0, DNZ - 1.001);
    const i = Math.floor(fx); const j = Math.floor(fz); const u = fx - i; const v = fz - j;
    const g = (a, b) => Math.min(grid[b * DNX + a], radius + 1);
    return lerp(lerp(g(i, j), g(i + 1, j), u), lerp(g(i, j + 1), g(i + 1, j + 1), u), v);
  };
}
export const pathDist = distanceField(PATHS, 9);
export const riverDist = distanceField([RIVER], 18);

// ---------- Тераса й западина (еліпси) ----------
function ellipse(e) {
  const ex = e.a * Math.cos(e.phi); const ez = e.b * Math.sin(e.phi);
  e.len = Math.hypot(ex, ez); e.ux = ex / e.len; e.uz = ez / e.len;
  return e;
}
export const TER = ellipse({ x: 48, z: 36, a: 26, b: 17, phi: (197 * Math.PI) / 180,
  flights: [{ s0: 1.1, s1: 1.0, y0: PATH_Y, y1: 1.7 }, { s0: 0.82, s1: 0.72, y0: 1.7, y1: 3.4 }, { s0: 0.55, s1: 0.45, y0: 3.4, y1: 4.9 }] });
export const RINGS = [[0.84, 0.96], [0.5, 0.64]];    // кільцеві стежки на терасі
export const FLOOR = -2.4;                              // дно западини
export const HOL = ellipse({ x: 36, z: -12, a: 16, b: 8, phi: Math.PI, flights: [{ s0: 1.12, s1: 0.88, y0: PATH_Y, y1: FLOOR }] });

export const relS = (e, x, z) => Math.hypot((x - e.x) / e.a, (z - e.z) / e.b);
export function corridor(e, x, z) {
  const dx = x - e.x; const dz = z - e.z;
  const along = dx * e.ux + dz * e.uz;
  return { along, perp: Math.abs(dx * e.uz - dz * e.ux), s: along / e.len };
}
// Висота на сходах (похила під сходинками), або null — не на сходах.
export function stairHeight(e, x, z, extra = 0) {
  const c = corridor(e, x, z);
  if (c.along <= 0 || c.perp > STAIR_HALF + extra) return null;
  for (const f of e.flights) {
    const lo = Math.min(f.s0, f.s1); const hi = Math.max(f.s0, f.s1);
    if (c.s >= lo && c.s <= hi) return lerp(f.y0, f.y1, (f.s0 - c.s) / (f.s0 - f.s1));
  }
  return null;
}
export const inStairs = (x, z, extra = 0.3) => stairHeight(TER, x, z, extra) !== null || stairHeight(HOL, x, z, extra) !== null;

function terraceLevel(s, x, z) {
  if (s < 0.45) return 4.9 + 1.8 * (1 - (s / 0.45) ** 2) + fbm(x * 0.1, z * 0.1) * 0.25;
  if (s < 0.72) return 3.4;
  return 1.7;
}

// ---------- Скелі позаду ----------
// 0 — луки, 1 — скеля. Край скель трохи звивистий.
export function cliffMask(x, z) {
  const base = -80 + 5 * noise(x * 0.03, 3.1) + 3 * noise(x * 0.11, 7.7);
  return smoothstep(base, base - 16, z);
}
function cliffHeight(x, z) {
  const t = cliffMask(x, z);
  if (t <= 0) return -Infinity;
  const H = 28 + 12 * fbm(x * 0.02, 3.3);
  // Уступи: рівні полиці й круті стінки між ними.
  const s = t * 4 + 0.6 * noise(x * 0.1, z * 0.1);
  const q = Math.floor(s) + smoothstep(0.7, 1.0, s - Math.floor(s));
  return (H * clamp(q, 0, 4)) / 4 + fbm(x * 0.15, z * 0.15) * 1.6 * t;
}

// ---------- Ліс (захід) ----------
// 0 — поле, 1 — густий ліс. Галявини — де шум великий.
export function forestMask(x, z) {
  const edge = -82 - 6 * noise(z * 0.04, 1.7);
  return smoothstep(edge, edge - 12, x) * (1 - cliffMask(x, z));
}

// ---------- Висота землі ----------
export function heightAt(x, z) {
  const n = fbm(x * 0.035, z * 0.035) * 0.9 + noise(x * 0.25, z * 0.25) * 0.08;
  let h = n * 0.6 + hills(x, z);
  h = lerp(h, PATH_Y + n * 0.12, smoothstep(HALF + 3.5, HALF + 0.3, pathDist(x, z)));

  const ts = relS(TER, x, z);
  if (ts < 1) h = terraceLevel(ts, x, z);
  else if (ts < 1.25) h = lerp(PATH_Y + n * 0.1, h, smoothstep(1.0, 1.25, ts));
  if (relS(HOL, x, z) < 1) h = FLOOR + n * 0.08;
  const st = stairHeight(TER, x, z) ?? stairHeight(HOL, x, z);
  if (st !== null) h = st;

  // Річка: береги опускаються, русло — ложбина під водою.
  const dR = riverDist(x, z);
  if (dR < 16) {
    h = lerp(h, 0.3 + n * 0.1, smoothstep(16, 7.5, dR));
    if (dR < 7.5) h = dR < RIVER_HALF ? WATER_Y - 2.0 * (1 - (dR / RIVER_HALF) ** 2) - 0.05 : lerp(WATER_Y - 0.05, 0.3, (dR - RIVER_HALF) / 1.5);
  }

  // Скелі (з ущелиною, якою тече річка).
  const ch = cliffHeight(x, z);
  if (ch > h) {
    const canyon = smoothstep(RIVER_HALF + 1, RIVER_HALF + 5, dR);
    h = Math.max(h, lerp(h, ch, canyon));
  }
  return h;
}

// Кут нахилу: ny — «наскільки поверхня дивиться вгору» (1 — рівно, 0 — стіна).
export function slopeNy(x, z, e = 0.5) {
  const nx = heightAt(x - e, z) - heightAt(x + e, z);
  const nz = heightAt(x, z - e) - heightAt(x, z + e);
  return (2 * e) / Math.hypot(nx, 2 * e, nz);
}
