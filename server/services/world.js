// Світ: карта, локації (міста, підземелля), дороги, стартова точка.
// Міста, дороги й старт ДМ готує в творчому режимі; підземелля ставить прямо в грі.
import { forgetTerrain } from './terrain.js';
import crypto from 'node:crypto';
import { stores } from '../storage/index.js';
import { GameError } from './errors.js';

// Картинка карти та її розмір у пікселях. Координати локацій — у цих самих пікселях.
const WORLD_MAP = {
  image: '/assets/images/world-map-placeholder.svg',
  width: 4000,
  height: 3000,
  // Масштаб: скільки метрів в одному пікселі карти. Для справжньої карти — підставити її масштаб.
  metersPerPixel: 10,
};

// Передавати предмети й золото можна персонажу, що стоїть не далі за це.
export const TRANSFER_RADIUS_M = 100;

export const LOCATION_TYPES = { CITY: 'city', DUNGEON: 'dungeon' };
const MAX_ROAD_POINTS = 50;

const locations = () => stores.locations.data.locations;
const roads = () => stores.roads.data.roads;
const settings = () => stores.worldSettings.data;

// ---------- Тестові дані при першому запуску ----------

const SEED_CITIES = [
  ['Попелград', 1180, 1000], ['Чорний Брід', 1690, 1480], ['Вороняче Гніздо', 2560, 900],
  ['Сірий Порт', 900, 2050], ['Морок-на-Скелі', 3120, 1560], ['Тліюча Застава', 2300, 2250],
];
const SEED_ROADS = [
  ['Попелград', 'Чорний Брід', [[1400, 1180]]],
  ['Чорний Брід', 'Вороняче Гніздо', [[2100, 1250], [2350, 1000]]],
  ['Чорний Брід', 'Сірий Порт', [[1350, 1800]]],
  ['Чорний Брід', 'Тліюча Застава', [[1950, 1900]]],
  ['Вороняче Гніздо', 'Морок-на-Скелі', [[2900, 1200]]],
];

// Один раз (за чистої бази) створюємо тестові міста й дороги — їх можна змінити чи видалити.
export function seedWorldOnce() {
  if (settings().seeded) return;
  if (!locations().length) {
    const byName = new Map();
    for (const [name, x, y] of SEED_CITIES) byName.set(name, createLocation({ type: LOCATION_TYPES.CITY, name, x, y }));
    for (const [a, b, points] of SEED_ROADS) createRoad(byName.get(a).id, byName.get(b).id, points);
    console.log('[world] Створено тестові міста й дороги');
  }
  settings().spawn ??= { x: 1180, y: 1060 };
  settings().seeded = true;
  stores.worldSettings.save();
}

// ---------- Читання ----------

const toPublicLocation = (l) => ({ id: l.id, type: l.type, name: l.name, description: l.description ?? '', x: l.x, y: l.y });
const toPublicRoad = (r) => ({ id: r.id, fromId: r.fromId, toId: r.toId, points: r.points ?? [] });

// forDm — ДМ бачить ще й стартову точку.
export function getWorld({ forDm = false } = {}) {
  return {
    map: WORLD_MAP,
    locations: locations().map(toPublicLocation),
    roads: roads().map(toPublicRoad),
    ...(forDm ? { spawn: getSpawnPoint() } : {}),
  };
}

export function getSpawnPoint() {
  return { ...(settings().spawn ?? { x: WORLD_MAP.width / 2, y: WORLD_MAP.height / 2 }) };
}

export function findLocation(id) {
  return typeof id === 'string' ? locations().find((l) => l.id === id) ?? null : null;
}

function getLocation(id) {
  const loc = findLocation(id);
  if (!loc) throw new GameError('Локацію не знайдено');
  return loc;
}

function getRoad(id) {
  const road = typeof id === 'string' ? roads().find((r) => r.id === id) : null;
  if (!road) throw new GameError('Дорогу не знайдено');
  return road;
}

// ---------- Перевірки ----------

// Чи точка в межах карти.
export function isInsideMap(x, y) {
  return Number.isFinite(x) && Number.isFinite(y)
    && x >= 0 && y >= 0 && x <= WORLD_MAP.width && y <= WORLD_MAP.height;
}

