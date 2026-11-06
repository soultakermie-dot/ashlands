// Подорожі: персонаж іде дорогами до вибраної локації в справжньому часі (5–20 хв).
// Сервер зберігає маршрут, швидкість і скільки вже пройдено — тож позицію можна порахувати в будь-який момент.
// ДМ може поставити подорож на паузу («дійшли тільки сюди»), продовжити або скасувати.
// Якщо ДМ увімкнув «рух з дозволом», гравець лише просить, а ДМ підтверджує.
import { config } from '../config.js';
import { stores } from '../storage/index.js';
import { CHARACTER_STATUS, findCharacter } from './characters.js';
import { GameError } from './errors.js';
import { dist, lengthOf, pointAt, project, splitAt } from './geometry.js';
import { ensurePlaced } from './placement.js';
import { findLocation } from './world.js';

const AT_LOCATION_PX = 20;   // ближче за це — персонаж «у місті»

const locations = () => stores.locations.data.locations;
const roads = () => stores.roads.data.roads;
const settings = () => stores.worldSettings.data;

// Запити на подорож, що чекають дозволу ДМ: characterId → { characterId, destinationId, requestedAt }.
const requests = new Map();

// ---------- Позиція ----------

// Де персонаж зараз (з урахуванням подорожі).
export function currentPosition(character, now = Date.now()) {
  ensurePlaced(character);
  const t = character.travel;
  if (!t) return { x: character.x, y: character.y };
  const [x, y] = pointAt(t.path, progressOf(t, now) * t.length);
  return { x, y };
}

function elapsedOf(t, now) {
  return t.elapsedMs + (t.runningSince ? now - t.runningSince : 0);
}

function progressOf(t, now) {
  return t.durationMs > 0 ? Math.min(1, elapsedOf(t, now) / t.durationMs) : 1;
}

// ---------- Пошук шляху по дорогах ----------

// Шлях ламаною дороги від локації a до b (з урахуванням напрямку).
function roadPath(road, fromId) {
  const a = findLocation(road.fromId);
  const b = findLocation(road.toId);
  const full = [[a.x, a.y], ...road.points, [b.x, b.y]];
  return fromId === road.fromId ? full : [...full].reverse();
}

/**
 * Найкоротший маршрут від точки p до локації destinationId.
 * Якщо p не в місті — спершу навпростець до найближчої локації або найближчої дороги.
 * Повертає ламану [[x, y], ...] або null, якщо дістатися неможливо.
 */
export function findRoute(p, destinationId) {
  const dest = findLocation(destinationId);
  if (!dest) throw new GameError('Локацію не знайдено');
  const start = [p.x, p.y];

  // Початкові «входи» в мережу доріг: локація → { cost, prefix (ламана від p до неї) }.
  const entries = new Map();
  const offer = (locId, cost, prefix) => {
    const cur = entries.get(locId);
    if (!cur || cost < cur.cost) entries.set(locId, { cost, prefix });
  };

  const here = locations().find((l) => dist(start, [l.x, l.y]) <= AT_LOCATION_PX);
  if (here) {
    offer(here.id, 0, [start, [here.x, here.y]]);
  } else {
    // а) навпростець до найближчої локації
    let nearest = null;
    for (const l of locations()) {
      const d = dist(start, [l.x, l.y]);
      if (!nearest || d < nearest.d) nearest = { l, d };
    }
    if (nearest) offer(nearest.l.id, nearest.d, [start, [nearest.l.x, nearest.l.y]]);
    // б) навпростець до найближчої дороги, далі нею в обидва боки
    let best = null;
    for (const road of roads()) {
      const path = roadPath(road, road.fromId);
      const proj = project(path, start);
      if (!best || proj.distance < best.proj.distance) best = { road, path, proj };
    }
    if (best) {
      const { forward, backward } = splitAt(best.path, best.proj);
      offer(best.road.toId, best.proj.distance + lengthOf(forward), [start, ...forward]);
      offer(best.road.fromId, best.proj.distance + lengthOf(backward), [start, ...backward]);
    }
  }

  // Дейкстра по локаціях.
  const cost = new Map();
  const prev = new Map();   // locId → { from: locId | null, path: ламана до locId }
  const queue = new Set();
  for (const [id, e] of entries) {
    cost.set(id, e.cost);
    prev.set(id, { from: null, path: e.prefix });
    queue.add(id);
  }
  while (queue.size) {
    let u = null;
    for (const id of queue) if (u === null || cost.get(id) < cost.get(u)) u = id;
    queue.delete(u);
    if (u === destinationId) break;
    for (const road of roads()) {
      if (road.fromId !== u && road.toId !== u) continue;
      const v = road.fromId === u ? road.toId : road.fromId;
      const path = roadPath(road, u);
      const c = cost.get(u) + lengthOf(path);
      if (!cost.has(v) || c < cost.get(v)) {
        cost.set(v, c);
        prev.set(v, { from: u, path });
        queue.add(v);
      }
    }
  }
  if (!prev.has(destinationId)) return null;

  // Збираємо ламану від кінця до початку.
  const pieces = [];
  for (let id = destinationId; id !== null; id = prev.get(id).from) pieces.unshift(prev.get(id).path);
  const route = [];
  for (const piece of pieces) {
    for (const pt of piece) {
      const last = route[route.length - 1];
      if (!last || dist(last, pt) > 0.5) route.push([Math.round(pt[0] * 10) / 10, Math.round(pt[1] * 10) / 10]);
    }
  }
  return route.length >= 2 ? route : null;
}

// ---------- Подорож ----------

function durationFor(length) {
  const { msPerPixel, minMs, maxMs, timeScale } = config.travel;
  return Math.round(Math.min(maxMs, Math.max(minMs, length * msPerPixel)) * timeScale);
}

