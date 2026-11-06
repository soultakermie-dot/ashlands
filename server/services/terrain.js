// Земля 3D-міста: набір точок (x, y, z) з кольором (0 трава, 1 земля, 2 бруківка, 3 пісок).
// Клієнт сам з'єднує точки трикутниками (Delaunator). Сервер зберігає точки й приймає зміни:
// висоти, кольори, додати / прибрати точки, розмір ділянки, повна заміна (карта висот).
// Кожна зміна має version: якщо клієнт працював зі старою версією — зміну відхиляємо, він перезавантажує.
import { stores } from '../storage/index.js';
import { GameError } from './errors.js';
import { findLocation } from './world.js';

export const MAX_POINTS = 300_000;
const DEFAULT_SIZE = 200;      // м
const DEFAULT_SPACING = 4;     // м між точками
const SIZE_MAX = 2000;
const HEIGHT_MAX = 2000;
const COLORS = 4;

const records = () => stores.cityTerrains.data.terrains;

function getCity(locationId) {
  const loc = findLocation(locationId);
  if (!loc || loc.type !== 'city') throw new GameError('Місто не знайдено');
  return loc;
}

// ---------- Пам'ять: розпаковані масиви ----------
const cache = new Map();   // locationId → { mode, version, size, spacing, pos: Float32Array, col: Uint8Array }

const encode = (typed) => Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength).toString('base64');
function decodeF32(b64) { const b = Buffer.from(b64, 'base64'); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }
function decodeU8(b64) { const b = Buffer.from(b64, 'base64'); return new Uint8Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }

// Координати сітки вздовж однієї осі: кратні spacing від центру (щоб старі й нові точки
// збігались при зміні розміру) + самі краї ділянки.
function axis(len, spacing) {
  const half = len / 2;
  const out = [];
  const first = Math.ceil(-half / spacing - 1e-9);
  const last = Math.floor(half / spacing + 1e-9);
  if (first * spacing > -half + 1e-6) out.push(-half);
  for (let k = first; k <= last; k++) out.push(k * spacing);
  if (last * spacing < half - 1e-6) out.push(half);
  return out;
}

// Рівна сітка w × d з кроком spacing, центр у (0, 0).
function flatGrid(w, d, spacing) {
  const xs = axis(w, spacing);
  const zs = axis(d, spacing);
  if (xs.length * zs.length > MAX_POINTS) throw new GameError(`Забагато точок: ${xs.length * zs.length} (максимум ${MAX_POINTS}) — збільште відстань між точками`);
  const pos = new Float32Array(xs.length * zs.length * 3);
  let k = 0;
  for (const z of zs) for (const x of xs) { pos[k++] = x; pos[k++] = 0; pos[k++] = z; }
  return pos;
}

function load(locationId) {
  if (cache.has(locationId)) return cache.get(locationId);
  getCity(locationId);
  const rec = records().find((r) => r.locationId === locationId);
  let t;
  if (rec) {
    const d = rec.data;
    t = { mode: d.mode ?? 'points', version: d.version ?? 1, size: d.size, spacing: d.spacing, pos: decodeF32(d.points), col: decodeU8(d.colors) };
  } else {
    const pos = flatGrid(DEFAULT_SIZE, DEFAULT_SIZE, DEFAULT_SPACING);
    t = { mode: 'points', version: 1, size: { w: DEFAULT_SIZE, d: DEFAULT_SIZE }, spacing: DEFAULT_SPACING, pos, col: new Uint8Array(pos.length / 3) };
  }
  cache.set(locationId, t);
  return t;
}

function persist(locationId) {
  const t = cache.get(locationId);
  const data = { mode: t.mode, version: t.version, size: t.size, spacing: t.spacing, points: encode(t.pos), colors: encode(t.col) };
  const rec = records().find((r) => r.locationId === locationId);
  if (rec) { rec.data = data; rec.updatedAt = new Date().toISOString(); }
  else records().push({ locationId, data, updatedAt: new Date().toISOString() });
  stores.cityTerrains.save();
}

// Перевірити версію, застосувати зміну, підняти версію, зберегти.
function change(locationId, version, fn) {
  const t = load(locationId);
  if (Number(version) !== t.version) { const e = new GameError('Землю щойно змінили — оновлюю'); e.code = 'stale'; throw e; }
  fn(t);
  t.version += 1;
  persist(locationId);
  return t.version;
}

// Видалили місто — забути землю.
export function forgetTerrain(locationId) {
  cache.delete(locationId);
  const i = records().findIndex((r) => r.locationId === locationId);
  if (i >= 0) { records().splice(i, 1); stores.cityTerrains.save(); }
}

// ---------- Для клієнта ----------

export function getTerrain(locationId) {
  const t = load(locationId);
  return { mode: t.mode, version: t.version, size: t.size, spacing: t.spacing, points: encode(t.pos), colors: encode(t.col), count: t.pos.length / 3 };
}

// ---------- Перевірки ----------

const finite = (v, max, label) => {
  const n = Number(v);
  if (!Number.isFinite(n) || Math.abs(n) > max) throw new GameError(`${label}: неправильне число`);
  return n;
};

function indicesOf(t, list) {
  if (!Array.isArray(list)) throw new GameError('Немає точок');
  const n = t.pos.length / 3;
  return list.map((i) => {
    const k = Number(i);
    if (!Number.isInteger(k) || k < 0 || k >= n) throw new GameError('Такої точки нема');
    return k;
  });
}

// ---------- Зміни ----------

