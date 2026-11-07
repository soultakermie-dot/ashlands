// Дерева й кущі: стовбур (матеріал «кора») + «картки» з текстурою листя/хвої (матеріал «листя»).
// Кожна функція повертає { bark, leaves } — частини для ChunkedMesh (leaves мають uv).
import { FOLIAGE_CELLS } from './foliage.js';

const UP = [0, 1, 0];
const norm = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const emptyPart = () => ({ pos: [], nor: [], col: [], uv: [], idx: [] });

// Стовбур: зрізаний конус із 6 граней.
function trunk(part, x, y0, z, y1, r0, r1, tint, lean = [0, 0]) {
  const seg = 6;
  const base = part.pos.length / 3;
  for (let ring = 0; ring < 2; ring++) {
    const y = ring ? y1 : y0; const r = ring ? r1 : r0;
    const ox = ring ? lean[0] : 0; const oz = ring ? lean[1] : 0;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      part.pos.push(x + ox + Math.cos(a) * r, y, z + oz + Math.sin(a) * r);
      part.nor.push(Math.cos(a), 0.15, Math.sin(a));
      part.col.push(...tint);
    }
  }
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    part.idx.push(base + i, base + seg + i, base + j, base + j, base + seg + i, base + seg + j);
  }
}

// Картка: 4 кути (з uv) — нормалі «від центру крони» з нахилом угору (м'яке об'ємне світло).
function card(part, corners, uvs, center, tint) {
  const base = part.pos.length / 3;
  corners.forEach((p, i) => {
    part.pos.push(...p);
    const out = norm([p[0] - center[0], (p[1] - center[1]) * 0.6, p[2] - center[2]]);
    part.nor.push(...norm([out[0] * 0.55 + UP[0] * 0.6, out[1] * 0.55 + UP[1] * 0.6, out[2] * 0.55 + UP[2] * 0.6]));
    part.uv.push(...uvs[i]);
    part.col.push(...tint);
  });
  part.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
const cellUv = ([u0, v0, u1, v1]) => [[u0, v1], [u1, v1], [u1, v0], [u0, v0]];   // низ-ліво, низ-право, верх-право, верх-ліво

// Вертикальна картка шириною 2w від y0 до y1, повернута на кут a.
function vcard(part, x, z, a, w, y0, y1, cell, center, tint) {
  const dx = Math.cos(a) * w; const dz = Math.sin(a) * w;
  card(part, [[x - dx, y0, z - dz], [x + dx, y0, z + dz], [x + dx, y1, z + dz], [x - dx, y1, z - dz]], cellUv(cell), center, tint);
}

const greenTint = (rnd, k0 = 0.72) => { const k = k0 + rnd() * (1 - k0); return [k * (0.92 + rnd() * 0.08), k, k * (0.9 + rnd() * 0.1)]; };
const barkTint = (rnd) => { const k = 0.6 + rnd() * 0.3; return [k, k * 0.95, k * 0.9]; };

// Ялина висотою h (низ стовбура — y).
export function conifer(rnd, x, y, z, h) {
  const bark = emptyPart(); const leaves = emptyPart();
  trunk(bark, x, y - 0.4, z, y + h * 0.9, 0.12 + h * 0.016, 0.04, barkTint(rnd));
  const tint = greenTint(rnd, 0.6);
  const center = [x, y + h * 0.45, z];
  const a0 = rnd() * Math.PI;
  for (let k = 0; k < 3; k++) vcard(leaves, x, z, a0 + (k * Math.PI) / 3, h * 0.3, y + h * 0.08, y + h * 1.02, FOLIAGE_CELLS.conifer, center, tint);
  // Опущені гілки ярусами — для об'єму.
  for (const t of [0.22, 0.42, 0.6, 0.76]) {
    const yl = y + h * t; const L = (1 - t) * h * 0.33 + 0.4;
    for (let k = 0; k < 3; k++) {
      const a = rnd() * Math.PI * 2;
      const c = Math.cos(a); const s = Math.sin(a);
      const pc = -s; const ps = c;   // упоперек
      const wi = L * 0.12; const wo = L * 0.32; const drop = L * 0.38;
      const [u0, v0, u1, v1] = FOLIAGE_CELLS.branch;
      card(leaves, [
        [x + c * 0.1 - pc * wi, yl, z + s * 0.1 - ps * wi],
        [x + c * 0.1 + pc * wi, yl, z + s * 0.1 + ps * wi],
        [x + c * L + pc * wo, yl - drop, z + s * L + ps * wo],
        [x + c * L - pc * wo, yl - drop, z + s * L - ps * wo],
      ], [[u0, v0], [u0, v1], [u1, v1], [u1, v0]], center, tint);
    }
  }
  return { bark, leaves };
}

// Листяне дерево висотою h.
export function deciduous(rnd, x, y, z, h) {
  const bark = emptyPart(); const leaves = emptyPart();
  const lean = [(rnd() - 0.5) * h * 0.06, (rnd() - 0.5) * h * 0.06];
  trunk(bark, x, y - 0.4, z, y + h * 0.66, 0.16 + h * 0.022, 0.07 + h * 0.008, barkTint(rnd), lean);
  const tint = greenTint(rnd, 0.65);
  const crown = [x + lean[0], y + h * 0.72, z + lean[1]];
  const clusters = 4 + Math.floor(rnd() * 2);
  for (let k = 0; k < clusters; k++) {
    const R = h * (0.2 + rnd() * 0.09);
    const cx = crown[0] + (rnd() - 0.5) * h * 0.34; const cz = crown[2] + (rnd() - 0.5) * h * 0.34;
    const cy = crown[1] + (rnd() - 0.4) * h * 0.22;
    const a0 = rnd() * Math.PI;
    for (let i = 0; i < 3; i++) vcard(leaves, cx, cz, a0 + (i * Math.PI) / 3, R, cy - R, cy + R, FOLIAGE_CELLS.leaves, crown, tint);
    const [u0, v0, u1, v1] = FOLIAGE_CELLS.leaves;
    card(leaves, [[cx - R, cy, cz - R], [cx + R, cy, cz - R], [cx + R, cy + R * 0.15, cz + R], [cx - R, cy + R * 0.15, cz + R]],
      [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], crown, tint);
  }
  return { bark, leaves };
}

// Кущ розміром s (≈ 1 — по коліно-пояс).
export function bushCards(rnd, x, y, z, s) {
  const leaves = emptyPart();
  const tint = greenTint(rnd, 0.6);
  const center = [x, y + 0.3 * s, z];
  const a0 = rnd() * Math.PI;
  for (let k = 0; k < 3; k++) vcard(leaves, x, z, a0 + (k * Math.PI) / 3, 1.1 * s, y - 0.15, y + 1.15 * s, FOLIAGE_CELLS.bush, center, tint);
  return { leaves };
}
