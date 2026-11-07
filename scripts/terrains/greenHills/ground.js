// Земля: сітка висот із кроком 1 м (по шматках 40 × 40 м) і «зріз» ґрунту по краях ділянки.
import { clamp, lerp } from '../../lib/noise.js';
import { BOTTOM, X0, X1, Z0, Z1, heightAt, noise } from './layout.js';
import { groundTint } from './paint.js';

export const STEP = 1;
const NX = Math.round((X1 - X0) / STEP) + 1;
const NZ = Math.round((Z1 - Z0) / STEP) + 1;
export const CHUNK = 40;   // метрів у шматку

// Сітка висот + нахил у будь-якій точці (для розфарбування).
export function makeHeightGrid() {
  const H = new Float32Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) H[j * NX + i] = heightAt(X0 + i * STEP, Z0 + j * STEP);
  const hAt = (i, j) => H[clamp(j, 0, NZ - 1) * NX + clamp(i, 0, NX - 1)];
  const normalAt = (i, j) => {
    const n = [hAt(i - 1, j) - hAt(i + 1, j), 2 * STEP, hAt(i, j - 1) - hAt(i, j + 1)];
    const l = Math.hypot(...n);
    return [n[0] / l, n[1] / l, n[2] / l];
  };
  const nyAt = (x, z) => {
    const fx = (x - X0) / STEP; const fz = (z - Z0) / STEP;
    const i = Math.floor(fx); const j = Math.floor(fz); const u = fx - i; const v = fz - j;
    return lerp(lerp(normalAt(i, j)[1], normalAt(i + 1, j)[1], u), lerp(normalAt(i, j + 1)[1], normalAt(i + 1, j + 1)[1], u), v);
  };
  return { H, hAt, normalAt, nyAt };
}

// Земля шматками в mesh (матеріал material).
export function addGround(mesh, grid, material) {
  const cells = CHUNK / STEP;
  for (let j0 = 0; j0 < NZ - 1; j0 += cells) {
    for (let i0 = 0; i0 < NX - 1; i0 += cells) {
      const i1 = Math.min(NX - 1, i0 + cells); const j1 = Math.min(NZ - 1, j0 + cells);
      const w = i1 - i0 + 1;
      const part = { pos: [], nor: [], col: [], idx: [] };
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const x = X0 + i * STEP; const z = Z0 + j * STEP;
          const n = grid.normalAt(i, j);
          part.pos.push(x, grid.hAt(i, j), z);
          part.nor.push(...n);
          part.col.push(...groundTint(x, z, n[1]));
        }
      }
      for (let j = j0; j < j1; j++) {
        for (let i = i0; i < i1; i++) {
          const a = (j - j0) * w + (i - i0); const b = a + 1; const c = a + w; const d = c + 1;
          part.idx.push(a, c, b, b, c, d);
        }
      }
      mesh.add(X0 + (i0 + cells / 2) * STEP, Z0 + (j0 + cells / 2) * STEP, part, material);
    }
  }
}

// Зріз ґрунту по краях + дно (матеріал «ґрунт» — текстура землі з усіх боків).
export function addSkirt(mesh, material, rnd) {
  const outline = [[X0, Z0], [X1, Z0], [X1, Z1], [X0, Z1]];
  const soil = (x, y) => {
    const k = 0.78 + 0.16 * noise(x * 0.05, y * 1.4) + (rnd() - 0.5) * 0.06;
    return [k, k * 0.95, k * 0.9];
  };
  for (let s = 0; s < outline.length; s++) {
    const [ax, az] = outline[s];
    const [bx, bz] = outline[(s + 1) % outline.length];
    const len = Math.hypot(bx - ax, bz - az);
    const dx = (bx - ax) / len; const dz = (bz - az) / len;
    const nx = dz; const nz = -dx;   // назовні (обхід проти годинникової стрілки, якщо дивитись згори)
    const outward = (ax + bx) / 2 + nx * 10 > X1 || (ax + bx) / 2 + nx * 10 < X0 || (az + bz) / 2 + nz * 10 > Z1 || (az + bz) / 2 + nz * 10 < Z0;
    const ox = outward ? nx : -nx; const oz = outward ? nz : -nz;
    const steps = Math.round(len / STEP);
    for (let k = 0; k < steps; k += 4) {
      const part = { pos: [], nor: [], col: [], idx: [] };
      const cols = [];
      for (let e = 0; e <= Math.min(4, steps - k); e++) {
        const x = ax + dx * (k + e) * STEP; const z = az + dz * (k + e) * STEP;
        const top = heightAt(x, z);
        const ys = [top, top - 0.25, ...Array.from({ length: 6 }, (_, r) => lerp(top - 0.25, BOTTOM, (r + 1) / 6))];
        cols.push(ys.map((y, r) => {
          part.pos.push(x, y, z);
          part.nor.push(ox, 0, oz);
          part.col.push(...(r === 0 ? [0.7, 0.72, 0.6] : soil(x + z, y)));
          return part.pos.length / 3 - 1;
        }));
      }
      for (let c = 0; c < cols.length - 1; c++) {
        for (let r = 0; r < cols[c].length - 1; r++) {
          const a = cols[c][r]; const b = cols[c + 1][r]; const cc = cols[c][r + 1]; const d = cols[c + 1][r + 1];
          pushOriented(part, [a, cc, b], [ox, 0, oz]);
          pushOriented(part, [b, cc, d], [ox, 0, oz]);
        }
      }
      mesh.add(ax + dx * (k + 2) * STEP - ox, az + dz * (k + 2) * STEP - oz, part, material);
    }
  }
  const part = { pos: [X0, BOTTOM, Z0, X1, BOTTOM, Z0, X0, BOTTOM, Z1, X1, BOTTOM, Z1], nor: [0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0], col: Array(12).fill(0.3), idx: [] };
  pushOriented(part, [0, 1, 2], [0, -1, 0]);
  pushOriented(part, [1, 3, 2], [0, -1, 0]);
  mesh.add(0, 0, part, material);
}

// Додати трикутник так, щоб він дивився в бік n.
export function pushOriented(part, [a, b, c], n) {
  const p = part.pos;
  const u = [p[b * 3] - p[a * 3], p[b * 3 + 1] - p[a * 3 + 1], p[b * 3 + 2] - p[a * 3 + 2]];
  const v = [p[c * 3] - p[a * 3], p[c * 3 + 1] - p[a * 3 + 1], p[c * 3 + 2] - p[a * 3 + 2]];
  const cx = u[1] * v[2] - u[2] * v[1]; const cy = u[2] * v[0] - u[0] * v[2]; const cz = u[0] * v[1] - u[1] * v[0];
  if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) part.idx.push(a, b, c); else part.idx.push(a, c, b);
}
