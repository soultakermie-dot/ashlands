// Лист персонажа: sheet:get / sheet:update (власник або ДМ).
import { assertCanView, getCharacter } from '../../services/inventory.js';
import { SHEET_FIELDS, getSheet, updateSheet } from '../../services/sheet.js';
import { handle } from '../handle.js';
import { requireInGame } from '../identity.js';
import { notifyCharacter } from '../notify.js';

export function registerSheet(io, socket) {
  socket.on('sheet:get', handle(({ characterId }) => {
    const user = requireInGame(socket);
    const character = getCharacter(characterId);
    assertCanView(user, character);
    return { fields: SHEET_FIELDS, sheet: getSheet(character) };
  }));

  socket.on('sheet:update', handle(({ characterId, sheet }) => {
    const user = requireInGame(socket);
    const character = getCharacter(characterId);
    assertCanView(user, character);
    const saved = updateSheet(character, sheet);
    notifyCharacter(io, character.id, 'sheet');
    return { sheet: saved };
  }));
}
