// Варіант рельєфу «Зелені пагорби» 320 × 240 м (за картинкою-концептом, у похмурому стилі):
// пагорби з брукованими стежками, тераса й западина в центрі, позаду скелі з ущелиною й річкою,
// на сході — річка з кам'яним мостом, на заході — ліс зі стежкою-виходом, спереду — луки.
// Вихід у папці міста: terrain.glb (форма + матеріали), splat.png (де яка текстура),
// nature/*.glb (моделі дерев і кущів) і layout.json (де їх посадити — будівельник садить їх окремими предметами).
import fs from 'node:fs';
import path from 'node:path';
import { writePlantModels } from '../../lib/plantModels.js';
import { makeRandom } from '../../lib/noise.js';
import { ChunkedMesh } from '../../lib/shapes.js';
import { addBoulders, addPathStones, addStairs, addWalls } from './decor.js';
import { CHUNK, addGround, addSkirt, makeHeightGrid } from './ground.js';
import { X0, X1, Z0, Z1 } from './layout.js';
import { MAT, materialList } from './materials.js';
import { writeSplat } from './paint.js';
import { addBridge, addWater } from './river.js';
import { placeVegetation } from './vegetation.js';

export const info = { folder: 'green_hills', name: 'Зелені пагорби' };

export function build({ outDir, modelsRoot }) {
  const rnd = makeRandom(2024);
  const mesh = new ChunkedMesh(X0, Z0, CHUNK);
  const counts = { stones: 0, steps: 0, boulders: 0, trees: 0, bushes: 0 };

  const grid = makeHeightGrid();
  addGround(mesh, grid, MAT.terrain);
  addSkirt(mesh, MAT.soil, rnd);
  addPathStones(mesh, rnd, counts);
  addWalls(mesh, rnd, counts);
  addStairs(mesh, rnd, counts);
  addBoulders(mesh, rnd, counts);
  addWater(mesh);
  const bridge = addBridge(mesh, rnd, counts);

  // Рослини: моделі-варіанти + план посадки.
  const plants = writePlantModels(path.join(outDir, 'nature'), modelsRoot);
  const layout = placeVegetation(rnd, counts).map((p) => {
    const variants = plants[p.kind];
    const v = variants[Math.floor(rnd() * variants.length)];
    const r = (n) => Math.round(n * 100) / 100;
    return { model: v.file, x: r(p.x), y: r(p.y), z: r(p.z), rotY: r(p.rotY), scale: r(p.scale) };
  });
  fs.writeFileSync(path.join(outDir, 'layout.json'), JSON.stringify({ _пояснення: 'Що посадити, коли місту вибирають цей варіант рельєфу (окремі предмети будівельника).', objects: layout }));

  const splatBytes = writeSplat(path.join(outDir, 'splat.png'), 1024, 768, grid.nyAt);
  return {
    materials: materialList([X0, Z0, X1, Z1]),
    primitives: mesh.primitives(),
    counts,
    names: Object.fromEntries(Object.values(plants).flat().map((p) => [p.file, p.name])),
    notes: `міст біля (${bridge.x.toFixed(0)}, ${bridge.z.toFixed(0)}); splat.png ${(splatBytes / 1024).toFixed(0)} КБ`,
  };
}