function cleanPoint(x, y) {
  const nx = Number(x);
  const ny = Number(y);
  if (!isInsideMap(nx, ny)) throw new GameError('Точка за межами карти');
  return { x: Math.round(nx), y: Math.round(ny) };
}

function cleanName(name) {
  const clean = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  const length = [...clean].length;
  if (length < 2 || length > 60) throw new GameError('Назва: від 2 до 60 символів');
  return clean;
}

function cleanDescription(text) {
  const clean = typeof text === 'string' ? text.replace(/\r\n/g, '\n').trim() : '';
  if ([...clean].length > 2000) throw new GameError('Опис: до 2000 символів');
  return clean;
}

function cleanRoadPoints(points) {
  if (!Array.isArray(points) || points.length > MAX_ROAD_POINTS) throw new GameError(`Дорога: до ${MAX_ROAD_POINTS} точок згину`);
  return points.map((p) => {
    const { x, y } = cleanPoint(p?.[0], p?.[1]);
    return [x, y];
  });
}

// Відстань між двома персонажами на карті в метрах (null — хтось не на карті).
export function distanceMeters(a, b) {
  if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return null;
  return Math.hypot(a.x - b.x, a.y - b.y) * WORLD_MAP.metersPerPixel;
}

// ---------- Зміни (лише ДМ) ----------

export function createLocation({ type, name, x, y, description = '' }) {
  if (!Object.values(LOCATION_TYPES).includes(type)) throw new GameError('Невідомий тип локації');
  const loc = {
    id: crypto.randomUUID(),
    type,
    name: cleanName(name),
    description: cleanDescription(description),
    ...cleanPoint(x, y),
    createdAt: new Date().toISOString(),
  };
  locations().push(loc);
  stores.locations.save();
  return loc;
}

// Змінити назву, опис і/або місце (передаються лише ті поля, які змінюються).
export function updateLocation(id, patch) {
  const loc = getLocation(id);
  if (patch.name !== undefined) loc.name = cleanName(patch.name);
  if (patch.description !== undefined) loc.description = cleanDescription(patch.description);
  if (patch.x !== undefined || patch.y !== undefined) Object.assign(loc, cleanPoint(patch.x ?? loc.x, patch.y ?? loc.y));
  stores.locations.save();
  return loc;
}

// Видалити локацію разом з дорогами до неї.
export function deleteLocation(id) {
  const loc = getLocation(id);
  locations().splice(locations().indexOf(loc), 1);
  const all = roads();
  const before = all.length;
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i].fromId === id || all[i].toId === id) all.splice(i, 1);
  }
  if (all.length !== before) stores.roads.save();
  const scenes = stores.cityScenes.data.scenes;
  const si = scenes.findIndex((s) => s.locationId === id);
  if (si >= 0) { scenes.splice(si, 1); stores.cityScenes.save(); }
  forgetTerrain(id);
  stores.locations.save();
  return loc;
}

export function createRoad(fromId, toId, points = []) {
  getLocation(fromId);
  getLocation(toId);
  if (fromId === toId) throw new GameError('Дорога має з\'єднувати дві різні локації');
  const exists = roads().some((r) => (r.fromId === fromId && r.toId === toId) || (r.fromId === toId && r.toId === fromId));
  if (exists) throw new GameError('Між цими локаціями дорога вже є');
  const road = { id: crypto.randomUUID(), fromId, toId, points: cleanRoadPoints(points), createdAt: new Date().toISOString() };
  roads().push(road);
  stores.roads.save();
  return road;
}

export function updateRoad(id, points) {
  const road = getRoad(id);
  road.points = cleanRoadPoints(points);
  stores.roads.save();
  return road;
}

export function deleteRoad(id) {
  const road = getRoad(id);
  roads().splice(roads().indexOf(road), 1);
  stores.roads.save();
  return road;
}

export function setSpawnPoint(x, y) {
  settings().spawn = cleanPoint(x, y);
  stores.worldSettings.save();
  return settings().spawn;
}
