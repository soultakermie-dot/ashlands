// Хто сидить за підключенням, і в яких «кімнатах» (групах розсилки) воно.
import { GameError } from '../services/errors.js';
import { ROLES, STATUS, findUserById, toPublicUser } from '../services/users.js';

export const DM_ROOM = 'dm';
export const userRoom = (userId) => `user:${userId}`;

// Актуальний акаунт підключення (завжди свіжі дані, а не копія з моменту входу).
export function currentUser(socket) {
  const id = socket.data.userId;
  return id ? findUserById(id) : null;
}

export function attachUser(socket, user, token) {
  detachUser(socket);
  socket.data.userId = user.id;
  socket.data.token = token;
  socket.join(userRoom(user.id));
  if (user.role === ROLES.DM) socket.join(DM_ROOM);
}

export function detachUser(socket) {
  if (socket.data.userId) socket.leave(userRoom(socket.data.userId));
  socket.leave(DM_ROOM);
  socket.data.userId = null;
  socket.data.token = null;
}

export function requireDm(socket) {
  const user = currentUser(socket);
  if (user?.role !== ROLES.DM) throw new GameError('Тільки для ДМ');
  return user;
}

export function requireActive(socket) {
  const user = currentUser(socket);
  if (!user) throw new GameError('Спершу увійдіть');
  if (user.status !== STATUS.ACTIVE) throw new GameError('Акаунт ще не підтверджено майстром');
  return user;
}

// Повідомити всі вкладки акаунта про зміну (наприклад, ДМ пустив у гру).
export function pushUserUpdate(io, user) {
  io.to(userRoom(user.id)).emit('auth:changed', toPublicUser(user));
}

// Викинути всі вкладки акаунта з гри з поясненням.
export async function kickUser(io, userId, reason) {
  const sockets = await io.in(userRoom(userId)).fetchSockets();
  for (const s of sockets) {
    s.emit('auth:kicked', { reason });
    const local = io.of('/').sockets.get(s.id);
    if (local) detachUser(local);
  }
}
