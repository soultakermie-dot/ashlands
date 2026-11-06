// Катакомби: ДМ заводить персонажів у підземелля — вони зникають з карти й «блукають» тунелями
// 5–15 хв (випадково). ДМ може поставити на паузу, продовжити, випустити раніше й вибрати, де вийдуть:
//   random  — за замовчуванням: усі разом у випадковій точці біля підземелля;
//   entry   — там, де зайшли (біля входу);
//   point   — у точці, яку вибрав ДМ;
//   scatter — кожного окремо в випадкову точку в колі навколо точки ДМ (або підземелля).
// Один «похід» (run) — це всі, кого завели разом; у них спільний таймер.
import crypto from 'node:crypto';
import { config } from '../config.js';
import { stores } from '../storage/index.js';
import { CHARACTER_STATUS, findCharacter } from './characters.js';
import { GameError } from './errors.js';
import { elapsedOf, pauseTimer, resumeTimer } from './timers.js';
import { cancelRequest, cancelTravel, currentPosition, isGamePaused } from './travel.js';
import { displayNameOf, findUserById } from './users.js';
import { distanceMeters, findLocation, getWorld, isInsideMap } from './world.js';

export const EXIT_MODES = ['random', 'entry', 'point', 'scatter'];
const C = () => config.dungeons;
const characters = () => stores.characters.data.characters;

const inRun = (runId) => characters().filter((c) => c.dungeon?.runId === runId);

function getRun(runId) {
  const list = typeof runId === 'string' ? inRun(runId) : [];
  if (!list.length) throw new GameError('Цей похід у катакомби вже закінчився');
  return list;
}

// Хто з персонажів на карті стоїть біля підземелля (для вікна «Завести»).
export function charactersNear(dungeonId, now = Date.now()) {
  const d = findLocation(dungeonId);
  if (!d) return [];
  return characters()
    .filter((c) => c.status === CHARACTER_STATUS.APPROVED && !c.dungeon && findUserById(c.userId)?.activeCharacterId === c.id)
    .map((c) => ({
      characterId: c.id,
      name: c.name,
      ownerName: displayNameOf(findUserById(c.userId)),
      distance: Math.round(distanceMeters(currentPosition(c, now), d) ?? 0),
    }))
    .sort((a, b) => a.distance - b.distance);
}

// ---------- Вхід ----------

export function enterDungeon(dungeonId, characterIds, now = Date.now()) {
  const dungeon = findLocation(dungeonId);
  if (!dungeon || dungeon.type !== 'dungeon') throw new GameError('Підземелля не знайдено');
  if (!Array.isArray(characterIds) || !characterIds.length) throw new GameError('Виберіть, кого завести');
  const list = characterIds.map((id) => {
    const c = findCharacter(id);
    if (!c || c.status !== CHARACTER_STATUS.APPROVED) throw new GameError('Персонажа не знайдено');
    if (c.dungeon) throw new GameError(`«${c.name}» уже в катакомбах`);
    return c;
  });

  const { minMs, maxMs, timeScale } = C();
  const durationMs = Math.round(crypto.randomInt(minMs, maxMs + 1) * timeScale);
  const runId = crypto.randomUUID();
  const paused = isGamePaused();
  for (const c of list) {
    cancelTravel(c, now);
    cancelRequest(c.id);
    c.x = dungeon.x;
    c.y = dungeon.y;
    c.dungeon = {
      runId,
      dungeonId: dungeon.id,
      dungeonName: dungeon.name,
      entry: { x: dungeon.x, y: dungeon.y },
      durationMs,
      elapsedMs: 0,
      runningSince: paused ? null : now,
      pausedBy: paused ? 'game' : null,
      exit: { mode: 'random' },
    };
  }
  stores.characters.save();
  return { runId, dungeon, characters: list };
}

// ---------- Керування ДМ ----------

export function pauseRun(runId, now = Date.now()) {
  const list = getRun(runId);
  if (isGamePaused()) throw new GameError('Уся гра й так на паузі');
  if (!list.some((c) => pauseTimer(c.dungeon, 'dm', now))) throw new GameError('Уже на паузі');
  stores.characters.save();
}

