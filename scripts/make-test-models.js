// Генерує тестові 3D-моделі (.glb) для перевірки режиму «Будівельник», поки нема моделей з Blender.
// Запуск: npm run make-test-models
// Модель відповідає вимогам з BUILDING.md: метри, точка опори внизу по центру, вісь вгору — Y (як після експорту з Blender).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- Геометрія (low-poly, кожен трикутник зі своєю нормаллю — «гранений» вигляд) ----------

function addTri(out, a, b, c) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const len = Math.hypot(...n) || 1;
  for (const p of [a, b, c]) {
    out.positions.push(...p);
    out.normals.push(n[0] / len, n[1] / len, n[2] / len);
  }
}

const ring = (r, y, segments, phase = 0) => Array.from({ length: segments }, (_, i) => {
  const a = (i / segments) * Math.PI * 2 + phase;
  return [Math.cos(a) * r, y, Math.sin(a) * r];
});

// Зрізаний конус від y0 (радіус r0) до y1 (радіус r1); r1 = 0 — гострий верх.
function frustum(out, r0, y0, r1, y1, segments, phase = 0, capBottom = true) {
  const bottom = ring(r0, y0, segments, phase);
  const top = r1 > 0 ? ring(r1, y1, segments, phase) : null;
  const apex = [0, y1, 0];
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments;
    if (top) {
      addTri(out, bottom[i], top[i], bottom[j]);
      addTri(out, bottom[j], top[i], top[j]);
    } else {
      addTri(out, bottom[i], apex, bottom[j]);
    }
    if (capBottom) addTri(out, bottom[j], [0, y0, 0], bottom[i]);
  }
}

// ---------- Запис .glb (glTF 2.0 Binary) ----------

function writeGlb(file, parts) {
  const chunks = [];
  const bufferViews = [];
  const accessors = [];
  const primitives = [];
  const materials = [];
  let offset = 0;

  const pushFloats = (arr, withMinMax) => {
    const buf = Buffer.from(new Float32Array(arr).buffer);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, target: 34962 });
    chunks.push(buf);
    offset += buf.length;
    const acc = { bufferView: bufferViews.length - 1, componentType: 5126, count: arr.length / 3, type: 'VEC3' };
    if (withMinMax) {
      acc.min = [0, 1, 2].map((k) => Math.min(...arr.filter((_, i) => i % 3 === k)));
      acc.max = [0, 1, 2].map((k) => Math.max(...arr.filter((_, i) => i % 3 === k)));
    }
    accessors.push(acc);
    return accessors.length - 1;
  };

  for (const part of parts) {
    materials.push({ name: part.name, pbrMetallicRoughness: { baseColorFactor: part.color, metallicFactor: 0, roughnessFactor: 0.9 } });
    const pos = pushFloats(part.geometry.positions, true);
    const nor = pushFloats(part.geometry.normals, false);
    primitives.push({ attributes: { POSITION: pos, NORMAL: nor }, material: materials.length - 1 });
  }

  const bin = Buffer.concat(chunks);
  const json = {
    asset: { version: '2.0', generator: 'Ashlands make-test-models' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: path.basename(file, '.glb') }],
    meshes: [{ primitives }],
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: bin.length }],
  };

  const pad = (b, fill) => (b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4), fill)]) : b);
  const jsonBuf = pad(Buffer.from(JSON.stringify(json)), 0x20);
  const binBuf = pad(bin, 0);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // 'glTF'
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + binBuf.length, 8);
  const chunkHeader = (len, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(len, 0); h.writeUInt32LE(type, 4); return h; };

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([header, chunkHeader(jsonBuf.length, 0x4e4f534a), jsonBuf, chunkHeader(binBuf.length, 0x004e4942), binBuf]));
  const triangles = parts.reduce((n, p) => n + p.geometry.positions.length / 9, 0);
  console.log(`✓ ${path.relative(ROOT, file)} — ${triangles} трикутників, ${(fs.statSync(file).size / 1024).toFixed(1)} КБ`);
}

// ---------- Тестова ялина: ~6 м заввишки ----------

const trunk = { positions: [], normals: [] };
frustum(trunk, 0.3, 0, 0.18, 2.2, 7);

const needles = { positions: [], normals: [] };
frustum(needles, 1.9, 1.4, 0, 3.6, 8, 0.2);
frustum(needles, 1.5, 2.7, 0, 4.8, 8, 0.6);
frustum(needles, 1.05, 3.9, 0, 6.0, 8, 0.1);

writeGlb(path.join(ROOT, 'client/assets/models/common/nature/test_tree.glb'), [
  { name: 'Стовбур', color: [0.36, 0.25, 0.16, 1], geometry: trunk },
  { name: 'Хвоя', color: [0.17, 0.3, 0.17, 1], geometry: needles },
]);
