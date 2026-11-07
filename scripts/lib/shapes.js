// Прості 3D-форми для генерації рельєфу: камінь (нерівний багатогранник), ящик (сходинка),
// і «збирач» — складає все в шматки по квадратах, щоб браузер швидко знаходив висоту землі.
// Частина (part) = { pos: [x,y,z…], nor: [x,y,z…], col: [r,g,b… 0..1], idx: [a,b,c…] }.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add3 = (a, b, c) => [a[0] + b[0] + c[0], a[1] + b[1] + c[1], a[2] + b[2] + c[2]];

// ---------- Ікосаедр (основа каменів і кущів) ----------

const T = (1 + Math.sqrt(5)) / 2;
const ICO_V = [[-1, T, 0], [1, T, 0], [-1, -T, 0], [1, -T, 0], [0, -1, T], [0, 1, T], [0, -1, -T], [0, 1, -T], [T, 0, -1], [T, 0, 1], [-T, 0, -1], [-T, 0, 1]]
  .map(([x, y, z]) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; });
const ICO_F = [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
  3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1];

function sphere(detail) {
  const verts = ICO_V.map((v) => [...v]);
  let faces = [...ICO_F];
  for (let d = 0; d < detail; d++) {
    const cache = new Map();
    const mid = (a, b) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (!cache.has(key)) {
        const [x, y, z] = [0, 1, 2].map((k) => verts[a][k] + verts[b][k]);
        const l = Math.hypot(x, y, z);
        verts.push([x / l, y / l, z / l]);
        cache.set(key, verts.length - 1);
      }
      return cache.get(key);
    };
    const next = [];
    for (let i = 0; i < faces.length; i += 3) {
      const [a, b, c] = [faces[i], faces[i + 1], faces[i + 2]];
      const ab = mid(a, b); const bc = mid(b, c); const ca = mid(c, a);
      next.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
    }
    faces = next;
  }
  // Усі грані — лицем назовні.
  for (let i = 0; i < faces.length; i += 3) {
    const [a, b, c] = [verts[faces[i]], verts[faces[i + 1]], verts[faces[i + 2]]];
    const n = cross(sub(b, a), sub(c, a));
    if (dot(n, add3(a, b, c)) < 0) { const s = faces[i + 1]; faces[i + 1] = faces[i + 2]; faces[i + 2] = s; }
  }
  return { verts, faces };
}
const SPHERES = [sphere(0), sphere(1)];


// Гладкі нормалі вершин (середнє нормалей граней).
export function vertexNormals(pos, idx) {
  const nor = new Array(pos.length).fill(0);
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [idx[i] * 3, idx[i + 1] * 3, idx[i + 2] * 3];
    const n = cross([pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]]);
    for (const v of [a, b, c]) { nor[v] += n[0]; nor[v + 1] += n[1]; nor[v + 2] += n[2]; }
  }
  for (let i = 0; i < nor.length; i += 3) {
    const l = Math.hypot(nor[i], nor[i + 1], nor[i + 2]) || 1;
    nor[i] /= l; nor[i + 1] /= l; nor[i + 2] /= l;
  }
  return nor;
}

/**
 * Нерівний камінь / кущ.
 * @param rnd   генератор випадкових 0..1
 * @param o     { x, y, z, sx, sy, sz, rotY, color: [r,g,b], jitter (0..0.4), colorJitter, detail (0|1), tint? (r,g,b,rnd) => [r,g,b] }
 */
export function blob(rnd, o) {
  const { verts, faces } = SPHERES[o.detail ?? 0];
  const c = Math.cos(o.rotY ?? 0);
  const s = Math.sin(o.rotY ?? 0);
  const pos = [];
  const col = [];
  for (const [vx, vy, vz] of verts) {
    const r = 1 + (rnd() * 2 - 1) * (o.jitter ?? 0.2);
    const x = vx * r * o.sx; const y = vy * r * o.sy; const z = vz * r * o.sz;
    pos.push(o.x + x * c + z * s, o.y + y, o.z - x * s + z * c);
    const k = 1 + (rnd() * 2 - 1) * (o.colorJitter ?? 0.08);
    let rgb = [o.color[0] * k, o.color[1] * k, o.color[2] * k];
    if (o.tint) rgb = o.tint(rgb, rnd, vy);
    col.push(...rgb);
  }
  return { pos, nor: vertexNormals(pos, faces), col, idx: [...faces] };
}

