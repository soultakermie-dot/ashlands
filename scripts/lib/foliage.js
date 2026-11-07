// Текстура листя й хвої (foliage.png, з прозорістю) — малюється програмно з тисяч листочків і голок.
// Атлас 1024 × 512 (v = 0 — верх картинки, як у glTF):
//   ялина-силует  u 0..0.5,  v 0..1      гілка ялини  u 0.5..0.75, v 0..0.5
//   купка листя   u 0.75..1, v 0..0.5    кущ          u 0.5..1,    v 0.5..1
import { makeNoise, makeRandom } from './noise.js';
import { writePng } from './png.js';

export const FOLIAGE_CELLS = {
  conifer: [0, 0, 0.5, 1],
  branch: [0.5, 0, 0.75, 0.5],
  leaves: [0.75, 0, 1, 0.5],
  bush: [0.5, 0.5, 1, 1],
};

const W = 1024;
const H = 512;

export function writeFoliageAtlas(file, seed = 11) {
  const rnd = makeRandom(seed);
  const { noise } = makeNoise(seed);
  const img = new Float32Array(W * H * 4);

  // Заповнений повернутий еліпс (листочок / голка) з легким градієнтом уздовж.
  const leaf = (cx, cy, rx, ry, angle, [r, g, b]) => {
    const c = Math.cos(angle); const s = Math.sin(angle);
    const R = Math.ceil(Math.max(rx, ry)) + 1;
    for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(H - 1, Math.ceil(cy + R)); y++) {
      for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(W - 1, Math.ceil(cx + R)); x++) {
        const dx = x - cx; const dy = y - cy;
        const u = (dx * c + dy * s) / rx; const v = (-dx * s + dy * c) / ry;
        const d = u * u + v * v;
        if (d > 1) continue;
        const shade = 0.82 + 0.25 * (u * 0.5 + 0.5) - 0.12 * d;
        const o = (y * W + x) * 4;
        img[o] = r * shade; img[o + 1] = g * shade; img[o + 2] = b * shade; img[o + 3] = 1;
      }
    }
  };
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const NEEDLES = [[0.09, 0.17, 0.09], [0.12, 0.21, 0.11], [0.15, 0.25, 0.13], [0.1, 0.19, 0.12]];
  const LEAVES = [[0.15, 0.24, 0.08], [0.2, 0.29, 0.1], [0.12, 0.2, 0.07], [0.24, 0.3, 0.12], [0.28, 0.3, 0.12]];
  const dim = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

  // Ялина-силует: яруси гілок з голками, донизу ширші й темніші.
  {
    const cx = 256; const base = 505; const top = 8;
    for (let y = base - 20; y > top; y -= 5) {
      const t = (base - y) / (base - top);
      const half = Math.pow(1 - t, 0.85) * 236 * (0.85 + 0.25 * noise(y * 0.08, 1)) + 6;
      for (const side of [-1, 1]) {
        const droop = half * 0.18;
        for (let a = 0; a < half; a += 3) {
          const k = a / half;
          const bx = cx + side * a; const by = y + droop * k * k;
          const len = 9 * (1 - k * 0.5) + 3;
          const col = dim(pick(NEEDLES), 0.7 + 0.45 * k + 0.15 * t);
          leaf(bx, by - 2, len, 1.6, side * (0.9 + rnd() * 0.3) - Math.PI / 2 + side * 0.5, col);
          leaf(bx, by + 2, len, 1.6, side * (0.6 + rnd() * 0.3), col);
        }
      }
    }
  }
  // Гілка ялини (вигляд згори): хребет зліва направо, голки обабіч.
  {
    const y0 = 128; const x0 = 518; const x1 = 762;
    for (let x = x0; x < x1; x += 2) {
      const k = (x - x0) / (x1 - x0);
      const spread = 52 * (1 - k * 0.8) + 6;
      for (let n = 0; n < 3; n++) {
        const side = rnd() < 0.5 ? -1 : 1;
        const off = rnd() * spread;
        const col = dim(pick(NEEDLES), 0.75 + 0.4 * k);
        leaf(x + 4, y0 + side * off, 8 * (1 - k * 0.4) + 3, 1.5, side * 0.6 + (rnd() - 0.5) * 0.4, col);
      }
    }
  }
  // Купка листя (крона листяного дерева) і кущ.
  const cluster = (cx, cy, rx, ry, count, flatBottom) => {
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2; const r = Math.sqrt(rnd());
      const edge = 0.82 + 0.18 * noise(Math.cos(a) * 3 + cx, Math.sin(a) * 3);
      const x = cx + Math.cos(a) * r * rx * edge;
      let y = cy + Math.sin(a) * r * ry * edge;
      if (flatBottom && y > cy) y = cy + (y - cy) * 0.35;
      const lower = (y - (cy - ry)) / (2 * ry);
      const col = dim(pick(LEAVES), 1.15 - lower * 0.55 + (rnd() - 0.5) * 0.15);
      leaf(x, y, 7 + rnd() * 4, 3.5 + rnd() * 1.5, rnd() * Math.PI, col);
    }
  };
  cluster(896, 128, 118, 118, 2600, false);
  cluster(768, 440, 240, 170, 5200, true);

  // Прозорим пікселям — колір листя (щоб на відстані не було темної облямівки).
  const out = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const a = img[i * 4 + 3];
    const rgb = a ? [img[i * 4], img[i * 4 + 1], img[i * 4 + 2]] : [0.12, 0.2, 0.09];
    out[i * 4] = Math.round(Math.min(1, rgb[0]) * 255);
    out[i * 4 + 1] = Math.round(Math.min(1, rgb[1]) * 255);
    out[i * 4 + 2] = Math.round(Math.min(1, rgb[2]) * 255);
    out[i * 4 + 3] = a ? 255 : 0;
  }
  return writePng(file, W, H, out, 4);
}
