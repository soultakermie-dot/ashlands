// Хто сидить за підключенням, які в нього права, і в яких «кімнатах» (групах розсилки) воно.
import { isAdmitted } from '../services/admission.js';
import { GameError } from '../services/errors.js';
import { ROLES, findUserById } from '../services/users.js';

export const DM_ROOM = 'dm';      // усі ДМ
export const GAME_ROOM = 'game';  // усі, хто зараз у грі (ДМ + допущені гравці)
export const userRoom = (userId) => `user:${userId}`;

// Актуальний акаунт підключення (завжди свіжі дані, а не копія з моменту входу).
export function currentUser(socket) {
  const id = socket.data.userId;
  return id ? findUserById(id) : null;
}

// Чи може акаунт бути в грі: ДМ — завжди, гравець — якщо ДМ пустив.
export const canPlay = (user) => user.role === ROLES.DM || isAdmitted(user.id);

// Те, що користувач знає сам про себе.
export function toSelf(user) {
  return { id: user.id, login: user.login, role: user.role, admitted: canPlay(user) };
}

export function attachUser(socket, user, token) {
  detachUser(socket);
  socket.data.userId = user.id;
  socket.data.token = token;
  socket.join(userRoom(user.id));
  if (user.role === ROLES.DM) socket.join(DM_ROOM);
  if (canPlay(user)) socket.join(GAME_ROOM);
}

export function detachUser(socket) {
  if (socket.data.userId) socket.leave(userRoom(socket.data.userId));
  socket.leave(DM_ROOM);
  socket.leave(GAME_ROOM);
  socket.data.userId = null;
  socket.data.token = null;
}

// Після зміни допуску: усі вкладки акаунта заходять у «гру» або виходять з неї.
export function refreshGameRoom(io, user) {
  for (const s of io.of('/').sockets.values()) {
    if (s.data.userId !== user.id) continue;
    if (canPlay(user)) s.join(GAME_ROOM);
    else s.leave(GAME_ROOM);
  }
}

// Id усіх акаунтів, які зараз на зв'язку (крім підключення exceptSocket).
export function onlineUserIds(io, exceptSocket = null) {
  const ids = new Set();
  for (const s of io.of('/').sockets.values()) {
    if (s !== exceptSocket && s.data.userId) ids.add(s.data.userId);
  }
  return ids;
}

export function requireDm(socket) {
  const user = currentUser(socket);
  if (user?.role !== ROLES.DM) throw new GameError('Тільки для ДМ');
  return user;
}

export function requireInGame(socket) {
  const user = currentUser(socket);
  if (!user) throw new GameError('Спершу увійдіть');
  if (!canPlay(user)) throw new GameError('Майстер ще не пустив вас у гру');
  return user;
}

// Повідомити всі вкладки акаунта про зміну (наприклад, ДМ пустив у гру).
export function pushSelf(io, user) {
  io.to(userRoom(user.id)).emit('auth:changed', toSelf(user));
}

// Повернути всі вкладки акаунта на екран входу з поясненням.
export async function kickUser(io, userId, reason, exceptSocket = null) {
  for (const s of io.of('/').sockets.values()) {
    if (s.data.userId !== userId || s === exceptSocket) continue;
    s.emit('auth:kicked', { reason });
    detachUser(s);
  }
}
