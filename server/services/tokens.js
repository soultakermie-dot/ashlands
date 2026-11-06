// Жетони на карті: вибраний персонаж кожного гравця і де він стоїть.
import { stores } from '../storage/index.js';
import { CHARACTER_STATUS, findCharacter, toPublicCharacter } from './characters.js';
import { GameError } from './errors.js';
import { ROLES, listUsers } from './users.js';
import { getSpawnPoint, isInsideMap } from './world.js';

// Персонаж, який ще ніде не стоїть, з'являється в стартовій точці.
export function ensurePlaced(character) {
  if (Number.isFinite(character.x) && Number.isFinite(character.y)) return;
  Object.assign(character, getSpawnPoint());
  stores.characters.save();
}

/**
 * Усі жетони на карті.
 * @param onlineIds  хто з акаунтів зараз на зв'язку
 * @param forDm      ДМ бачить ще й логін гравця
 */
export function buildTokens(onlineIds, { forDm = false } = {}) {
  const tokens = [];
  for (const user of listUsers()) {
    if (user.role !== ROLES.PLAYER || !user.activeCharacterId) continue;
    const character = findCharacter(user.activeCharacterId);
    if (!character || character.status !== CHARACTER_STATUS.APPROVED) continue;
    ensurePlaced(character);

    const { id, name, avatarUrl } = toPublicCharacter(character);
    tokens.push({
      characterId: id,
      userId: user.id,
      name,
      avatarUrl,
      x: character.x,
      y: character.y,
      online: onlineIds.has(user.id),
      ...(forDm ? { ownerLogin: user.login } : {}),
    });
  }
  return tokens;
}

// ДМ переставляє персонажа.
export function moveCharacter(characterId, x, y) {
  const character = typeof characterId === 'string' ? findCharacter(characterId) : null;
  if (!character) throw new GameError('Персонажа не знайдено');
  if (!isInsideMap(x, y)) throw new GameError('Точка за межами карти');
  character.x = Math.round(x);
  character.y = Math.round(y);
  stores.characters.save();
  return character;
}
