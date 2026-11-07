// Генерує готові варіанти рельєфу в client/assets/models/cities/<папка>/: terrain.glb + splat.png,
// і спільну текстуру листя client/assets/textures/foliage.png.
// Запуск: npm run make-terrains
// У будівельнику вибери папку варіанта в «Папка моделей міста» — рельєф увімкнеться сам.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFoliageAtlas } from './lib/foliage.js';
import { writeGlb } from './lib/glb.js';
import * as greenHills from './terrains/greenHills/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESIGNS = [greenHills];
const MODELS = path.join(ROOT, 'client/assets/models');

const foliage = path.join(ROOT, 'client/assets/textures/foliage.png');
console.log(`✓ ${path.relative(ROOT, foliage)} — ${(writeFoliageAtlas(foliage) / 1024).toFixed(0)} КБ`);

for (const design of DESIGNS) {
  const started = Date.now();
  const outDir = path.join(MODELS, 'cities', design.info.folder);
  const { counts, notes, names, ...model } = design.build({ outDir, modelsRoot: MODELS });
  // Назви папки й моделей рослин — у models.json.
  const manifestFile = path.join(MODELS, 'models.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  manifest.folders = { ...manifest.folders, [design.info.folder]: design.info.name };
  manifest.names = { ...manifest.names, ...names };
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  const file = path.join(outDir, 'terrain.glb');
  const { triangles, bytes } = writeGlb(file, { ...model, name: design.info.name, generator: 'Ashlands make-terrains' });
  console.log(`✓ ${design.info.name}: ${path.relative(ROOT, file)} — ${triangles.toLocaleString('uk')} трикутників, ${(bytes / 1024 / 1024).toFixed(1)} МБ, `
    + `${model.primitives.length} частин; ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}; ${notes} (${((Date.now() - started) / 1000).toFixed(1)} с)`);
}
