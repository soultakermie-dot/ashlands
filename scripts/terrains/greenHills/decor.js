// Каміння: камінці вздовж стежок, кам'яні стінки тераси й западини, сходинки з бортиками,
// валуни на пагорбах, осипи під скелями й каміння в руслі. Усе — матеріал «камінь» (текстура моху й каменю).
import { clamp, lerp } from '../../lib/noise.js';
import { blob, box } from '../../lib/shapes.js';
import {
  FLOOR, HALF, HOL, PATHS, RINGS, RIVER, RIVER_HALF, STAIR_HALF, TER, X0, X1, Z0, Z1,
  cliffMask, forestMask, heightAt, hills, inStairs, inside, pathDist, relS, riverDist,
} from './layout.js';
import { MAT } from './materials.js';

// Відтінок каменю: світліший / темніший, іноді теплий чи зеленуватий.
function stoneTint(rnd) {
  const k = 0.68 + rnd() * 0.32;
  const r = rnd();
  if (r < 0.15) return [k, k * 0.97, k * 0.88];
  if (r < 0.3) return [k * 0.92, k, k * 0.9];
  return [k, k, k];
}

function stone(mesh, rnd, x, y, z, rotY, size = 1) {
  mesh.add(x, z, blob(rnd, {
    x, y, z, rotY,
    sx: (0.3 + rnd() * 0.1) * size, sy: (0.17 + rnd() * 0.06) * size, sz: (0.24 + rnd() * 0.08) * size,
    color: stoneTint(rnd), jitter: 0.25, colorJitter: 0.05,
  }), MAT.rock);
}

// Пройтися по еліпсу з відносним радіусом s із кроком step метрів: fn(x, z, nx, nz) — n назовні.
export function eachOnEllipse(e, s, step, fn) {
  let phi = 0;
  while (phi < Math.PI * 2) {
    const x = e.x + e.a * s * Math.cos(phi);
    const z = e.z + e.b * s * Math.sin(phi);
    let nx = Math.cos(phi) / e.a; let nz = Math.sin(phi) / e.b;
    const l = Math.hypot(nx, nz);
    nx /= l; nz /= l;
    fn(x, z, nx, nz, phi);
    phi += step / Math.max(s * Math.hypot(e.a * Math.sin(phi), e.b * Math.cos(phi)), 0.1);
  }
}

// Камінці по краях стежок (крім мосту — там свої бортики).
export function addPathStones(mesh, rnd, counts) {
  const ok = (x, z) => inside(x, z) && pathDist(x, z) > HALF - 0.05 && relS(TER, x, z) > 1.03 && relS(HOL, x, z) > 1.03
    && !inStairs(x, z) && riverDist(x, z) > RIVER_HALF + 3 && cliffMask(x, z) < 0.05;
  for (const path of PATHS) {
    for (let k = 0; k < path.length; k += 3) {
      const p = path[k];
      for (const side of [-1, 1]) {
        if (rnd() < 0.08) continue;   // де-не-де камінця бракує
        const off = HALF + 0.15 + (rnd() - 0.5) * 0.14;
        const x = p.x - p.tz * side * off; const z = p.z + p.tx * side * off;
        if (!ok(x, z)) continue;
        stone(mesh, rnd, x, heightAt(x, z) + 0.03, z, Math.atan2(-p.tz, p.tx));
        counts.stones++;
      }
    }
  }
  for (const [a, b] of RINGS) {
    for (const s of [a, b]) {
      eachOnEllipse(TER, s, 0.75, (x, z, nx, nz) => {
        if (inStairs(x, z)) return;
        stone(mesh, rnd, x, heightAt(x, z) + 0.03, z, Math.atan2(-nx, -nz));
        counts.stones++;
      });
    }
  }
  for (let x = HOL.x - HOL.a + 2.5; x < HOL.x + HOL.a - 2; x += 0.75) {
    for (const side of [-1, 1]) {
      const z = HOL.z + side * (HALF - 0.05);
      if (relS(HOL, x, z) > 0.95) continue;
      stone(mesh, rnd, x, heightAt(x, z) + 0.03, z, 0);
      counts.stones++;
    }
  }
}

