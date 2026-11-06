// Жетони на карті: tokens:list (усі в грі), tokens:move (ДМ). Розсилка змін — scheduleTokens().
import { buildTokens, moveCharacter } from '../../services/tokens.js';
import { handle } from '../handle.js';
import { DM_ROOM, GAME_ROOM, currentUser, onlineUserIds, requireDm, requireInGame } from '../identity.js';
import { ROLES } from '../../services/users.js';

const BATCH_MS = 50;
let timer = null;

// Розіслати жетони всім у грі. Кілька змін поспіль (вхід, вибір персонажа...) зливаються в одну розсилку.
export function scheduleTokens(io) {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    const online = onlineUserIds(io);
    io.to(GAME_ROOM).except(DM_ROOM).emit('tokens:update', buildTokens(online));
    io.to(DM_ROOM).emit('tokens:update', buildTokens(online, { forDm: true }));
  }, BATCH_MS);
}

export function registerTokens(io, socket) {
  socket.on('tokens:list', handle(() => {
    requireInGame(socket);
    const forDm = currentUser(socket).role === ROLES.DM;
    return { tokens: buildTokens(onlineUserIds(io), { forDm }) };
  }));

  socket.on('tokens:move', handle(({ characterId, x, y }) => {
    requireDm(socket);
    moveCharacter(characterId, Number(x), Number(y));
    scheduleTokens(io);
    return {};
  }));
}
