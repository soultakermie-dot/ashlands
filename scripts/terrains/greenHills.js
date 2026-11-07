// Варіант рельєфу «Зелені пагорби» (за картинкою-концептом): трав'яні пагорби, звивисті бруковані стежки
// з камінцями по краях, пагорб-тераса з кам'яними стінками й сходами, западина зі сходами вниз,
// валуни й кущі, а збоку — зріз ґрунту. Розмір 160 × 120 м з вирізаним кутом.
// Усе генерується з «зерна» — щоразу однаково.
import { clamp, lerp, makeNoise, makeRandom, smoothstep } from '../lib/noise.js';
import { ChunkedMesh, blob, box } from '../lib/shapes.js';

export const info = { folder: 'green_hills', name: 'Зелені пагорби' };

// ---------- Розміри ----------
const X0 = -80; const X1 = 80; const Z0 = -60; const Z1 = 60;
const STEP = 0.5;              // крок сітки землі, м
const BOTTOM = -7;             // низ «зрізу» ґрунту
const NOTCH = { x: 56, z: -30 };   // вирізаний кут: x > 56 і z < -30
const NX = Math.round((X1 - X0) / STEP) + 1;
const NZ = Math.round((Z1 - Z0) / STEP) + 1;
const inside = (x, z) => x >= X0 - 1e-6 && x <= X1 + 1e-6 && z >= Z0 - 1e-6 && z <= Z1 + 1e-6 && !(x > NOTCH.x + 1e-6 && z < NOTCH.z - 1e-6);

const PATH_Y = 0.15;           // висота стежок
const HALF = 1.8;              // пів ширини стежки
const STAIR_HALF = 1.6;        // пів ширини сходів

const { fbm, noise } = makeNoise(7);

// ---------- Пагорби ----------
const HILLS = [
  { x: -45, z: 26, rx: 17, rz: 15, h: 12 },
  { x: -30, z: 38, rx: 9, rz: 9, h: 6 },
  { x: -10, z: -32, rx: 20, rz: 9, h: 9 },
  { x: -40, z: -22, rx: 12, rz: 11, h: 7 },
  { x: -64, z: -24, rx: 9, rz: 10, h: 5 },
  { x: 4, z: 37, rx: 11, rz: 11, h: 8 },
  { x: 35, z: 5, rx: 7, rz: 5, h: 3 },
  { x: 40, z: -46, rx: 11, rz: 9, h: 6 },
  { x: 74, z: 40, rx: 5, rz: 11, h: 3 },
  { x: -28, z: -2, rx: 6, rz: 5, h: 2.5 },
];
function hills(x, z) {
  let h = 0;
  const wobble = 1 + 0.3 * noise(x * 0.08, z * 0.08);
  for (const H of HILLS) {
    const r2 = (((x - H.x) / H.rx) ** 2 + ((z - H.z) / H.rz) ** 2) * wobble;
    if (r2 < 6) h += H.h * Math.exp(-r2 * 1.3) * (1 + 0.12 * noise(x * 0.3 + H.x, z * 0.3));
  }
  return h;
}

// ---------- Стежки (мережа) ----------
const NETWORK = [
  { closed: true, pts: [[-12, 5], [-25, 7], [-40, 3], [-56, 2], [-68, 12], [-71, 30], [-64, 47], [-48, 54], [-30, 52], [-18, 42], [-13, 25]] },
  { pts: [[-79.9, -36], [-60, -50], [-35, -54], [-10, -52], [10, -46], [18, -34], [14, -20], [6, -8], [-4, 0], [-12, 5]] },
  { pts: [[-12, 5], [0, 15], [12, 20], [19.8, 30.4]] },
  { pts: [[6, -8], [12, -11], [18.2, -12]] },
  { pts: [[14, -20], [22, -28], [40, -27], [54, -22], [64, -12], [70, 4], [70, 15], [58, 17], [40, 15], [26, 17], [12, 20]] },
  { pts: [[-18, 42], [-5, 50], [10, 54], [24, 57], [40, 58.5], [55, 59.9]] },
];

