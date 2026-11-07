// Окремі моделі рослин (.glb) — кілька варіантів ялин, листяних дерев і кущів.
// Їх розставляють як звичайні предмети будівельника: кожну можна видалити, посунути, змінити розмір.
// Точка опори — внизу по центру (на землі), метри, як вимагає BUILDING.md.
import path from 'node:path';
import { writeGlb } from './glb.js';
import { makeRandom } from './noise.js';
import { bushCards, conifer, deciduous } from './plants.js';
import { ChunkedMesh } from './shapes.js';

const MATERIALS = [
  { name: 'ash_bark', extras: { ashlands: 'bark' } },
  { name: 'ash_foliage', extras: { ashlands: 'foliage' }, doubleSided: true },
];

export const PLANT_KINDS = {
  spruce: { make: (rnd) => conifer(rnd, 0, 0, 0, 14), name: 'Ялина' },
  tree: { make: (rnd) => deciduous(rnd, 0, 0, 0, 10), name: 'Листяне дерево' },
  bush: { make: (rnd) => bushCards(rnd, 0, 0, 0, 1), name: 'Кущ' },
};

/**
 * Записати варіанти рослин у dir (наприклад …/cities/green_hills/nature/).
 * @returns {{ [kind]: { file, name }[] }} — шляхи відносно modelsRoot.
 */
export function writePlantModels(dir, modelsRoot, variants = { spruce: 4, tree: 3, bush: 3 }, seed = 77) {
  const rnd = makeRandom(seed);
  const out = {};
  for (const [kind, count] of Object.entries(variants)) {
    out[kind] = [];
    for (let v = 1; v <= count; v++) {
      const parts = PLANT_KINDS[kind].make(rnd);
      const mesh = new ChunkedMesh(-1000, -1000, 4000);
      if (parts.bark) mesh.add(0, 0, parts.bark, 0);
      mesh.add(0, 0, parts.leaves, 1);
      const file = path.join(dir, `${kind}_${v}.glb`);
      writeGlb(file, { materials: MATERIALS, primitives: mesh.primitives(), name: `${kind}_${v}`, generator: 'Ashlands make-terrains' });
      out[kind].push({ file: path.relative(modelsRoot, file).split(path.sep).join('/'), name: `${PLANT_KINDS[kind].name} ${v}` });
    }
  }
  return out;
}
