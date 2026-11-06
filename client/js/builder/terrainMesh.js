// Земля з точок: точки (x, y, z) з'єднуються трикутниками (Delaunator) у поверхню.
// Уміє: показати точки для редагування, швидко сказати висоту в (x, z), знайти найближчу точку.
import * as THREE from 'three';
import Delaunator from 'delaunator';

// Кольори фарби: 0 трава, 1 земля, 2 бруківка, 3 пісок.
export const PAINTS = [
  { id: 0, label: 'Трава', color: 0x5f7a45 },
  { id: 1, label: 'Земля', color: 0x6b5137 },
  { id: 2, label: 'Бруківка', color: 0x77746d },
  { id: 3, label: 'Пісок', color: 0xc2b280 },
];
const paintColors = PAINTS.map((p) => new THREE.Color(p.color));

function decode(b64, Type) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Type(bytes.buffer);
}

export class PointTerrain {
  constructor() {
    this.group = new THREE.Group();
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: false }));
    this.mesh.receiveShadow = true;
    this.dots = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xf2e6c8, size: 4, sizeAttenuation: false, depthTest: true }));
    this.dots.visible = false;
    this.marked = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xff5040, size: 9, sizeAttenuation: false, depthTest: false }));
    this.marked.renderOrder = 10;
    this.group.add(this.mesh, this.dots, this.marked);
    this.selected = [];
  }

  get count() { return this.pos.length / 3; }

  // Дані з сервера: { version, size, spacing, points (base64 Float32), colors (base64 Uint8) }.
  setData(data) {
    this.version = data.version;
    this.size = data.size;
    this.spacing = data.spacing;
    this.pos = decode(data.points, Float32Array);
    this.col = decode(data.colors, Uint8Array);
    this.selected = this.selected.filter((i) => i < this.count);
    this.rebuild();
  }

  // Нова форма (точки додались / зникли) — заново з'єднати трикутниками.
  rebuild() {
    const n = this.count;
    const flat = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) { flat[i * 2] = this.pos[i * 3]; flat[i * 2 + 1] = this.pos[i * 3 + 2]; }
    const tri = new Delaunator(flat).triangles;
    // Усі трикутники Delaunator закручені в один бік; якщо лицем униз — перевертаємо (у нас Y угору).
    if (tri.length) {
      const [a, b, c] = [tri[0] * 3, tri[1] * 3, tri[2] * 3];
      const p = this.pos;
      const ny = (p[b + 2] - p[a + 2]) * (p[c] - p[a]) - (p[b] - p[a]) * (p[c + 2] - p[a + 2]);
      if (ny < 0) for (let t = 0; t < tri.length; t += 3) { const s = tri[t + 1]; tri[t + 1] = tri[t + 2]; tri[t + 2] = s; }
    }
    this.tri = tri;

    const g = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3);
    g.setAttribute('position', this.posAttr);
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setIndex(new THREE.BufferAttribute(tri, 1));
    this.mesh.geometry.dispose();
    this.mesh.geometry = g;
    const d = new THREE.BufferGeometry();
    d.setAttribute('position', this.posAttr);
    this.dots.geometry.dispose();
    this.dots.geometry = d;
    this.#buildBuckets();
    this.refreshColors();
    this.refreshHeights();
  }

  // Змінились лише висоти — трикутники ті самі.
  refreshHeights() {
    this.posAttr.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.computeBoundingBox();
    this.mesh.geometry.computeBoundingSphere();
    this.dots.geometry.computeBoundingSphere();
    this.#refreshMarked();
  }

  refreshColors() {
    const c = this.mesh.geometry.getAttribute('color');
    for (let i = 0; i < this.count; i++) {
      const p = paintColors[this.col[i]] ?? paintColors[0];
      c.setXYZ(i, p.r, p.g, p.b);
    }
    c.needsUpdate = true;
  }

  heightOf(i) { return this.pos[i * 3 + 1]; }
  setHeight(i, y) { this.pos[i * 3 + 1] = y; }

  // ---------- Вибір точок ----------

  setSelected(list) {
    this.selected = [...new Set(list)].filter((i) => i >= 0 && i < this.count);
    this.#refreshMarked();
  }

  showDots(on) { this.dots.visible = on; this.marked.visible = on; }

  #refreshMarked() {
    const arr = new Float32Array(this.selected.length * 3);
    this.selected.forEach((i, j) => arr.set(this.pos.subarray(i * 3, i * 3 + 3), j * 3));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    this.marked.geometry.dispose();
    this.marked.geometry = g;
  }

  // Найближча точка до (x, z) по горизонталі.
  nearest(x, z) {
    let best = -1;
    let bd = Infinity;
    for (let i = 0, n = this.count; i < n; i++) {
      const dx = this.pos[i * 3] - x;
      const dz = this.pos[i * 3 + 2] - z;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    return { index: best, dist: Math.sqrt(bd) };
  }

  // ---------- Висота в точці (швидко, без променів) ----------

  // Трикутники розкладаємо по клітинках сітки, щоб шукати лише серед кількох.
  #buildBuckets() {
    const tri = this.tri;
    let minX = Infinity; let minZ = Infinity; let maxX = -Infinity; let maxZ = -Infinity;
    for (let i = 0; i < this.count; i++) {
      const x = this.pos[i * 3]; const z = this.pos[i * 3 + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    const triCount = tri.length / 3;
    const cells = Math.max(1, Math.min(512, Math.ceil(Math.sqrt(triCount / 2))));
    const cw = Math.max((maxX - minX) / cells, 1e-6);
    const cd = Math.max((maxZ - minZ) / cells, 1e-6);
    const buckets = Array.from({ length: cells * cells }, () => []);
    const cx = (x) => Math.min(cells - 1, Math.max(0, Math.floor((x - minX) / cw)));
    const cz = (z) => Math.min(cells - 1, Math.max(0, Math.floor((z - minZ) / cd)));
    for (let t = 0; t < triCount; t++) {
      let x0 = Infinity; let x1 = -Infinity; let z0 = Infinity; let z1 = -Infinity;
      for (let k = 0; k < 3; k++) {
        const v = tri[t * 3 + k];
        const x = this.pos[v * 3]; const z = this.pos[v * 3 + 2];
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
      }
      for (let ix = cx(x0); ix <= cx(x1); ix++) for (let iz = cz(z0); iz <= cz(z1); iz++) buckets[iz * cells + ix].push(t);
    }
    this.grid = { minX, minZ, maxX, maxZ, cw, cd, cells, buckets };
  }

  // Висота поверхні в (x, z), або null — поза землею.
  heightAt(x, z) {
    const g = this.grid;
    if (!g || x < g.minX || x > g.maxX || z < g.minZ || z > g.maxZ) return null;
    const ix = Math.min(g.cells - 1, Math.floor((x - g.minX) / g.cw));
    const iz = Math.min(g.cells - 1, Math.floor((z - g.minZ) / g.cd));
    const p = this.pos;
    for (const t of g.buckets[iz * g.cells + ix]) {
      const a = this.tri[t * 3] * 3; const b = this.tri[t * 3 + 1] * 3; const c = this.tri[t * 3 + 2] * 3;
      const det = (p[b + 2] - p[c + 2]) * (p[a] - p[c]) + (p[c] - p[b]) * (p[a + 2] - p[c + 2]);
      if (!det) continue;
      const l1 = ((p[b + 2] - p[c + 2]) * (x - p[c]) + (p[c] - p[b]) * (z - p[c + 2])) / det;
      const l2 = ((p[c + 2] - p[a + 2]) * (x - p[c]) + (p[a] - p[c]) * (z - p[c + 2])) / det;
      const l3 = 1 - l1 - l2;
      if (l1 >= -1e-6 && l2 >= -1e-6 && l3 >= -1e-6) return l1 * p[a + 1] + l2 * p[b + 1] + l3 * p[c + 1];
    }
    return null;
  }
}
