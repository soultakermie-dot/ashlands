// Бібліотека 3D-моделей: що лежить у client/assets/models/ (див. BUILDING.md).
//   common/<категорія>/*.glb             — спільні для всіх міст
//   cities/<папка>/terrain.glb           — рельєф міста
//   cities/<папка>/<категорія>/*.glb      — моделі лише цього міста
// Українські назви — у client/assets/models/models.json.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

export const MODELS_DIR = path.join(config.paths.client, 'assets', 'models');
const URL_BASE = '/assets/models';

const toPosix = (p) => p.split(path.sep).join('/');

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(path.join(MODELS_DIR, 'models.json'), 'utf8'));
  } catch {
    return { categories: {}, names: {} };
  }
}

const listDirs = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : []);
const listGlb = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.glb')) : []);

function modelsIn(baseRel, manifest) {
  const result = [];
  for (const category of listDirs(path.join(MODELS_DIR, baseRel))) {
    for (const file of listGlb(path.join(MODELS_DIR, baseRel, category))) {
      const rel = toPosix(path.join(baseRel, category, file));
      result.push({
        path: rel,
        url: `${URL_BASE}/${rel}`,
        name: manifest.names?.[rel] ?? file.replace(/\.glb$/i, '').replace(/[_-]+/g, ' '),
        category,
        categoryName: manifest.categories?.[category] ?? category,
      });
    }
  }
  return result.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name, 'uk'));
}

// Уся бібліотека (читається з диска щоразу — нові файли видно без перезапуску сервера).
export function getLibrary() {
  const manifest = readManifest();
  const cities = {};
  for (const folder of listDirs(path.join(MODELS_DIR, 'cities'))) {
    const terrain = path.join(MODELS_DIR, 'cities', folder, 'terrain.glb');
    cities[folder] = {
      name: manifest.folders?.[folder] ?? folder,
      terrainUrl: fs.existsSync(terrain) ? `${URL_BASE}/cities/${folder}/terrain.glb` : null,
      models: modelsIn(`cities/${folder}`, manifest),
    };
  }
  return { common: modelsIn('common', manifest), cities };
}

// Чи існує модель за шляхом (захист від вигаданих шляхів).
export function modelExists(rel) {
  if (typeof rel !== 'string' || !/^[a-z0-9_\-/]+\.glb$/i.test(rel) || rel.includes('..')) return false;
  return fs.existsSync(path.join(MODELS_DIR, rel));
}

export function folderExists(folder) {
  return typeof folder === 'string' && /^[a-z0-9_-]+$/i.test(folder) && fs.existsSync(path.join(MODELS_DIR, 'cities', folder));
}