// Плавна крива через точки (Catmull-Rom), точки кожні 0.25 м з напрямком.
function sampleCurve({ pts, closed }) {
  const P = closed ? pts : [pts[0], ...pts, pts[pts.length - 1]];
  const n = closed ? P.length : P.length - 3;
  const at = (i) => P[(i + P.length) % P.length];
  const out = [];
  for (let s = 0; s < n; s++) {
    const [p0, p1, p2, p3] = closed ? [at(s - 1), at(s), at(s + 1), at(s + 2)] : [P[s], P[s + 1], P[s + 2], P[s + 3]];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const steps = Math.max(1, Math.ceil(len / 0.25));
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const t2 = t * t; const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      const df = (a, b, c, d) => 0.5 * ((-a + c) + 2 * (2 * a - 5 * b + 4 * c - d) * t + 3 * (-a + 3 * b - 3 * c + d) * t2);
      const x = f(p0[0], p1[0], p2[0], p3[0]);
      const z = f(p0[1], p1[1], p2[1], p3[1]);
      let tx = df(p0[0], p1[0], p2[0], p3[0]);
      let tz = df(p0[1], p1[1], p2[1], p3[1]);
      const l = Math.hypot(tx, tz) || 1;
      tx /= l; tz /= l;
      out.push({ x, z, tx, tz });
    }
  }
  if (!closed) { const e = pts[pts.length - 1]; const last = out[out.length - 1]; out.push({ x: e[0], z: e[1], tx: last.tx, tz: last.tz }); }
  return out;
}
const PATHS = NETWORK.map(sampleCurve);

// Відстань до найближчої стежки — заздалегідь на сітці.
const DIST = new Float32Array(NX * NZ).fill(1e9);
{
  const R = 8;
  const r = Math.ceil(R / STEP);
  for (const path of PATHS) {
    for (const p of path) {
      const ci = Math.round((p.x - X0) / STEP);
      const cj = Math.round((p.z - Z0) / STEP);
      for (let j = Math.max(0, cj - r); j <= Math.min(NZ - 1, cj + r); j++) {
        for (let i = Math.max(0, ci - r); i <= Math.min(NX - 1, ci + r); i++) {
          const d = Math.hypot(X0 + i * STEP - p.x, Z0 + j * STEP - p.z);
          if (d < DIST[j * NX + i]) DIST[j * NX + i] = d;
        }
      }
    }
  }
}
function pathDist(x, z) {
  const fx = clamp((x - X0) / STEP, 0, NX - 1.001);
  const fz = clamp((z - Z0) / STEP, 0, NZ - 1.001);
  const i = Math.floor(fx); const j = Math.floor(fz);
  const u = fx - i; const v = fz - j;
  const g = (a, b) => Math.min(DIST[b * NX + a], 50);
  return lerp(lerp(g(i, j), g(i + 1, j), u), lerp(g(i, j + 1), g(i + 1, j + 1), u), v);
}

// ---------- Тераса й западина (еліпси) ----------
function ellipse(e) {
  const ex = e.a * Math.cos(e.phi);
  const ez = e.b * Math.sin(e.phi);
  e.len = Math.hypot(ex, ez);
  e.ux = ex / e.len;
  e.uz = ez / e.len;
  return e;
}
// Тераса: три рівні, сходи в бік стежки. s — «відносний радіус» (1 — край еліпса).
const TER = ellipse({ x: 48, z: 36, a: 26, b: 17, phi: (197 * Math.PI) / 180,
  flights: [{ s0: 1.1, s1: 1.0, y0: PATH_Y, y1: 1.7 }, { s0: 0.82, s1: 0.72, y0: 1.7, y1: 3.4 }, { s0: 0.55, s1: 0.45, y0: 3.4, y1: 4.9 }] });
const RINGS = [[0.84, 0.96], [0.5, 0.64]];   // кільцеві стежки на терасі
// Западина: дно на -2.4 м, сходи з заходу.
const FLOOR = -2.4;
const HOL = ellipse({ x: 36, z: -12, a: 16, b: 8, phi: Math.PI, flights: [{ s0: 1.12, s1: 0.88, y0: PATH_Y, y1: FLOOR }] });

const relS = (e, x, z) => Math.hypot((x - e.x) / e.a, (z - e.z) / e.b);
function corridor(e, x, z) {
  const dx = x - e.x; const dz = z - e.z;
  const along = dx * e.ux + dz * e.uz;
  return { along, perp: Math.abs(dx * e.uz - dz * e.ux), s: along / e.len };
}
// Висота на сходах (похила під сходинками), або null — не на сходах.
function stairHeight(e, x, z, extra = 0) {
  const c = corridor(e, x, z);
  if (c.along <= 0 || c.perp > STAIR_HALF + extra) return null;
  for (const f of e.flights) {
    const lo = Math.min(f.s0, f.s1); const hi = Math.max(f.s0, f.s1);
    if (c.s >= lo && c.s <= hi) return lerp(f.y0, f.y1, (f.s0 - c.s) / (f.s0 - f.s1));
  }
  return null;
}
const inStairs = (x, z, extra = 0.3) => stairHeight(TER, x, z, extra) !== null || stairHeight(HOL, x, z, extra) !== null;

