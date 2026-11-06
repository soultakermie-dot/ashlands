// Жетони на карті: tokens:list (усі в грі), tokens:move (ДМ).
import { buildTokens, moveCharacter } from '../../services/tokens.js';
import { ROLES } from '../../services/users.js';
import { scheduleGameUpdate } from '../broadcast.js';
import { handle } from '../handle.js';
import { currentUser, onlineUserIds, requireDm, requireInGame } from '../identity.js';

export function registerTokens(io, socket) {
  socket.on('tokens:list', handle(() => {
    requireInGame(socket);
    const forDm = currentUser(socket).role === ROLES.DM;
    const now = Date.now();
    return { tokens: buildTokens(onlineUserIds(io), { forDm }, now), now };
  }));

  socket.on('tokens:move', handle(({ characterId, x, y }) => {
    requireDm(socket);
    moveCharacter(characterId, Number(x), Number(y));
    scheduleGameUpdate(io);
    return {};
  }));
}
