// Рослини: густий ліс на заході (з галявинами), гаї на луках і за річкою, кущі вздовж стежок і на терасах.
// Рослини не «впечені» в рельєф — це список місць (layout.json), куди будівельник садить окремі моделі:
// кожне дерево й кущ потім можна видалити, посунути, змінити розмір.
import { lerp, smoothstep } from '../../lib/noise.js';
import { eachOnEllipse } from './decor.js';
import {
  HALF, HOL, PATHS, RIVER_HALF, TER, X0, X1, Z0, Z1,
  cliffMask, forestMask, heightAt, inStairs, inside, noise, pathDist, relS, riverDist,
} from './layout.js';

const inCenter = (x, z) => Math.abs(x) < 80 && Math.abs(z) < 60;

// Чи можна тут поставити рослину (не на стежці, не в річці, не на скелі, не на терасі).
function free(x, z, pathGap) {
  return inside(x, z) && pathDist(x, z) > HALF + pathGap && riverDist(x, z) > RIVER_HALF + 1.8 && cliffMask(x, z) < 0.12
    && relS(TER, x, z) > 1.25 && relS(HOL, x, z) > 1.35 && !inStairs(x, z, 1.5);
}

// Повертає [{ kind: 'spruce' | 'tree' | 'bush', x, y, z, rotY, scale }].
export function placeVegetation(rnd, counts) {
  const list = [];
  const put = (kind, x, z, scale) => list.push({ kind, x, y: heightAt(x, z), z, rotY: rnd() * Math.PI * 2, scale });
  // Дерева: сітка з кроком ~3.8 м зі зсувом, густота — за маскою лісу й гаїв.
  const STEP = 3.8;
  for (let gx = X0 + 2; gx < X1 - 2; gx += STEP) {
    for (let gz = Z0 + 2; gz < Z1 - 2; gz += STEP) {
      const x = gx + (rnd() - 0.5) * STEP * 0.9; const z = gz + (rnd() - 0.5) * STEP * 0.9;
      const f = forestMask(x, z);
      let density = f * 0.85;
      density += smoothstep(0.3, 0.6, noise(x * 0.02 + 5, z * 0.02)) * 0.4 * (1 - f) * (inCenter(x, z) ? 0.12 : 1);  // гаї
      if (riverDist(x, z) < 16 && riverDist(x, z) > RIVER_HALF + 2) density += 0.12;                                // уздовж річки
      if (f > 0.2 && noise(x * 0.05, z * 0.05 + 9) > 0.42) density *= 0.12;                                       // галявини
      if (rnd() > density || !free(x, z, 2.4)) continue;
      const isConifer = rnd() < (f > 0.5 ? 0.72 : 0.35);
      put(isConifer ? 'spruce' : 'tree', x, z, isConifer ? 0.65 + rnd() * 0.65 : 0.7 + rnd() * 0.6);
      counts.trees++;
    }
  }

  const bush = (x, z, s) => {
    put('bush', x, z, s);
    counts.bushes++;
  };
  // Кущі купками вздовж стежок.
  for (const path of PATHS) {
    for (let k = 0; k < path.length; k += 6) {
      const p = path[k];
      if (noise(p.x * 0.12, p.z * 0.12) < 0.05 || rnd() > 0.55) continue;
      const side = rnd() < 0.5 ? -1 : 1;
      const off = HALF + 1.0 + rnd() * 1.0;
      const x = p.x - p.tz * side * off; const z = p.z + p.tx * side * off;
      if (free(x, z, 0.6)) bush(x, z, 0.6 + rnd() * 0.5);
    }
  }
  // Підлісок у лісі й поодинокі кущі на луках.
  for (let k = 0; k < 1500; k++) {
    const x = lerp(X0 + 1, X1 - 1, rnd()); const z = lerp(Z0 + 1, Z1 - 1, rnd());
    const f = forestMask(x, z);
    if (rnd() > f * 0.45 + 0.05 || !free(x, z, 1)) continue;
    bush(x, z, 0.5 + rnd() * 0.7);
  }
  // По краях терас і западини.
  const along = (e, s, chance) => eachOnEllipse(e, s, 1.4, (x, z) => {
    if (inStairs(x, z, 1) || noise(x * 0.15, z * 0.15) < 0 || rnd() > chance) return;
    bush(x, z, 0.5 + rnd() * 0.3);
  });
  along(TER, 0.985, 0.8);
  along(TER, 0.69, 0.7);
  along(TER, 1.07, 0.5);
  along(HOL, 1.08, 0.6);
  return list;
}
