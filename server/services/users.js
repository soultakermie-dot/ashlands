// Акаунти: пошук, створення, ролі, статуси.
import crypto from 'node:crypto';
import { stores } from '../storage/index.js';
import { hashPassword } from './passwords.js';

export const ROLES = { PLAYER: 'player', DM: 'dm' };

// pending — чекає підтвердження ДМ, active — може грати, blocked — заблокований ДМ.
export const STATUS = { PENDING: 'pending', ACTIVE: 'active', BLOCKED: 'blocked' };

const list = () => stores.users.data.users;

export function listUsers() {
  return list();
}

export function findUserByLogin(login) {
  const key = login.trim().toLowerCase();
  return list().find((u) => u.login.toLowerCase() === key) ?? null;
}

export function findUserById(id) {
  return list().find((u) => u.id === id) ?? null;
}

export function createUser(login, password, role = ROLES.PLAYER) {
  const user = {
    id: crypto.randomUUID(),
    login: login.trim(),
    passwordHash: hashPassword(password),
    role,
    status: role === ROLES.DM ? STATUS.ACTIVE : STATUS.PENDING,
    createdAt: new Date().toISOString(),
  };
  list().push(user);
  stores.users.save();
  return user;
}

export function setUserRole(user, role) {
  user.role = role;
  if (role === ROLES.DM) user.status = STATUS.ACTIVE;
  stores.users.save();
}

export function setUserStatus(user, status) {
  user.status = status;
  stores.users.save();
}

export function deleteUser(user) {
  const users = list();
  users.splice(users.indexOf(user), 1);
  stores.users.save();
}

// Те, що можна показувати в інтерфейсі (без хеша пароля).
export function toPublicUser(user) {
  return {
    id: user.id,
    login: user.login,
    role: user.role,
    status: user.status ?? STATUS.ACTIVE,
    createdAt: user.createdAt,
  };
}