function terraceLevel(s, x, z) {
  if (s < 0.45) return 4.9 + 1.8 * (1 - (s / 0.45) ** 2) + fbm(x * 0.1, z * 0.1) * 0.25;
  if (s < 0.72) return 3.4;
  return 1.7;
}

// ---------- Висота землі ----------
export function heightAt(x, z) {
  const n = fbm(x * 0.035, z * 0.035) * 0.9 + noise(x * 0.25, z * 0.25) * 0.08;
  let h = n * 0.6 + hills(x, z);
  h = lerp(h, PATH_Y + n * 0.12, smoothstep(HALF + 3.5, HALF + 0.3, pathDist(x, z)));

  const ts = relS(TER, x, z);
  if (ts < 1) h = terraceLevel(ts, x, z);
  else if (ts < 1.25) h = lerp(PATH_Y + n * 0.1, h, smoothstep(1.0, 1.25, ts));

  const hs = relS(HOL, x, z);
  if (hs < 1) h = FLOOR + n * 0.08;

  const st = stairHeight(TER, x, z) ?? stairHeight(HOL, x, z);
  if (st !== null) h = st;
  return h;
}

// ---------- Кольори ----------
const rnd = makeRandom(2024);
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const GRASS_DARK = [0.27, 0.4, 0.12];
const GRASS_LIGHT = [0.47, 0.56, 0.19];
const COBBLE = [0.66, 0.58, 0.44];
const COBBLE_GRAY = [0.56, 0.54, 0.5];
const DIRT = [0.45, 0.36, 0.22];
const FLOWERS = [[0.93, 0.9, 0.75], [0.88, 0.66, 0.78], [0.9, 0.82, 0.35]];

function isPath(x, z) {
  if (pathDist(x, z) < HALF && relS(TER, x, z) >= 1 && relS(HOL, x, z) >= 1) return true;
  const ts = relS(TER, x, z);
  if (RINGS.some(([a, b]) => ts > a && ts < b)) return true;
  if (relS(HOL, x, z) < 1 && Math.abs(z - HOL.z) < HALF - 0.2 && x > HOL.x - HOL.a + 2) return true;
  return false;
}

function groundColor(x, z, h, ny) {
  const j = () => 1 + (rnd() * 2 - 1) * 0.06;
  if (isPath(x, z)) {
    const c = mix(COBBLE, COBBLE_GRAY, 0.5 + 0.5 * noise(x * 0.7, z * 0.7));
    const k = 0.78 + rnd() * 0.32;
    return [c[0] * k, c[1] * k, c[2] * k];
  }
  if (pathDist(x, z) < HALF + 0.45 && relS(TER, x, z) >= 1 && relS(HOL, x, z) >= 1) return DIRT.map((v) => v * j());
  const g = clamp(0.5 + 0.6 * fbm(x * 0.06, z * 0.06) + 0.25 * noise(x * 0.4, z * 0.4) + h * 0.02, 0, 1);
  let c = mix(GRASS_DARK, GRASS_LIGHT, g);
  if (ny < 0.75) c = mix(c, [0.36, 0.3, 0.18], clamp((0.75 - ny) * 2.5, 0, 0.8));   // круті схили — земля
  if (rnd() < 0.0025) return FLOWERS[Math.floor(rnd() * FLOWERS.length)];
  return c.map((v) => v * j());
}

// ---------- Камінці ----------
const STONES = [[0.62, 0.59, 0.53], [0.53, 0.51, 0.47], [0.67, 0.61, 0.5], [0.46, 0.47, 0.43]];
const MOSS = [0.38, 0.45, 0.25];
function stoneColor() {
  const c = STONES[Math.floor(rnd() * STONES.length)];
  return rnd() < 0.2 ? mix(c, MOSS, 0.4) : c;
}
const mossTop = (rgb, r, vy) => (vy > 0.35 && r() < 0.6 ? mix(rgb, MOSS, 0.55) : rgb);