// Кам'яні стінки: уступи тераси (нижче — зовні) і край западини (нижче — всередині).
export function addWalls(mesh, rnd, counts) {
  const wall = (e, s, lowerOutside) => {
    eachOnEllipse(e, s, 0.68, (x, z, nx, nz) => {
      if (inStairs(x, z, 0.2)) return;
      const dir = lowerOutside ? 1 : -1;
      const yLow = lowerOutside ? heightAt(x + nx * 1.2, z + nz * 1.2) : FLOOR;
      const yHigh = (lowerOutside ? heightAt(x - nx * 1.0, z - nz * 1.0) : heightAt(x + nx * 1.2, z + nz * 1.2)) + 0.2;
      const rows = Math.max(1, Math.ceil((yHigh - yLow) / 0.4));
      for (let r = 0; r < rows; r++) {
        const shift = (r % 2 ? 0.34 : 0) + (rnd() - 0.5) * 0.08;
        const px = x + nx * dir * 0.35 - nz * shift;
        const pz = z + nz * dir * 0.35 + nx * shift;
        mesh.add(px, pz, blob(rnd, {
          x: px, y: Math.min(yLow + 0.12 + r * 0.4, yHigh - 0.1), z: pz, rotY: Math.atan2(-nx, -nz),
          sx: 0.42 + rnd() * 0.1, sy: 0.24 + rnd() * 0.05, sz: 0.45 + rnd() * 0.08,
          color: stoneTint(rnd), jitter: 0.16, colorJitter: 0.05,
        }), MAT.rock);
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
export function addStairs(mesh, rnd, counts) {
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
        const shade = 0.8 + rnd() * 0.15;
        mesh.add(e.x + e.ux * along, e.z + e.uz * along, box({
          x: e.x + e.ux * along, y: top - 1.2, z: e.z + e.uz * along, rotY,
          w: STAIR_HALF * 2, h: 1.2, d: Math.abs(sB - sA) * e.len + 0.03,
          color: [shade, shade, shade * 0.97],
        }), MAT.rock);
        counts.steps++;
      }
      const from = Math.min(f.s0, f.s1) * e.len - 0.3; const to = Math.max(f.s0, f.s1) * e.len + 0.3;
      for (const side of [-1, 1]) {
        for (let a = from; a <= to; a += 0.6) {
          const off = STAIR_HALF + 0.3;
          const x = e.x + e.ux * a - e.uz * side * off;
          const z = e.z + e.uz * a + e.ux * side * off;
          const stepTop = lerp(f.y0, f.y1, clamp((f.s0 - a / e.len) / (f.s0 - f.s1), 0, 1));
          const ground = heightAt(e.x + e.ux * a - e.uz * side * (off + 0.8), e.z + e.uz * a + e.ux * side * (off + 0.8));
          const yLow = Math.min(stepTop, ground) - 0.1; const yHigh = Math.max(stepTop, ground) + 0.25;
          for (let y = yLow; y < yHigh; y += 0.38) {
            mesh.add(x, z, blob(rnd, {
              x, y, z, rotY: Math.atan2(-e.uz, e.ux),
              sx: 0.36 + rnd() * 0.08, sy: 0.22 + rnd() * 0.05, sz: 0.32 + rnd() * 0.06,
              color: stoneTint(rnd), jitter: 0.16, colorJitter: 0.05,
            }), MAT.rock);
            counts.stones++;
          }
        }
      }
    }
  }
}

function boulder(mesh, rnd, x, z, size, sink = 0.3) {
  mesh.add(x, z, blob(rnd, {
    x, y: heightAt(x, z) - size * sink, z, rotY: rnd() * Math.PI * 2, detail: 1,
    sx: size * (1 + rnd() * 0.4), sy: size * (0.6 + rnd() * 0.25), sz: size,
    color: stoneTint(rnd), jitter: 0.22, colorJitter: 0.06,
  }), MAT.rock);
}

// Валуни на пагорбах і в лісі, осипи під скелями, каміння в руслі.
export function addBoulders(mesh, rnd, counts) {
  for (let tries = 0; tries < 6000 && counts.boulders < 70; tries++) {
    const x = lerp(X0 + 4, X1 - 4, rnd()); const z = lerp(Z0 + 4, Z1 - 4, rnd());
    const inForest = forestMask(x, z) > 0.5;
    if ((hills(x, z) < 1.2 && !inForest) || pathDist(x, z) < HALF + 3.5 || relS(TER, x, z) < 1.3 || relS(HOL, x, z) < 1.4
      || riverDist(x, z) < RIVER_HALF + 4 || cliffMask(x, z) > 0.1) continue;
    const size = 0.8 + rnd() * 1.6;
    boulder(mesh, rnd, x, z, size);
    for (let k = 0; k < 3; k++) {
      const a = rnd() * Math.PI * 2; const r = size * (1.2 + rnd() * 0.7);
      const sx = x + Math.cos(a) * r; const sz = z + Math.sin(a) * r;
      stone(mesh, rnd, sx, heightAt(sx, sz), sz, rnd() * 3, 1.3 + rnd());
    }
    counts.boulders++;
  }
  // Осипи: брили біля підніжжя скель.
  for (let x = X0 + 2; x < X1 - 2; x += 2.2) {
    for (let k = 0; k < 2; k++) {
      const z = -80 + 6 - rnd() * 14;
      const t = cliffMask(x, z);
      if (t < 0.02 || t > 0.45 || riverDist(x, z) < RIVER_HALF + 2 || pathDist(x, z) < HALF + 2) continue;
      boulder(mesh, rnd, x + (rnd() - 0.5) * 2, z, 0.6 + rnd() * 1.8, 0.35);
      counts.boulders++;
    }
  }
  // Каміння в руслі й на березі.
  for (let k = 0; k < RIVER.length; k += 10) {
    const p = RIVER[k];
    if (rnd() < 0.35) continue;
    const off = (rnd() * 2 - 1) * (RIVER_HALF + 1.5);
    const x = p.x - p.tz * off; const z = p.z + p.tx * off;
    if (!inside(x, z) || pathDist(x, z) < HALF + 4) continue;
    boulder(mesh, rnd, x, z, 0.4 + rnd() * 1.1, 0.4);
    counts.boulders++;
  }
}
