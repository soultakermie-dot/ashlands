// Інвентар і золото: видача та забирання (ДМ), передача між персонажами поруч (гравці).
import crypto from 'node:crypto';
import { stores } from '../storage/index.js';
import { CHARACTER_STATUS, findCharacter } from './characters.js';
import { GameError } from './errors.js';
import { ITEM_KINDS, deleteItemRecord, findItem, getItem, toPublicItem } from './items.js';
import { ROLES, displayNameOf, findUserById, listUsers } from './users.js';
import { currentPosition } from './travel.js';
import { TRANSFER_RADIUS_M, distanceMeters } from './world.js';

// Відстань між персонажами там, де вони зараз (навіть посеред дороги).
// Хто в катакомбах — «поруч» лише зі своїм загоном у тих самих катакомбах.
const distanceNow = (a, b) => ((a.dungeon?.runId ?? null) !== (b.dungeon?.runId ?? null)
  ? null
  : distanceMeters(currentPosition(a), currentPosition(b)));

const GOLD_MAX = 1_000_000_000;
const QTY_MAX = 100_000;

const entries = () => stores.inventory.data.entries;

// ---------- Доступ ----------

export function getCharacter(id) {
  const character = typeof id === 'string' ? findCharacter(id) : null;
  if (!character) throw new GameError('Персонажа не знайдено');
  return character;
}

// Дивитися лист та інвентар може власник персонажа або ДМ.
export function assertCanView(user, character) {
  if (user.role === ROLES.DM || character.userId === user.id) return;
  throw new GameError('Це не ваш персонаж');
}

// ---------- Перегляд ----------

export function getInventory(character) {
  const list = entries()
    .filter((e) => e.characterId === character.id)
    .map((e) => {
      const item = findItem(e.itemId);
      return item && {
        id: e.id,
        quantity: e.quantity,
        customStats: e.customStats ?? null,
        item: toPublicItem(item),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.item.kind.localeCompare(b.item.kind) * -1 || a.item.name.localeCompare(b.item.name, 'uk'));
  return { characterId: character.id, gold: character.gold ?? 0, entries: list };
}

// Кількість: ціле від 1.
function cleanQty(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > QTY_MAX) throw new GameError('Кількість: ціле число від 1');
  return n;
}

function getEntry(entryId, characterId = null) {
  const entry = typeof entryId === 'string' ? entries().find((e) => e.id === entryId) : null;
  if (!entry || (characterId && entry.characterId !== characterId)) throw new GameError('Предмет в інвентарі не знайдено');
  return entry;
}

// Покласти предмет персонажу: звичайні — у стопку, особливі — кожен окремо.
function put(characterId, item, quantity, customStats = null) {
  if (item.kind === ITEM_KINDS.COMMON) {
    const stack = entries().find((e) => e.characterId === characterId && e.itemId === item.id);
    if (stack) {
      stack.quantity = Math.min(QTY_MAX, stack.quantity + quantity);
    } else {
      entries().push(newEntry(characterId, item.id, quantity, null));
    }
  } else {
    for (let i = 0; i < quantity; i++) entries().push(newEntry(characterId, item.id, 1, customStats));
  }
  stores.inventory.save();
}

function newEntry(characterId, itemId, quantity, customStats) {
  return { id: crypto.randomUUID(), characterId, itemId, quantity, customStats, createdAt: new Date().toISOString() };
}

// Забрати quantity штук із запису (якщо все — запис зникає).
function takeFrom(entry, quantity) {
  if (quantity > entry.quantity) throw new GameError(`Стільки нема: є лише ${entry.quantity}`);
  entry.quantity -= quantity;
  if (entry.quantity === 0) entries().splice(entries().indexOf(entry), 1);
  stores.inventory.save();
}

// ---------- ДМ ----------

export function giveItem(characterId, itemId, quantity) {
  const character = getCharacter(characterId);
  const item = getItem(itemId);
  put(character.id, item, cleanQty(quantity));
  return { character, item };
}

export function removeItem(entryId, quantity) {
  const entry = getEntry(entryId);
  takeFrom(entry, cleanQty(quantity));
  return entry;
}

// Свої характеристики конкретного особливого предмета (порожньо — як у бібліотеці).
export function setCustomStats(entryId, stats) {
  const entry = getEntry(entryId);
  if (findItem(entry.itemId)?.kind !== ITEM_KINDS.SPECIAL) {
    throw new GameError('Змінювати характеристики окремої копії можна лише в особливих предметів');
  }
  const clean = typeof stats === 'string' ? stats.replace(/\r\n/g, '\n').trim() : '';
  if ([...clean].length > 1000) throw new GameError('Характеристики: до 1000 символів');
  entry.customStats = clean || null;
  stores.inventory.save();
  return entry;
}

export function setGold(characterId, amount) {
  const character = getCharacter(characterId);
  const n = Number(amount);
  if (!Number.isInteger(n) || n < 0 || n > GOLD_MAX) throw new GameError('Золото: ціле число від 0');
  character.gold = n;
  stores.characters.save();
  return character;
}

export async function deleteItem(itemId) {
  getItem(itemId);
  const affected = new Set();
  const all = entries();
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i].itemId === itemId) {
      affected.add(all[i].characterId);
      all.splice(i, 1);
    }
  }
  stores.inventory.save();
  await deleteItemRecord(itemId);
  return [...affected];
}