export function resumeRun(runId, now = Date.now()) {
  const list = getRun(runId);
  if (isGamePaused()) throw new GameError('Уся гра на паузі — спершу продовжіть гру');
  if (!list.some((c) => resumeTimer(c.dungeon, 'dm', now))) throw new GameError('Похід і так триває');
  stores.characters.save();
}

// Куди вийдуть. point — { x, y } (для point / scatter), radius — радіус розкиду в пікселях карти.
export function setExit(runId, { mode, point, radius }) {
  const list = getRun(runId);
  if (!EXIT_MODES.includes(mode)) throw new GameError('Невідомий спосіб виходу');
  const exit = { mode };
  if (mode === 'point' || mode === 'scatter') {
    if (point) {
      const x = Number(point.x);
      const y = Number(point.y);
      if (!isInsideMap(x, y)) throw new GameError('Точка за межами карти');
      exit.point = { x: Math.round(x), y: Math.round(y) };
    } else if (mode === 'point') {
      throw new GameError('Виберіть точку на карті');
    }
  }
  if (mode === 'scatter') {
    const r = Number(radius ?? C().scatterRadiusPx);
    if (!Number.isFinite(r) || r < 10 || r > 2000) throw new GameError('Радіус розкиду: від 10 до 2000');
    exit.radius = Math.round(r);
  }
  for (const c of list) c.dungeon.exit = exit;
  stores.characters.save();
}

// Випадкова точка в колі (рівномірно), у межах карти.
function randomAround(center, radius) {
  const { width, height } = getWorld().map;
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    const x = Math.round(center.x + Math.cos(a) * r);
    const y = Math.round(center.y + Math.sin(a) * r);
    if (isInsideMap(x, y)) return { x, y };
  }
  return { x: Math.min(width, Math.max(0, center.x)), y: Math.min(height, Math.max(0, center.y)) };
}

// Випустити похід: кожен персонаж стає на карту за вибраним способом. Повертає учасників.
export function releaseRun(runId) {
  const list = getRun(runId);
  const { exit, entry, dungeonName } = list[0].dungeon;
  const shared = exit.mode === 'entry' ? entry
    : exit.mode === 'point' ? exit.point
      : exit.mode === 'random' ? randomAround(entry, C().exitRadiusPx)
        : null;
  for (const c of list) {
    const p = shared ?? randomAround(exit.point ?? entry, exit.radius ?? C().scatterRadiusPx);
    c.x = p.x;
    c.y = p.y;
    c.dungeon = null;
  }
  stores.characters.save();
  return { characters: list, dungeonName };
}

// Щосекунди: у кого скінчився час — виходять. Повертає [{ characters, dungeonName }].
export function tickDungeons(now = Date.now()) {
  const due = new Set();
  for (const c of characters()) {
    const d = c.dungeon;
    if (d?.runningSince && elapsedOf(d, now) >= d.durationMs) due.add(d.runId);
  }
  return [...due].map((runId) => releaseRun(runId));
}

// ---------- Для клієнта ----------

// ДМ: усі походи.
export function listRuns(now = Date.now()) {
  const runs = new Map();
  for (const c of characters()) {
    const d = c.dungeon;
    if (!d) continue;
    if (!runs.has(d.runId)) {
      runs.set(d.runId, {
        runId: d.runId,
        dungeonId: d.dungeonId,
        dungeonName: d.dungeonName,
        remainingMs: Math.max(0, d.durationMs - elapsedOf(d, now)),
        running: !!d.runningSince,
        pausedBy: d.pausedBy ?? null,
        exit: d.exit,
        characters: [],
      });
    }
    runs.get(d.runId).characters.push({ characterId: c.id, name: c.name, ownerName: displayNameOf(findUserById(c.userId)) });
  }
  return [...runs.values()];
}

// Гравець: де його персонаж (без часу — гравці не знають, скільки ще йти).
export function dungeonStateOf(character) {
  const d = character?.dungeon;
  return d ? { dungeonName: d.dungeonName, running: !!d.runningSince, pausedBy: d.pausedBy ?? null } : null;
}
