// Розфарбування землі: «карта змішування» (splat.png) каже, де трава, бруківка, земля з листям і камінь.
// R — трава, G — бруківка, B — земля/листя, решта (1 − R − G − B) — камінь. Браузер змішує фото-текстури за нею.
// Ще кожна вершина має «відтінок» (затемнення в лісі, біля скель) — щоб земля не була однаковою.
import { clamp, smoothstep } from '../../lib/noise.js';
import { writePng } from '../../lib/png.js';
import {
  HALF, HOL, RINGS, RIVER_HALF, TER, X0, X1, Z0, Z1,
  cliffMask, fbm, forestMask, inStairs, noise, pathDist, relS, riverDist,
} from './layout.js';

// Скільки бруківки в точці (0..1) — з м'яким нерівним краєм.
export function cobbleAt(x, z) {
  const wobble = noise(x * 0.9, z * 0.9) * 0.2;
  const ts = relS(TER, x, z);
  const hs = relS(HOL, x, z);
  let c = 0;
  if (ts >= 1 && hs >= 1) c = smoothstep(HALF + 0.05, HALF - 0.35, pathDist(x, z) + wobble);
  for (const [a, b] of RINGS) c = Math.max(c, smoothstep(-0.25, 0.25, Math.min(ts - a, b - ts) * 22 + wobble));
  if (hs < 1 && x > HOL.x - HOL.a + 2) c = Math.max(c, smoothstep(HALF - 0.1, HALF - 0.5, Math.abs(z - HOL.z) + wobble));
  return c;
}

// Ваги [трава, бруківка, земля, камінь] у точці; ny — нахил (1 — рівно).
export function splatAt(x, z, ny) {
  let g = 1; let d = 0; let r = 0;
  d += clamp(fbm(x * 0.05, z * 0.05) * 1.3 - 0.1, 0, 0.7);             // плями голої землі на луках
  const f = forestMask(x, z);
  d += f * 1.6; g *= 1 - f * 0.6;                                         // лісова підстилка
  r += smoothstep(0.82, 0.55, ny) * 3;                                     // круті схили — камінь
  const cm = cliffMask(x, z);
  r += cm * (ny < 0.92 ? 2.5 : 0.5); d += cm * 0.4;                        // скелі
  const dR = riverDist(x, z);
  if (dR < RIVER_HALF + 0.4) { r += 1.2; d += 1.5; g = 0; }               // русло
  else if (dR < RIVER_HALF + 2.6) d += 1.4 * (1 - (dR - RIVER_HALF - 0.4) / 2.2); // мокрий берег
  if (inStairs(x, z, 0.15)) r += 4;

  const c = cobbleAt(x, z);
  if (c < 1) d += smoothstep(HALF + 1.0, HALF + 0.1, pathDist(x, z)) * 1.1 * (1 - c);   // протоптана земля біля стежки
  const k = 1 - c;
  g *= k; d *= k; r *= k;
  const cobble = c * 3;
  const sum = g + cobble + d + r || 1;
  return [g / sum, cobble / sum, d / sum, r / sum];
}

// Відтінок вершини землі (множиться на текстуру).
export function groundTint(x, z, ny) {
  let k = 0.92 + 0.1 * fbm(x * 0.03, z * 0.03) + 0.04 * noise(x * 0.4, z * 0.4);
  k *= 1 - 0.28 * forestMask(x, z);                                          // у лісі темніше
  k *= 1 - 0.18 * smoothstep(0.3, 0, cliffMask(x, z)) * cliffMask(x, z) * 4; // тінь під скелями
  if (riverDist(x, z) < RIVER_HALF + 1) k *= 0.8;                            // мокре
  k *= 0.9 + 0.1 * ny;
  k = clamp(k, 0.4, 1);
  return [k * 0.97, k, k * 0.94];
}

// Записати splat.png: width × height пікселів на всю ділянку; ny(x, z) — нахил із сітки висот.
export function writeSplat(file, width, height, nyAt) {
  const px = new Uint8Array(width * height * 3);
  for (let py = 0; py < height; py++) {
    const z = Z0 + ((py + 0.5) / height) * (Z1 - Z0);
    for (let pxx = 0; pxx < width; pxx++) {
      const x = X0 + ((pxx + 0.5) / width) * (X1 - X0);
      const [g, c, d] = splatAt(x, z, nyAt(x, z));
      const o = (py * width + pxx) * 3;
      px[o] = Math.round(g * 255);
      px[o + 1] = Math.round(c * 255);
      px[o + 2] = Math.round(d * 255);
    }
  }
  return writePng(file, width, height, px, 3);
}
