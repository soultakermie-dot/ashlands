// Керування акаунтами гравців з боку ДМ: пустити, не пустити, вигнати, повернути.
import { GameError } from './errors.js';
import { revokeUserSessions } from './auth.js';
import { ROLES, STATUS, deleteUser, findUserById, listUsers, setUserStatus, toPublicUser } from './users.js';

// Список гравців для панелі ДМ: спершу заявки, потім решта за датою.
export function listPlayers() {
  const order = { [STATUS.PENDING]: 0, [STATUS.ACTIVE]: 1, [STATUS.BLOCKED]: 2 };
  return listUsers()
    .filter((u) => u.role === ROLES.PLAYER)
    .map(toPublicUser)
    .sort((a, b) => order[a.status] - order[b.status] || a.createdAt.localeCompare(b.createdAt));
}

function getPlayer(userId) {
  const user = typeof userId === 'string' ? findUserById(userId) : null;
  if (!user) throw new GameError('Гравця не знайдено');
  if (user.role !== ROLES.PLAYER) throw new GameError('Цю дію не можна застосувати до ДМ');
  return user;
}

// Пустити в гру (нову заявку або розблокувати).
export function approve(userId) {
  const user = getPlayer(userId);
  setUserStatus(user, STATUS.ACTIVE);
  return toPublicUser(user);
}

// Не пускати: заявку видаляємо, тож людина може зареєструватися знову.
export function reject(userId) {
  const user = getPlayer(userId);
  if (user.status !== STATUS.PENDING) throw new GameError('Відхилити можна лише нову заявку');
  revokeUserSessions(user.id);
  deleteUser(user);
}

// Вигнати: акаунт блокується (дані лишаються, можна повернути).
export function block(userId) {
  const user = getPlayer(userId);
  setUserStatus(user, STATUS.BLOCKED);
  revokeUserSessions(user.id);
}