/** Ящик (сходинка): центр низу (x, y, z), розміри w (упоперек), h, d (уздовж), поворот rotY. */
export function box(o) {
  const c = Math.cos(o.rotY ?? 0);
  const s = Math.sin(o.rotY ?? 0);
  const P = (lx, ly, lz) => [o.x + lx * c + lz * s, o.y + ly, o.z - lx * s + lz * c];
  const N = (nx, ny, nz) => [nx * c + nz * s, ny, -nx * s + nz * c];
  const w = o.w / 2; const d = o.d / 2; const h = o.h;
  const faces = [
    [N(0, 1, 0), [[-w, h, -d], [-w, h, d], [w, h, d], [w, h, -d]], 1],
    [N(0, -1, 0), [[-w, 0, -d], [w, 0, -d], [w, 0, d], [-w, 0, d]], 0.6],
    [N(1, 0, 0), [[w, 0, -d], [w, h, -d], [w, h, d], [w, 0, d]], 0.85],
    [N(-1, 0, 0), [[-w, 0, -d], [-w, 0, d], [-w, h, d], [-w, h, -d]], 0.85],
    [N(0, 0, 1), [[-w, 0, d], [w, 0, d], [w, h, d], [-w, h, d]], 0.9],
    [N(0, 0, -1), [[-w, 0, -d], [-w, h, -d], [w, h, -d], [w, 0, -d]], 0.9],
  ];
  const part = { pos: [], nor: [], col: [], idx: [] };
  for (const [n, quad, shade] of faces) {
    const base = part.pos.length / 3;
    for (const q of quad) {
      part.pos.push(...P(...q));
      part.nor.push(...n);
      part.col.push(o.color[0] * shade, o.color[1] * shade, o.color[2] * shade);
    }
    // Порядок вершин підібраний так, щоб грань дивилась назовні.
    part.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  // Перевірка напрямку: якщо нормаль трикутника протилежна заданій — розвертаємо.
  for (let i = 0; i < part.idx.length; i += 3) {
    const [a, b, cc] = [part.idx[i] * 3, part.idx[i + 1] * 3, part.idx[i + 2] * 3];
    const p = part.pos;
    const n = cross([p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]], [p[cc] - p[a], p[cc + 1] - p[a + 1], p[cc + 2] - p[a + 2]]);
    if (dot(n, [part.nor[a], part.nor[a + 1], part.nor[a + 2]]) < 0) { const t = part.idx[i + 1]; part.idx[i + 1] = part.idx[i + 2]; part.idx[i + 2] = t; }
  }
  return part;
}

// ---------- Збирач по шматках ----------

export class ChunkedMesh {
  constructor(minX, minZ, size) {
    this.minX = minX;
    this.minZ = minZ;
    this.size = size;
    this.chunks = new Map();
  }

  #chunk(x, z) {
    const key = `${Math.floor((x - this.minX) / this.size)},${Math.floor((z - this.minZ) / this.size)}`;
    if (!this.chunks.has(key)) this.chunks.set(key, { pos: [], nor: [], col: [], idx: [] });
    return this.chunks.get(key);
  }

  // Додати частину в шматок, де лежить точка (x, z).
  add(x, z, part) {
    const c = this.#chunk(x, z);
    const base = c.pos.length / 3;
    for (const v of part.pos) c.pos.push(v);
    for (const v of part.nor) c.nor.push(v);
    for (const v of part.col) c.col.push(v);
    for (const i of part.idx) c.idx.push(base + i);
  }

  primitives(material) {
    // Кольори задаємо «як на екрані» (sRGB), а glTF зберігає лінійні — перераховуємо.
    const lin = (v) => Math.round(Math.min(1, Math.max(0, v)) ** 2.2 * 255);
    return [...this.chunks.values()].filter((c) => c.idx.length).map((c) => {
      const colors = new Uint8Array((c.col.length / 3) * 4);
      for (let i = 0, j = 0; i < c.col.length; i += 3, j += 4) {
        colors[j] = lin(c.col[i]);
        colors[j + 1] = lin(c.col[i + 1]);
        colors[j + 2] = lin(c.col[i + 2]);
        colors[j + 3] = 255;
      }
      return { material, positions: Float32Array.from(c.pos), normals: Float32Array.from(c.nor), colors, indices: Uint32Array.from(c.idx) };
    });
  }
}