// ---------- Збирання ----------
export function build() {
  const mesh = new ChunkedMesh(X0, Z0, 20);
  const counts = { stones: 0, bushes: 0, boulders: 0, steps: 0 };

  // Земля: сітка висот і нормалі.
  const H = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) H[j * NX + i] = heightAt(X0 + i * STEP, Z0 + j * STEP);
  const hAt = (i, j) => H[clamp(j, 0, NZ - 1) * NX + clamp(i, 0, NX - 1)];
  const normalAt = (i, j) => {
    const n = [hAt(i - 1, j) - hAt(i + 1, j), 2 * STEP, hAt(i, j - 1) - hAt(i, j + 1)];
    const l = Math.hypot(...n);
    return [n[0] / l, n[1] / l, n[2] / l];
  };

  const CELLS = 40;   // клітинок у шматку (20 м)
  for (let cj = 0; cj * CELLS < NZ - 1; cj++) {
    for (let ci = 0; ci * CELLS < NX - 1; ci++) {
      const part = { pos: [], nor: [], col: [], idx: [] };
      const i0 = ci * CELLS; const j0 = cj * CELLS;
      const i1 = Math.min(NX - 1, i0 + CELLS); const j1 = Math.min(NZ - 1, j0 + CELLS);
      const w = i1 - i0 + 1;
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const x = X0 + i * STEP; const z = Z0 + j * STEP; const h = H[j * NX + i];
          const n = normalAt(i, j);
          part.pos.push(x, h, z);
          part.nor.push(...n);
          part.col.push(...groundColor(x, z, h, n[1]));
        }
      }
      for (let j = j0; j < j1; j++) {
        for (let i = i0; i < i1; i++) {
          if (!inside(X0 + (i + 0.5) * STEP, Z0 + (j + 0.5) * STEP)) continue;
          const a = (j - j0) * w + (i - i0);
          const b = a + 1; const c = a + w; const d = c + 1;
          part.idx.push(a, c, b, b, c, d);
        }
      }
      if (part.idx.length) mesh.add(X0 + (i0 + CELLS / 2) * STEP, Z0 + (j0 + CELLS / 2) * STEP, part);
    }
  }

  addSkirt(mesh);
  addPathStones(mesh, counts);
  addWalls(mesh, counts);
  addStairs(mesh, counts);
  addBoulders(mesh, counts);
  addBushes(mesh, counts);

  return { materials: [{ name: 'Рельєф', color: [1, 1, 1, 1], roughness: 0.95 }], primitives: mesh.primitives(0), counts };
}

// Зріз ґрунту по краях + дно.
function addSkirt(mesh) {
  const outline = [[X0, Z0], [NOTCH.x, Z0], [NOTCH.x, NOTCH.z], [X1, NOTCH.z], [X1, Z1], [X0, Z1]];
  const soil = (x, y) => {
    const k = 0.82 + 0.22 * noise(x * 0.05, y * 1.6) + (rnd() - 0.5) * 0.08;
    if (rnd() < 0.03) return [0.5, 0.48, 0.44];   // камінчик у ґрунті
    return [0.4 * k, 0.27 * k, 0.16 * k];
  };
  for (let s = 0; s < outline.length; s++) {
    const [ax, az] = outline[s];
    const [bx, bz] = outline[(s + 1) % outline.length];
    const len = Math.hypot(bx - ax, bz - az);
    const dx = (bx - ax) / len; const dz = (bz - az) / len;
    let nx = dz; let nz = -dx;
    if (inside((ax + bx) / 2 + nx, (az + bz) / 2 + nz)) { nx = -nx; nz = -nz; }
    const steps = Math.round(len / STEP);
    for (let k = 0; k < steps; k++) {
      const part = { pos: [], nor: [], col: [], idx: [] };
      const cols = [0, 1].map((e) => {
        const x = ax + dx * (k + e) * STEP; const z = az + dz * (k + e) * STEP;
        const top = heightAt(x, z);
        const ys = [top, top - 0.3, ...Array.from({ length: 6 }, (_, r) => lerp(top - 0.3, BOTTOM, (r + 1) / 6))];
        return ys.map((y, r) => {
          part.pos.push(x, y, z);
          part.nor.push(nx, 0, nz);
          part.col.push(...(r === 0 ? [0.3, 0.38, 0.14] : r === 1 ? [0.28, 0.22, 0.13] : soil(x + z, y)));
          return part.pos.length / 3 - 1;
        });
      });
      for (let r = 0; r < cols[0].length - 1; r++) {
        const a = cols[0][r]; const b = cols[1][r]; const c = cols[0][r + 1]; const d = cols[1][r + 1];
        pushOriented(part, [a, c, b], [nx, 0, nz]);
        pushOriented(part, [b, c, d], [nx, 0, nz]);
      }
      mesh.add(ax + dx * (k + 0.5) * STEP - nx, az + dz * (k + 0.5) * STEP - nz, part);
    }
  }
  // Дно (два прямокутники через вирізаний кут).
  for (const [x0, z0, x1, z1] of [[X0, Z0, NOTCH.x, Z1], [NOTCH.x, NOTCH.z, X1, Z1]]) {
    const part = { pos: [x0, BOTTOM, z0, x1, BOTTOM, z0, x0, BOTTOM, z1, x1, BOTTOM, z1], nor: [0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0], col: Array(12).fill(0.25), idx: [] };
    pushOriented(part, [0, 1, 2], [0, -1, 0]);
    pushOriented(part, [1, 3, 2], [0, -1, 0]);
    mesh.add((x0 + x1) / 2, (z0 + z1) / 2, part);
  }
}

