// Жетони на карті: вибраний персонаж кожного гравця, де він стоїть або куди йде.
import { stores } from '../storage/index.js';
import { CHARACTER_STATUS, findCharacter, toPublicCharacter } from './characters.js';
import { GameError } from './errors.js';
import { cancelRequest, cancelTravel, currentPosition, hasRequest, toPublicTravel } from './travel.js';
import { ROLES, listUsers } from './users.js';
import { ensurePlaced } from './placement.js';
import { isInsideMap } from './world.js';

export { ensurePlaced };

/**
 * Усі жетони на карті.
 * @param onlineIds  хто з акаунтів зараз на зв'язку
 * @param forDm      ДМ бачить ще й логін гравця
 */
export function buildTokens(onlineIds, { forDm = false } = {}, now = Date.now()) {
  const tokens = [];
  for (const user of listUsers()) {
    if (user.role !== ROLES.PLAYER || !user.activeCharacterId) continue;
    const character = findCharacter(user.activeCharacterId);
    if (!character || character.status !== CHARACTER_STATUS.APPROVED) continue;
    ensurePlaced(character);

    const { id, name, avatarUrl } = toPublicCharacter(character);
    const pos = currentPosition(character, now);
    tokens.push({
      characterId: id,
      userId: user.id,
      name,
      avatarUrl,
      x: pos.x,
      y: pos.y,
      travel: toPublicTravel(character.travel, now),
      requested: hasRequest(character.id),
      online: onlineIds.has(user.id),
      ...(forDm ? { ownerLogin: user.login } : {}),
    });
  }
  return tokens;
}

// ДМ переставляє персонажа вручну — подорож (і запит на неї) скасовується.
export function moveCharacter(characterId, x, y) {
  const character = typeof characterId === 'string' ? findCharacter(characterId) : null;
  if (!character) throw new GameError('Персонажа не знайдено');
  if (!isInsideMap(x, y)) throw new GameError('Точка за межами карти');
  character.travel = null;
  cancelRequest(character.id);
  character.x = Math.round(x);
  character.y = Math.round(y);
  stores.characters.save();
  return character;
}

export { cancelTravel };
