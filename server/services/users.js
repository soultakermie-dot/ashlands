// Акаунти: пошук, створення, ролі, примітки ДМ.
import crypto from 'node:crypto';
import { stores } from '../storage/index.js';
import { hashPassword } from './passwords.js';

export const ROLES = { PLAYER: 'player', DM: 'dm' };
export const NOTE_MAX = 200;

const list = () => stores.users.data.users;

export function listUsers() {
  return list();
}

// Приводимо логін до одного вигляду: прибираємо зайві пробіли, усі види апострофа → '.
export function normalizeLogin(login) {
  return login.normalize('NFC').replace(/[’ʼ`]/g, "'").trim().replace(/\s+/g, ' ');
}

// Пошук без урахування регістру й різниці в апострофах/пробілах («Мар’яна» = «мар'яна»).
export function findUserByLogin(login) {
  const key = normalizeLogin(login).toLowerCase();
  return list().find((u) => normalizeLogin(u.login).toLowerCase() === key) ?? null;
}

export function findUserById(id) {
  return list().find((u) => u.id === id) ?? null;
}

export function createUser(login, password, role = ROLES.PLAYER) {
  const user = {
    id: crypto.randomUUID(),
    login: normalizeLogin(login),
    passwordHash: hashPassword(password),
    role,
    dmNote: '',              // примітка, яку бачить і пише тільки ДМ
    firstAdmittedAt: null,   // коли ДМ вперше пустив у гру (null — «новий» гравець)
    activeCharacterId: null, // вибраний персонаж
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

export function setDmNote(user, note) {
  user.dmNote = note.trim().slice(0, NOTE_MAX);
  stores.users.save();
}

export function markFirstAdmission(user) {
  if (user.firstAdmittedAt) return;
  user.firstAdmittedAt = new Date().toISOString();
  stores.users.save();
}

export const isNewPlayer = (user) => !user.firstAdmittedAt;

export function setActiveCharacter(user, characterId) {
  user.activeCharacterId = characterId;
  stores.users.save();
}
