// Сповіщення «щось змінилося в персонажа» — власнику (усім його вкладкам) і всім ДМ.
// Клієнт, у якого відкритий лист чи інвентар цього персонажа, просто перезавантажує їх.
import { findCharacter } from '../services/characters.js';
import { DM_ROOM, GAME_ROOM, userRoom } from './identity.js';

/** what: 'sheet' | 'inventory' */
export function notifyCharacter(io, characterId, what) {
  const character = findCharacter(characterId);
  if (!character) return;
  io.to([userRoom(character.userId), DM_ROOM]).emit('character:changed', { characterId, what });
}

// Змінився предмет у бібліотеці — відкриті інвентарі всіх у грі оновлюються.
export function notifyItemsChanged(io) {
  io.to(GAME_ROOM).emit('character:changed', { characterId: '*', what: 'inventory' });
}