// Додати трикутник так, щоб він дивився в бік n.
function pushOriented(part, [a, b, c], n) {
  const p = part.pos;
  const u = [p[b * 3] - p[a * 3], p[b * 3 + 1] - p[a * 3 + 1], p[b * 3 + 2] - p[a * 3 + 2]];
  const v = [p[c * 3] - p[a * 3], p[c * 3 + 1] - p[a * 3 + 1], p[c * 3 + 2] - p[a * 3 + 2]];
  const cx = u[1] * v[2] - u[2] * v[1]; const cy = u[2] * v[0] - u[0] * v[2]; const cz = u[0] * v[1] - u[1] * v[0];
  if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) part.idx.push(a, b, c); else part.idx.push(a, c, b);
}

function stone(mesh, x, y, z, rotY, size = 1) {
  mesh.add(x, z, blob(rnd, {
    x, y, z, rotY,
    sx: (0.3 + rnd() * 0.1) * size, sy: (0.17 + rnd() * 0.06) * size, sz: (0.24 + rnd() * 0.08) * size,
    color: stoneColor(), jitter: 0.25, colorJitter: 0.07, tint: mossTop,
  }));
}

// Камінці вздовж країв стежок.
function addPathStones(mesh, counts) {
  const ok = (x, z) => inside(x, z) && pathDist(x, z) > HALF - 0.05 && relS(TER, x, z) > 1.03 && relS(HOL, x, z) > 1.03 && !inStairs(x, z);
  for (const path of PATHS) {
    for (let k = 0; k < path.length; k += 3) {
      const p = path[k];
      for (const side of [-1, 1]) {
        const off = HALF + 0.15 + (rnd() - 0.5) * 0.12;
        const x = p.x - p.tz * side * off; const z = p.z + p.tx * side * off;
        if (!ok(x, z)) continue;
        stone(mesh, x, heightAt(x, z) + 0.03, z, Math.atan2(-p.tz, p.tx));
        counts.stones++;
      }
    }
  }
  // Краї кільцевих стежок тераси.
  for (const [a, b] of RINGS) {
    for (const s of [a, b]) {
      eachOnEllipse(TER, s, 0.75, (x, z, nx, nz) => {
        if (inStairs(x, z)) return;
        stone(mesh, x, heightAt(x, z) + 0.03, z, Math.atan2(-nx, -nz));
        counts.stones++;
      });
    }
  }
  // Стежка по дну западини.
  for (let x = HOL.x - HOL.a + 2.5; x < HOL.x + HOL.a - 2; x += 0.75) {
    for (const side of [-1, 1]) {
      const z = HOL.z + side * (HALF - 0.05);
      if (relS(HOL, x, z) > 0.95) continue;
      stone(mesh, x, heightAt(x, z) + 0.03, z, 0);
      counts.stones++;
    }
  }
}

// Пройтися по еліпсу з відносним радіусом s із кроком step метрів: fn(x, z, nx, nz) — n назовні.
function eachOnEllipse(e, s, step, fn) {
  let phi = 0;
  while (phi < Math.PI * 2) {
    const x = e.x + e.a * s * Math.cos(phi);
    const z = e.z + e.b * s * Math.sin(phi);
    let nx = Math.cos(phi) / e.a; let nz = Math.sin(phi) / e.b;
    const l = Math.hypot(nx, nz);
    nx /= l; nz /= l;
    fn(x, z, nx, nz, phi);
    const speed = s * Math.hypot(e.a * Math.sin(phi), e.b * Math.cos(phi));
    phi += step / Math.max(speed, 0.1);
  }
}

