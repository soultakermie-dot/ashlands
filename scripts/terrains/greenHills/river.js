// Річка: поверхня води (стрічка вздовж русла) і кам'яний арковий міст там, де стежка її перетинає.
import { blob, box } from '../../lib/shapes.js';
import { NETWORK, RIVER, RIVER_HALF, WATER_Y, heightAt, riverDist, sampleCurve } from './layout.js';
import { MAT } from './materials.js';

// Вода: стрічка трохи ширша за русло (краї ховаються під берегом).
export function addWater(mesh) {
  const half = RIVER_HALF + 0.9;
  for (let k = 0; k + 4 < RIVER.length; k += 4) {
    const a = RIVER[k]; const b = RIVER[Math.min(RIVER.length - 1, k + 4)];
    const pts = [
      [a.x - a.tz * half, a.z + a.tx * half], [a.x + a.tz * half, a.z - a.tx * half],
      [b.x + b.tz * half, b.z - b.tx * half], [b.x - b.tz * half, b.z + b.tx * half],
    ];
    const part = { pos: [], nor: [], col: [], uv: [], idx: [] };
    for (const [x, z] of pts) {
      part.pos.push(x, WATER_Y, z);
      part.nor.push(0, 1, 0);
      part.col.push(1, 1, 1);
      part.uv.push(x / 7, z / 7);
    }
    // Порядок вершин: дивимось угору.
    const p = part.pos;
    const cy = (p[5] - p[2]) * (p[6] - p[0]) - (p[3] - p[0]) * (p[8] - p[2]);
    part.idx = cy > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    mesh.add((a.x + b.x) / 2, (a.z + b.z) / 2, part, MAT.water);
  }
}

// Міст: де стежка «bridge» найближче до русла — там центр; дугою над водою, з бортиками.
export function addBridge(mesh, rnd, counts) {
  const path = sampleCurve(NETWORK.bridge);
  let c = path[0]; let best = Infinity;
  for (const p of path) { const d = riverDist(p.x, p.z); if (d < best) { best = d; c = p; } }
  const ux = c.tx; const uz = c.tz;           // уздовж мосту
  const px = -uz; const pz = ux;              // упоперек
  const rotY = Math.atan2(ux, uz);
  const S = RIVER_HALF + 4;                   // пів довжини
  const W = 4.4;                              // ширина
  const deckY = (s) => 0.35 + 1.5 * Math.max(0, 1 - (s / S) ** 2);
  const at = (s, side = 0) => [c.x + ux * s + px * side, c.z + uz * s + pz * side];
  const shade = () => { const k = 0.72 + rnd() * 0.2; return [k, k, k * 0.96]; };

  for (let s = -S; s <= S; s += 0.5) {
    const [x, z] = at(s);
    const top = deckY(s);
    // Настил.
    mesh.add(x, z, box({ x, y: top - 0.6, z, rotY, w: W, h: 0.6, d: 0.53, color: shade() }), MAT.rock);
    // Арка під настилом / опори на березі.
    const archSpan = RIVER_HALF + 1;
    const bottom = Math.abs(s) < archSpan ? WATER_Y + 1.7 * (1 - (s / archSpan) ** 2) - 0.3 : Math.min(heightAt(x, z), WATER_Y) - 1.5;
    if (top - 0.6 - bottom > 0.05) mesh.add(x, z, box({ x, y: bottom, z, rotY, w: W - 0.2, h: top - 0.6 - bottom, d: 0.53, color: shade() }), MAT.rock);
    counts.steps++;
  }
  // Бортики з каменів.
  for (const side of [-1, 1]) {
    for (let s = -S; s <= S; s += 0.55) {
      const [x, z] = at(s, side * (W / 2 - 0.25));
      for (const dy of [0.2, 0.55]) {
        mesh.add(x, z, blob(rnd, {
          x, y: deckY(s) + dy, z, rotY: Math.atan2(-uz, ux),
          sx: 0.36 + rnd() * 0.06, sy: 0.22, sz: 0.28,
          color: shade(), jitter: 0.12, colorJitter: 0.04,
        }), MAT.rock);
        counts.stones++;
      }
    }
  }
  return { x: c.x, z: c.z, length: S * 2 };
}
