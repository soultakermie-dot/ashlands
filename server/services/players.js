// Список гравців для панелі «Гравці»: ім'я та статус (без персонажів).
import { isAdmitted } from './admission.js';
import { ROLES, displayNameOf, listUsers } from './users.js';

// online — у грі й на зв'язку; away — у грі, але відключився (допуск ще діє до 10 хв); offline — не в грі.
export const PLAYER_STATUS = { ONLINE: 'online', AWAY: 'away', OFFLINE: 'offline' };

const ORDER = { online: 0, away: 1, offline: 2 };

function statusOf(user, onlineIds) {
  const online = onlineIds.has(user.id);
  if (user.role === ROLES.DM) return online ? PLAYER_STATUS.ONLINE : PLAYER_STATUS.OFFLINE;
  if (!isAdmitted(user.id)) return PLAYER_STATUS.OFFLINE;
  return online ? PLAYER_STATUS.ONLINE : PLAYER_STATUS.AWAY;
}

export function buildPlayers(onlineIds) {
  return listUsers()
    .map((u) => ({
      id: u.id,
      displayName: displayNameOf(u),
      isDm: u.role === ROLES.DM,
      status: statusOf(u, onlineIds),
    }))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status]
      || Number(b.isDm) - Number(a.isDm)
      || a.displayName.localeCompare(b.displayName, 'uk'));
}
