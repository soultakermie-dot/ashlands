// Кубики: кинути к4…к100 (1–10 штук) з модифікатором. Відкриті кидки бачать усі в грі,
// приховані (лише ДМ) — тільки ДМ. Останні кидки зберігаються в пам'яті сервера.
import crypto from 'node:crypto';
import { findCharacter } from './characters.js';
import { GameError } from './errors.js';
import { ROLES, displayNameOf } from './users.js';

export const DICE = [4, 6, 8, 10, 12, 20, 100];
const MAX_COUNT = 10;
const MAX_MODIFIER = 100;
const LOG_SIZE = 30;

const log = [];

// Чесний випадковий кидок 1..sides.
const rollDie = (sides) => crypto.randomInt(1, sides + 1);

export function roll(user, { sides, count = 1, modifier = 0, hidden = false }) {
  const s = Number(sides);
  const n = Number(count);
  const m = Number(modifier);
  if (!DICE.includes(s)) throw new GameError('Такого кубика нема');
  if (!Number.isInteger(n) || n < 1 || n > MAX_COUNT) throw new GameError(`Кількість кубиків: від 1 до ${MAX_COUNT}`);
  if (!Number.isInteger(m) || Math.abs(m) > MAX_MODIFIER) throw new GameError(`Модифікатор: від −${MAX_MODIFIER} до +${MAX_MODIFIER}`);

  const isDm = user.role === ROLES.DM;
  if (hidden && !isDm) throw new GameError('Приховано кидати може лише ДМ');
  const character = !isDm && user.activeCharacterId ? findCharacter(user.activeCharacterId) : null;

  const rolls = Array.from({ length: n }, () => rollDie(s));
  const total = rolls.reduce((a, b) => a + b, 0) + m;
  const entry = {
    id: crypto.randomUUID(),
    by: isDm ? 'Майстер' : displayNameOf(user),
    character: character?.name ?? null,
    isDm,
    hidden: !!hidden,
    expr: `${n}к${s}${m > 0 ? `+${m}` : m < 0 ? `−${-m}` : ''}`,
    rolls,
    modifier: m,
    total,
    // Особливі результати к20: 20 — критичний успіх, 1 — провал (лише для одного к20).
    crit: s === 20 && n === 1 ? (rolls[0] === 20 ? 'success' : rolls[0] === 1 ? 'fail' : null) : null,
    at: Date.now(),
  };
  log.push(entry);
  if (log.length > LOG_SIZE) log.shift();
  return entry;
}

// Стрічка кидків: ДМ бачить усе, гравці — лише відкриті.
export function rollLog({ forDm = false } = {}) {
  return log.filter((e) => forDm || !e.hidden);
}
