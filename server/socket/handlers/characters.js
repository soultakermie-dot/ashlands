// Персонажі: characters:mine / create / delete / select (гравець), characters:pending / review (ДМ).
import {
  createCharacter, deleteCharacter, findCharacter, listAllCharacters, listCharactersOf, listPendingCharacters,
  reviewCharacter, selectCharacter, toPublicCharacter, toReviewEntry,
} from '../../services/characters.js';
import { findUserById } from '../../services/users.js';
import { handle } from '../handle.js';
import { DM_ROOM, requireDm, requireInGame, userRoom } from '../identity.js';
import { scheduleGameUpdate } from '../broadcast.js';
import { dropInventoryOf } from '../../services/inventory.js';
import { cancelRequest } from '../../services/travel.js';
import { onCharacterDeselected } from '../../services/groups.js';

// Персонажі гравця + хто вибраний.
function mineOf(user) {
  return {
    characters: listCharactersOf(user.id).map(toPublicCharacter),
    activeCharacterId: user.activeCharacterId ?? null,
  };
}

// Надіслати гравцю (усім його вкладкам) свіжий список персонажів.
function pushMine(io, userId) {
  const user = findUserById(userId);
  if (user) io.to(userRoom(userId)).emit('characters:mine', mineOf(user));
}

// Надіслати всім ДМ свіжий список персонажів, що чекають підтвердження.
function broadcastPending(io) {
  io.to(DM_ROOM).emit('characters:pending', listPendingCharacters().map(toReviewEntry));
}

export function registerCharacters(io, socket) {
  socket.on('characters:mine', handle(() => mineOf(requireInGame(socket))));

  socket.on('characters:create', handle(async ({ name, avatar }) => {
    const user = requireInGame(socket);
    const character = await createCharacter(user, { name, avatar });
    console.log(`[characters] ${user.login} створив «${character.name}» (чекає ДМ)`);
    pushMine(io, user.id);
    broadcastPending(io);
    scheduleGameUpdate(io);
    return { character: toPublicCharacter(character) };
  }));

  socket.on('characters:delete', handle(async ({ characterId }) => {
    const user = requireInGame(socket);
    const name = findCharacter(characterId)?.name;
    await deleteCharacter(user, characterId);
    dropInventoryOf(characterId);
    cancelRequest(characterId);
    onCharacterDeselected(characterId);
    console.log(`[characters] ${user.login} видалив «${name}»`);
    pushMine(io, user.id);
    broadcastPending(io);
    scheduleGameUpdate(io);
    return {};
  }));

  socket.on('characters:select', handle(({ characterId }) => {
    const user = requireInGame(socket);
    const previous = user.activeCharacterId;
    selectCharacter(user, characterId ?? null);
    if (previous && previous !== user.activeCharacterId) onCharacterDeselected(previous);
    pushMine(io, user.id);
    scheduleGameUpdate(io);
    return {};
  }));

  socket.on('characters:all', handle(() => {
    requireDm(socket);
    return { characters: listAllCharacters() };
  }));

  socket.on('characters:pending', handle(() => {
    requireDm(socket);
    return { characters: listPendingCharacters().map(toReviewEntry) };
  }));

  socket.on('characters:review', handle(({ characterId, approve }) => {
    const dm = requireDm(socket);
    const character = reviewCharacter(characterId, approve === true);
    console.log(`[characters] ${dm.login}: ${approve === true ? 'підтвердив' : 'відхилив'} «${character.name}»`);
    pushMine(io, character.userId);
    broadcastPending(io);
    scheduleGameUpdate(io);
    return {};
  }));
}
