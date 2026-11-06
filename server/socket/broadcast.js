// Розсилка стану гри всім, хто в грі: жетони на карті, список гравців, а ДМ — ще й усі персонажі.
// Кілька змін поспіль (вхід, вибір персонажа, допуск...) зливаються в одну розсилку.
import { listAllCharacters } from '../services/characters.js';
import { buildPlayers } from '../services/players.js';
import { buildTokens } from '../services/tokens.js';
import { isApprovalRequired, isGamePaused, listRequests } from '../services/travel.js';
import { groupOf, inviteFor, listGroups, toPublicGroup } from '../services/groups.js';
import { findUserById } from '../services/users.js';
import { DM_ROOM, GAME_ROOM, onlineUserIds, userRoom } from './identity.js';

const BATCH_MS = 50;
let timer = null;

export function scheduleGameUpdate(io) {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    const online = onlineUserIds(io);
    const players = buildPlayers(online);
    const now = Date.now();

    io.to(GAME_ROOM).except(DM_ROOM).emit('tokens:update', { tokens: buildTokens(online, {}, now), now });
    io.to(GAME_ROOM).emit('players:update', players);
    io.to(GAME_ROOM).emit('travel:settings', { approvalRequired: isApprovalRequired(), gamePaused: isGamePaused() });

    // Кожному гравцю онлайн — його група та запрошення.
    for (const userId of online) {
      const user = findUserById(userId);
      const charId = user?.activeCharacterId;
      if (!charId) continue;
      const g = groupOf(charId);
      io.to(userRoom(userId)).emit('groups:state', { group: g ? toPublicGroup(g) : null, invite: inviteFor(charId, now) });
    }

    io.to(DM_ROOM).emit('tokens:update', { tokens: buildTokens(online, { forDm: true }, now), now });
    io.to(DM_ROOM).emit('characters:all', listAllCharacters());
    io.to(DM_ROOM).emit('travel:requests', listRequests());
    io.to(DM_ROOM).emit('groups:all', listGroups({ forDm: true }));
  }, BATCH_MS);
}
