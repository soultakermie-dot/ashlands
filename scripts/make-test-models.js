// Генерує тестові 3D-моделі (.glb) для перевірки режиму «Будівельник», поки нема моделей з Blender.
// Запуск: npm run make-test-models
// Модель відповідає вимогам з BUILDING.md: метри, точка опори внизу по центру, вісь вгору — Y (як після експорту з Blender).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeGlb } from './lib/glb.js';

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

// ---------- Тестова ялина: ~6 м заввишки ----------

const trunk = { positions: [], normals: [] };
frustum(trunk, 0.3, 0, 0.18, 2.2, 7);

const needles = { positions: [], normals: [] };
frustum(needles, 1.9, 1.4, 0, 3.6, 8, 0.2);
frustum(needles, 1.5, 2.7, 0, 4.8, 8, 0.6);
frustum(needles, 1.05, 3.9, 0, 6.0, 8, 0.1);

const file = path.join(ROOT, 'client/assets/models/common/nature/test_tree.glb');
const { triangles, bytes } = writeGlb(file, {
  generator: 'Ashlands make-test-models',
  materials: [{ name: 'Стовбур', color: [0.36, 0.25, 0.16, 1] }, { name: 'Хвоя', color: [0.17, 0.3, 0.17, 1] }],
  primitives: [{ material: 0, ...trunk }, { material: 1, ...needles }],
});
console.log(`✓ ${path.relative(ROOT, file)} — ${triangles} трикутників, ${(bytes / 1024).toFixed(1)} КБ`);
