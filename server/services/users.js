// Акаунти: пошук, створення, ролі.
import crypto from 'node:crypto';
import { stores } from '../storage/index.js';
import { hashPassword } from './passwords.js';

export const ROLES = { PLAYER: 'player', DM: 'dm' };

const list = () => stores.users.data.users;

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
    createdAt: new Date().toISOString(),
  };
  list().push(user);
  stores.users.save();
  return user;
}

export function setUserRole(user, role) {
  user.role = role;
  stores.users.save();
}

// Те, що можна показувати в інтерфейсі (без хеша пароля).
export function toPublicUser(user) {
  return { id: user.id, login: user.login, role: user.role };
}
