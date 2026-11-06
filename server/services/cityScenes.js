// 3D-сцени міст: яка папка моделей у міста і що де стоїть. Будують лише ДМ (режим «Будівельник»).
import crypto from 'node:crypto';
import { stores } from '../storage/index.js';
import { GameError } from './errors.js';
import { folderExists, getLibrary, modelExists } from './models.js';
import { findLocation } from './world.js';

const MAX_OBJECTS = 2000;
const COORD_MAX = 5000;   // метри від центру міста
const SCALE_MIN = 0.05;
const SCALE_MAX = 20;

const scenes = () => stores.cityScenes.data.scenes;

function getCity(locationId) {
  const loc = findLocation(locationId);
  if (!loc || loc.type !== 'city') throw new GameError('Місто не знайдено');
  return loc;
}

function sceneOf(locationId, create = false) {
  let s = scenes().find((x) => x.locationId === locationId);
  if (!s && create) {
    s = { locationId, folder: null, objects: [], updatedAt: new Date().toISOString() };
    scenes().push(s);
  }
  return s;
}

function touch(s) {
  s.updatedAt = new Date().toISOString();
  stores.cityScenes.save();
}

const num = (v, min, max, label) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new GameError(`${label}: від ${min} до ${max}`);
  return Math.round(n * 1000) / 1000;
};

function cleanTransform(t) {
  return {
    x: num(t.x, -COORD_MAX, COORD_MAX, 'Позиція X'),
    y: num(t.y, -COORD_MAX, COORD_MAX, 'Висота'),
    z: num(t.z, -COORD_MAX, COORD_MAX, 'Позиція Z'),
    rotY: num(t.rotY ?? 0, -100, 100, 'Поворот'),
    scale: num(t.scale ?? 1, SCALE_MIN, SCALE_MAX, 'Розмір'),
  };
}

// Сцена міста для показу: рельєф, моделі (спільні + міста), розставлені об'єкти.
export function getScene(locationId) {
  const city = getCity(locationId);
  const s = sceneOf(locationId);
  const library = getLibrary();
  const folder = s?.folder && library.cities[s.folder] ? s.folder : null;
  return {
    locationId: city.id,
    cityName: city.name,
    folder,
    folders: Object.keys(library.cities),
    terrainUrl: folder ? library.cities[folder].terrainUrl : null,
    models: [...library.common, ...(folder ? library.cities[folder].models : [])],
    objects: s?.objects ?? [],
  };
}

export function setFolder(locationId, folder) {
  getCity(locationId);
  if (folder !== null && !folderExists(folder)) throw new GameError('Такої папки міста нема');
  const s = sceneOf(locationId, true);
  s.folder = folder;
  touch(s);
}

export function addObject(locationId, { model, ...t }) {
  getCity(locationId);
  if (!modelExists(model)) throw new GameError('Модель не знайдено');
  const s = sceneOf(locationId, true);
  if (s.objects.length >= MAX_OBJECTS) throw new GameError(`У місті вже ${MAX_OBJECTS} об'єктів — це максимум`);
  const obj = { id: crypto.randomUUID(), model, ...cleanTransform(t) };
  s.objects.push(obj);
  touch(s);
  return obj;
}

export function updateObject(locationId, objectId, t) {
  const s = sceneOf(locationId);
  const obj = s?.objects.find((o) => o.id === objectId);
  if (!obj) throw new GameError('Об\'єкт не знайдено');
  Object.assign(obj, cleanTransform({ ...obj, ...t }));
  touch(s);
  return obj;
}

export function deleteObject(locationId, objectId) {
  const s = sceneOf(locationId);
  const i = s ? s.objects.findIndex((o) => o.id === objectId) : -1;
  if (i < 0) throw new GameError('Об\'єкт не знайдено');
  s.objects.splice(i, 1);
  touch(s);
}