function getCharacter(id) {
  const c = typeof id === 'string' ? findCharacter(id) : null;
  if (!c) throw new GameError('Персонажа не знайдено');
  return c;
}

// Почати подорож персонажа до локації (замінює попередню, якщо була).
export function startTravel(character, destinationId, now = Date.now()) {
  const from = currentPosition(character, now);
  const dest = findLocation(destinationId);
  if (!dest) throw new GameError('Локацію не знайдено');
  if (dist([from.x, from.y], [dest.x, dest.y]) <= AT_LOCATION_PX && !character.travel) {
    throw new GameError(`Ви вже в «${dest.name}»`);
  }
  const path = findRoute(from, destinationId);
  if (!path) throw new GameError(`Немає дороги до «${dest.name}»`);
  const length = lengthOf(path);
  character.x = from.x;
  character.y = from.y;
  character.travel = {
    destinationId,
    destinationName: dest.name,
    path,
    length,
    durationMs: durationFor(length),
    elapsedMs: 0,
    runningSince: now,
  };
  requests.delete(character.id);
  stores.characters.save();
  return character.travel;
}

// ДМ: «дійшли тільки сюди» — пауза (можна продовжити).
export function pauseTravel(characterId, now = Date.now()) {
  const c = getCharacter(characterId);
  if (!c.travel) throw new GameError('Персонаж не в дорозі');
  if (!c.travel.runningSince) throw new GameError('Подорож уже на паузі');
  c.travel.elapsedMs = elapsedOf(c.travel, now);
  c.travel.runningSince = null;
  stores.characters.save();
  return c;
}

export function resumeTravel(characterId, now = Date.now()) {
  const c = getCharacter(characterId);
  if (!c.travel) throw new GameError('Персонаж не в дорозі');
  if (c.travel.runningSince) throw new GameError('Подорож і так триває');
  c.travel.runningSince = now;
  stores.characters.save();
  return c;
}

// Скасувати подорож: персонаж лишається там, де зараз.
export function cancelTravel(character, now = Date.now()) {
  if (!character.travel) return false;
  Object.assign(character, currentPosition(character, now));
  character.x = Math.round(character.x);
  character.y = Math.round(character.y);
  character.travel = null;
  stores.characters.save();
  return true;
}

export function cancelTravelById(characterId, now = Date.now()) {
  const c = getCharacter(characterId);
  if (!cancelTravel(c, now)) throw new GameError('Персонаж не в дорозі');
  return c;
}

// Перевірка прибуття: хто дійшов — стає в кінцеву точку. Повертає тих, хто прибув.
export function tickTravel(now = Date.now()) {
  const arrived = [];
  for (const c of stores.characters.data.characters) {
    const t = c.travel;
    if (!t || !t.runningSince || elapsedOf(t, now) < t.durationMs) continue;
    const end = t.path[t.path.length - 1];
    c.x = Math.round(end[0]);
    c.y = Math.round(end[1]);
    c.travel = null;
    arrived.push({ character: c, destinationName: t.destinationName });
  }
  if (arrived.length) stores.characters.save();
  return arrived;
}

// Для клієнта: подорож без зайвого (клієнт сам рахує позицію за часом).
export function toPublicTravel(t, now = Date.now()) {
  if (!t) return null;
  return {
    destinationId: t.destinationId,
    destinationName: t.destinationName,
    path: t.path,
    length: t.length,
    durationMs: t.durationMs,
    elapsedMs: elapsedOf(t, now),
    running: !!t.runningSince,
  };
}

// ---------- Дозвіл ДМ ----------

export const isApprovalRequired = () => !!settings().travelApproval;

export function setApprovalRequired(value) {
  settings().travelApproval = !!value;
  stores.worldSettings.save();
}

// Гравець хоче йти: або одразу, або запит до ДМ. Повертає { started } або { requested }.
export function playerTravel(user, destinationId, now = Date.now()) {
  if (!user.activeCharacterId) throw new GameError('Спершу виберіть персонажа');
  const c = getCharacter(user.activeCharacterId);
  if (c.status !== CHARACTER_STATUS.APPROVED) throw new GameError('Персонаж ще не підтверджений');
  const dest = findLocation(destinationId);
  if (!dest) throw new GameError('Локацію не знайдено');
  const here = currentPosition(c, now);
  if (!c.travel && dist([here.x, here.y], [dest.x, dest.y]) <= AT_LOCATION_PX) throw new GameError(`Ви вже в «${dest.name}»`);
  // Перевіряємо, що дорога існує, ще до запиту.
  if (!findRoute(here, destinationId)) throw new GameError(`Немає дороги до «${dest.name}»`);

  if (isApprovalRequired()) {
    requests.set(c.id, { characterId: c.id, destinationId, requestedAt: now });
    return { requested: true, character: c, destination: dest };
  }
  startTravel(c, destinationId, now);
  return { started: true, character: c, destination: dest };
}

export function listRequests() {
  return [...requests.values()]
    .map((r) => {
      const c = findCharacter(r.characterId);
      const dest = findLocation(r.destinationId);
      return c && dest ? { characterId: c.id, characterName: c.name, destinationId: dest.id, destinationName: dest.name, requestedAt: r.requestedAt } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.requestedAt - b.requestedAt);
}

export function hasRequest(characterId) {
  return requests.has(characterId);
}

export function approveRequest(characterId, now = Date.now()) {
  const r = requests.get(characterId);
  if (!r) throw new GameError('Запиту нема');
  const c = getCharacter(characterId);
  startTravel(c, r.destinationId, now);
  return c;
}

export function rejectRequest(characterId) {
  if (!requests.delete(characterId)) throw new GameError('Запиту нема');
}

export function cancelRequest(characterId) {
  return requests.delete(characterId);
}
