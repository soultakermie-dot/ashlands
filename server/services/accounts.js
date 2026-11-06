// «Вхід у гру» з боку ДМ: хто проситься, хто в грі, примітки.
import { GameError } from './errors.js';
import { admit, isAdmitted, isAway, listAdmittedIds, revoke } from './admission.js';
import { revokeUserSessions } from './auth.js';
import { NOTE_MAX, ROLES, findUserById, isNewPlayer, markFirstAdmission, setDmNote } from './users.js';

const toLobbyEntry = (user, online) => ({
  id: user.id,
  login: user.login,
  isNew: isNewPlayer(user),
  note: user.dmNote ?? '',
  online,
});

// Що бачить ДМ. onlineIds — гравці, які зараз на зв'язку.
export function buildLobby(onlineIds) {
  const players = [...onlineIds]
    .map(findUserById)
    .filter((u) => u?.role === ROLES.PLAYER);

  const waiting = players
    .filter((u) => !isAdmitted(u.id))
    .map((u) => toLobbyEntry(u, true));

  const inGame = listAdmittedIds()
    .map(findUserById)
    .filter((u) => u?.role === ROLES.PLAYER)
    .map((u) => toLobbyEntry(u, !isAway(u.id)))
    .sort((a, b) => a.login.localeCompare(b.login));

  return { waiting, inGame };
}

function getPlayer(userId) {
  const user = typeof userId === 'string' ? findUserById(userId) : null;
  if (!user) throw new GameError('Гравця не знайдено');
  if (user.role !== ROLES.PLAYER) throw new GameError('Цю дію не можна застосувати до ДМ');
  return user;
}

// Пустити в гру.
export function letIn(userId) {
  const user = getPlayer(userId);
  admit(user.id);
  markFirstAdmission(user);
  return user;
}

// Не пускати / вигнати: знімаємо допуск і вхід — гравець повертається на екран входу. Дані лишаються.
export function sendToLogin(userId) {
  const user = getPlayer(userId);
  revoke(user.id);
  revokeUserSessions(user.id);
  return user;
}

export function updateNote(userId, note) {
  const user = getPlayer(userId);
  if (typeof note !== 'string') throw new GameError('Примітка має бути текстом');
  if (note.length > NOTE_MAX) throw new GameError(`Примітка: до ${NOTE_MAX} символів`);
  setDmNote(user, note);
}
