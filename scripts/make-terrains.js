// Генерує готові варіанти рельєфу (terrain.glb) у client/assets/models/cities/<папка>/.
// Запуск: npm run make-terrains
// Кожен варіант — окрема папка міста: у будівельнику вибери її в «Папка моделей міста»,
// а у вкладці «⛰ Земля» — «🗿 terrain.glb».
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeGlb } from './lib/glb.js';
import * as greenHills from './terrains/greenHills.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESIGNS = [greenHills];

for (const design of DESIGNS) {
  const started = Date.now();
  const { counts, ...model } = design.build();
  const file = path.join(ROOT, 'client/assets/models/cities', design.info.folder, 'terrain.glb');
  const { triangles, bytes } = writeGlb(file, { ...model, name: design.info.name, generator: 'Ashlands make-terrains' });
  console.log(`✓ ${design.info.name}: ${path.relative(ROOT, file)} — ${triangles.toLocaleString('uk')} трикутників, ${(bytes / 1024 / 1024).toFixed(1)} МБ, `
    + `${model.primitives.length} шматків; камінців ${counts.stones}, сходинок ${counts.steps}, валунів ${counts.boulders}, кущів ${counts.bushes} (${((Date.now() - started) / 1000).toFixed(1)} с)`);
}