// Кам'яні стінки: уступи тераси (нижче — зовні) і край западини (нижче — всередині).
function addWalls(mesh, counts) {
  const wall = (e, s, lowerOutside) => {
    eachOnEllipse(e, s, 0.68, (x, z, nx, nz) => {
      if (inStairs(x, z, 0.2)) return;
      const dir = lowerOutside ? 1 : -1;
      const yLow = lowerOutside ? heightAt(x + nx * 0.9, z + nz * 0.9) : FLOOR;
      const yHigh = (lowerOutside ? heightAt(x - nx * 0.7, z - nz * 0.7) : heightAt(x + nx * 0.9, z + nz * 0.9)) + 0.2;
      const rows = Math.max(1, Math.ceil((yHigh - yLow) / 0.4));
      for (let r = 0; r < rows; r++) {
        const shift = (r % 2 ? 0.34 : 0) + (rnd() - 0.5) * 0.08;
        const px = x + nx * dir * 0.22 + -nz * shift;
        const pz = z + nz * dir * 0.22 + nx * shift;
        const y = Math.min(yLow + 0.12 + r * 0.4, yHigh - 0.1);
        mesh.add(px, pz, blob(rnd, {
          x: px, y, z: pz, rotY: Math.atan2(-nx, -nz),
          sx: 0.4 + rnd() * 0.1, sy: 0.23 + rnd() * 0.05, sz: 0.3 + rnd() * 0.06,
          color: stoneColor(), jitter: 0.18, colorJitter: 0.07, tint: mossTop,
        }));
        counts.stones++;
      }
    });
  };
  wall(TER, 1.0, true);
  wall(TER, 0.72, true);
  wall(TER, 0.45, true);
  wall(HOL, 1.0, false);
}

// Сходинки + кам'яні бортики обабіч.
function addStairs(mesh, counts) {
  for (const e of [TER, HOL]) {
    const rotY = Math.atan2(e.ux, e.uz);
    for (const f of e.flights) {
      const n = Math.ceil(Math.abs(f.y1 - f.y0) / 0.22);
      const lowS = f.y0 < f.y1 ? f.s0 : f.s1; const highS = f.y0 < f.y1 ? f.s1 : f.s0;
      const lowY = Math.min(f.y0, f.y1); const highY = Math.max(f.y0, f.y1);
      for (let k = 0; k < n; k++) {
        const sA = lerp(lowS, highS, k / n); const sB = lerp(lowS, highS, (k + 1) / n);
        const top = lerp(lowY, highY, (k + 1) / n);
        const along = ((sA + sB) / 2) * e.len;
        const shade = 0.9 + rnd() * 0.15;
        mesh.add(e.x + e.ux * along, e.z + e.uz * along, box({
          x: e.x + e.ux * along, y: top - 0.8, z: e.z + e.uz * along, rotY,
          w: STAIR_HALF * 2, h: 0.8, d: (Math.abs(sB - sA) * e.len) + 0.03,
          color: [0.62 * shade, 0.58 * shade, 0.52 * shade],
        }));
        counts.steps++;
      }
      // Бортики
      const from = Math.min(f.s0, f.s1) * e.len - 0.3; const to = Math.max(f.s0, f.s1) * e.len + 0.3;
      for (const side of [-1, 1]) {
        for (let a = from; a <= to; a += 0.6) {
          const off = STAIR_HALF + 0.3;
          const x = e.x + e.ux * a + -e.uz * side * off;
          const z = e.z + e.uz * a + e.ux * side * off;
          const s = a / e.len;
          const stepTop = lerp(f.y0, f.y1, clamp((f.s0 - s) / (f.s0 - f.s1), 0, 1));
          const ground = heightAt(e.x + e.ux * a + -e.uz * side * (off + 0.8), e.z + e.uz * a + e.ux * side * (off + 0.8));
          const yLow = Math.min(stepTop, ground) - 0.1; const yHigh = Math.max(stepTop, ground) + 0.25;
          for (let y = yLow; y < yHigh; y += 0.38) {
            mesh.add(x, z, blob(rnd, {
              x, y, z, rotY: Math.atan2(-e.uz, e.ux),
              sx: 0.36 + rnd() * 0.08, sy: 0.22 + rnd() * 0.05, sz: 0.32 + rnd() * 0.06,
              color: stoneColor(), jitter: 0.18, colorJitter: 0.07, tint: mossTop,
            }));
            counts.stones++;
          }
        }
      }
    }
  }
}