export function setHeights(locationId, version, indices, heights) {
  return change(locationId, version, (t) => {
    const idx = indicesOf(t, indices);
    if (!Array.isArray(heights) || heights.length !== idx.length) throw new GameError('Висоти не збігаються з точками');
    idx.forEach((k, j) => { t.pos[k * 3 + 1] = finite(heights[j], HEIGHT_MAX, 'Висота'); });
  });
}

export function setColors(locationId, version, indices, colors) {
  return change(locationId, version, (t) => {
    const idx = indicesOf(t, indices);
    const list = Array.isArray(colors) ? colors : idx.map(() => colors);
    idx.forEach((k, j) => {
      const c = Number(list[j]);
      if (!Number.isInteger(c) || c < 0 || c >= COLORS) throw new GameError('Невідомий колір');
      t.col[k] = c;
    });
  });
}

// points — [x, y, z, x, y, z, ...], colors — [c, c, ...] (або одне число для всіх).
export function addPoints(locationId, version, points, colors = 0) {
  return change(locationId, version, (t) => {
    if (!Array.isArray(points) || !points.length || points.length % 3) throw new GameError('Немає точок');
    const add = points.length / 3;
    const n = t.pos.length / 3;
    if (n + add > MAX_POINTS) throw new GameError(`Забагато точок: стане ${n + add} (максимум ${MAX_POINTS})`);
    const pos = new Float32Array(t.pos.length + points.length);
    pos.set(t.pos);
    points.forEach((v, j) => { pos[t.pos.length + j] = finite(v, j % 3 === 1 ? HEIGHT_MAX : SIZE_MAX, 'Координата'); });
    const col = new Uint8Array(n + add);
    col.set(t.col);
    for (let j = 0; j < add; j++) {
      const c = Number(Array.isArray(colors) ? colors[j] : colors);
      col[n + j] = Number.isInteger(c) && c >= 0 && c < COLORS ? c : 0;
    }
    t.pos = pos;
    t.col = col;
  });
}

export function removePoints(locationId, version, indices) {
  return change(locationId, version, (t) => {
    const drop = new Set(indicesOf(t, indices));
    const n = t.pos.length / 3;
    if (n - drop.size < 3) throw new GameError('Земля має мати хоча б 3 точки');
    const pos = new Float32Array((n - drop.size) * 3);
    const col = new Uint8Array(n - drop.size);
    let w = 0;
    for (let k = 0; k < n; k++) {
      if (drop.has(k)) continue;
      pos.set(t.pos.subarray(k * 3, k * 3 + 3), w * 3);
      col[w++] = t.col[k];
    }
    t.pos = pos;
    t.col = col;
  });
}

// Змінити розмір ділянки: точки за межами зникають, нова площа заповнюється рівною сіткою (висота 0).
export function resize(locationId, version, w, d) {
  return change(locationId, version, (t) => {
    const W = finite(w, SIZE_MAX, 'Ширина');
    const D = finite(d, SIZE_MAX, 'Глибина');
    if (W < 10 || D < 10) throw new GameError('Розмір ділянки: від 10 м');
    const keep = [];
    const keepCol = [];
    const n = t.pos.length / 3;
    for (let k = 0; k < n; k++) {
      const x = t.pos[k * 3];
      const z = t.pos[k * 3 + 2];
      if (Math.abs(x) <= W / 2 + 1e-3 && Math.abs(z) <= D / 2 + 1e-3) { keep.push(x, t.pos[k * 3 + 1], z); keepCol.push(t.col[k]); }
    }
    const grid = flatGrid(W, D, t.spacing);
    const oldW = t.size.w / 2 + 1e-3;
    const oldD = t.size.d / 2 + 1e-3;
    for (let k = 0; k < grid.length; k += 3) {
      if (Math.abs(grid[k]) <= oldW && Math.abs(grid[k + 2]) <= oldD) continue;   // стара площа вже має свої точки
      keep.push(grid[k], 0, grid[k + 2]);
      keepCol.push(0);
    }
    if (keep.length / 3 > MAX_POINTS) throw new GameError(`Забагато точок (максимум ${MAX_POINTS})`);
    t.pos = Float32Array.from(keep);
    t.col = Uint8Array.from(keepCol);
    t.size = { w: W, d: D };
  });
}

// Повна заміна (карта висот / нова рівна земля).
export function replaceTerrain(locationId, version, { size, spacing, points, colors }) {
  return change(locationId, version, (t) => {
    const pos = decodeF32(points);
    if (!pos.length || pos.length % 3) throw new GameError('Немає точок');
    if (pos.length / 3 > MAX_POINTS) throw new GameError(`Забагато точок (максимум ${MAX_POINTS})`);
    for (const v of pos) if (!Number.isFinite(v) || Math.abs(v) > SIZE_MAX * 2) throw new GameError('Неправильні координати');
    const col = colors ? decodeU8(colors) : new Uint8Array(pos.length / 3);
    if (col.length !== pos.length / 3) throw new GameError('Кольорів не стільки, скільки точок');
    t.pos = pos;
    t.col = col;
    t.size = { w: finite(size.w, SIZE_MAX, 'Ширина'), d: finite(size.d, SIZE_MAX, 'Глибина') };
    t.spacing = finite(spacing, SIZE_MAX, 'Відстань');
  });
}

export function setMode(locationId, version, mode) {
  if (!['points', 'glb'].includes(mode)) throw new GameError('Невідомий вид землі');
  return change(locationId, version, (t) => { t.mode = mode; });
}