// Персонаж видалений — його речі теж.
export function dropInventoryOf(characterId) {
  const all = entries();
  const before = all.length;
  for (let i = all.length - 1; i >= 0; i--) if (all[i].characterId === characterId) all.splice(i, 1);
  if (all.length !== before) stores.inventory.save();
}

// ---------- Передача між гравцями ----------

// Хто стоїть поруч (до TRANSFER_RADIUS_M): вибрані персонажі інших гравців на карті.
export function nearbyCharacters(character) {
  const result = [];
  for (const user of listUsers()) {
    if (user.role !== ROLES.PLAYER || user.id === character.userId || !user.activeCharacterId) continue;
    const other = findCharacter(user.activeCharacterId);
    if (!other || other.status !== CHARACTER_STATUS.APPROVED) continue;
    const d = distanceNow(character, other);
    if (d === null || d > TRANSFER_RADIUS_M) continue;
    result.push({ characterId: other.id, name: other.name, ownerName: displayNameOf(user), distance: Math.round(d) });
  }
  return result.sort((a, b) => a.distance - b.distance);
}

// Гравець передає з персонажа, за якого зараз грає.
function senderAndReceiver(user, toCharacterId) {
  if (!user.activeCharacterId) throw new GameError('Спершу виберіть персонажа');
  const from = getCharacter(user.activeCharacterId);
  const to = getCharacter(toCharacterId);
  if (to.id === from.id) throw new GameError('Не можна передати самому собі');
  const owner = findUserById(to.userId);
  if (to.status !== CHARACTER_STATUS.APPROVED || owner?.activeCharacterId !== to.id) {
    throw new GameError('Цей персонаж зараз не в грі');
  }
  const d = distanceNow(from, to);
  if (d === null || d > TRANSFER_RADIUS_M) throw new GameError(`Передати можна лише тому, хто поруч (до ${TRANSFER_RADIUS_M} м)`);
  return { from, to };
}

export function transferItem(user, toCharacterId, entryId, quantity) {
  const { from, to } = senderAndReceiver(user, toCharacterId);
  const entry = getEntry(entryId, from.id);
  const item = getItem(entry.itemId);
  const qty = cleanQty(quantity);
  const customStats = entry.customStats ?? null;
  takeFrom(entry, qty);
  put(to.id, item, qty, customStats);
  return { from, to, item, quantity: qty };
}

export function transferGold(user, toCharacterId, amount) {
  const { from, to } = senderAndReceiver(user, toCharacterId);
  const n = Number(amount);
  if (!Number.isInteger(n) || n < 1) throw new GameError('Сума: ціле число від 1');
  if (n > (from.gold ?? 0)) throw new GameError(`Стільки золота нема: є ${from.gold ?? 0}`);
  from.gold -= n;
  to.gold = Math.min(GOLD_MAX, (to.gold ?? 0) + n);
  stores.characters.save();
  return { from, to, amount: n };
}