// Великі валуни з мохом на пагорбах.
function addBoulders(mesh, counts) {
  for (let tries = 0; tries < 2000 && counts.boulders < 26; tries++) {
    const x = lerp(X0 + 3, X1 - 3, rnd()); const z = lerp(Z0 + 3, Z1 - 3, rnd());
    if (!inside(x, z) || hills(x, z) < 1.2 || pathDist(x, z) < HALF + 4 || relS(TER, x, z) < 1.3 || relS(HOL, x, z) < 1.4) continue;
    const size = 0.9 + rnd() * 1.5;
    const y = heightAt(x, z) - size * 0.3;
    mesh.add(x, z, blob(rnd, {
      x, y, z, rotY: rnd() * Math.PI * 2, detail: 1,
      sx: size * (1 + rnd() * 0.4), sy: size * 0.75, sz: size,
      color: [0.5, 0.5, 0.47], jitter: 0.22, colorJitter: 0.1, tint: mossTop,
    }));
    for (let k = 0; k < 3; k++) {
      const a = rnd() * Math.PI * 2; const r = size * (1.2 + rnd() * 0.6);
      const sx = x + Math.cos(a) * r; const sz = z + Math.sin(a) * r;
      stone(mesh, sx, heightAt(sx, sz), sz, rnd() * 3, 1.3 + rnd());
    }
    counts.boulders++;
  }
}

// Кущі: купками вздовж стежок і по краях терас.
const BUSH = [[0.2, 0.33, 0.12], [0.33, 0.4, 0.14], [0.42, 0.45, 0.18], [0.25, 0.38, 0.2]];
function bush(mesh, x, z, scale = 1) {
  const base = BUSH[Math.floor(rnd() * BUSH.length)];
  const flowers = rnd() < 0.3 ? FLOWERS[Math.floor(rnd() * FLOWERS.length)] : null;
  const blobs = 2 + Math.floor(rnd() * 2);
  for (let b = 0; b < blobs; b++) {
    const r = (0.35 + rnd() * 0.3) * scale;
    const bx = x + (rnd() - 0.5) * 0.8 * scale; const bz = z + (rnd() - 0.5) * 0.8 * scale;
    mesh.add(bx, bz, blob(rnd, {
      x: bx, y: heightAt(bx, bz) + r * 0.45, z: bz, rotY: rnd() * 6, detail: 1,
      sx: r, sy: r * 0.8, sz: r, color: base, jitter: 0.2, colorJitter: 0.12,
      tint: flowers ? (rgb, rr, vy) => (vy > 0 && rr() < 0.25 ? flowers : rgb) : null,
    }));
  }
}
function addBushes(mesh, counts) {
  const free = (x, z) => inside(x, z) && pathDist(x, z) > HALF + 0.4 && relS(TER, x, z) > 1.12 && relS(HOL, x, z) > 1.15 && !inStairs(x, z, 1);
  for (const path of PATHS) {
    for (let k = 0; k < path.length; k += 6) {
      const p = path[k];
      if (noise(p.x * 0.12, p.z * 0.12) < 0.1 || rnd() > 0.6) continue;
      const side = rnd() < 0.5 ? -1 : 1;
      const off = HALF + 0.8 + rnd() * 0.8;
      const x = p.x - p.tz * side * off; const z = p.z + p.tx * side * off;
      if (!free(x, z)) continue;
      bush(mesh, x, z);
      counts.bushes++;
    }
  }
  // Уздовж стінок тераси (згори й біля підніжжя) та краю западини.
  const along = (e, s, chance) => eachOnEllipse(e, s, 1.3, (x, z) => {
    if (inStairs(x, z, 1) || noise(x * 0.15, z * 0.15) < 0 || rnd() > chance) return;
    bush(mesh, x, z, 0.8);
    counts.bushes++;
  });
  along(TER, 0.985, 0.8);
  along(TER, 0.69, 0.7);
  along(TER, 1.07, 0.5);
  along(HOL, 1.08, 0.6);
}
