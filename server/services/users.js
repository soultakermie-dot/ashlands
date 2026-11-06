// Акаунти: пошук, створення, ролі, примітки ДМ.
import crypto from 'node:crypto';
import { stores } from '../storage/index.js';
import { GameError } from './errors.js';
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

// Ім'я або нік, яке бачать інші. Може повторюватись.
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 30;

export function cleanDisplayName(name) {
  if (typeof name !== 'string') throw new GameError('Вкажіть ім\'я або нік');
  const clean = name.normalize('NFC').trim().replace(/\s+/g, ' ');
  const length = [...clean].length;
  if (length < DISPLAY_NAME_MIN || length > DISPLAY_NAME_MAX) {
    throw new GameError(`Ім'я або нік: від ${DISPLAY_NAME_MIN} до ${DISPLAY_NAME_MAX} символів`);
  }
  if (/[\p{C}<>]/u.test(clean)) throw new GameError('Ім\'я містить недозволені символи');
  return clean;
}

// Ім'я для показу (у старих записах без імені — логін).
export const displayNameOf = (user) => user.displayName || user.login;

export function createUser(login, password, displayName, role = ROLES.PLAYER) {
  const user = {
    id: crypto.randomUUID(),
    login: normalizeLogin(login),
    displayName: cleanDisplayName(displayName),
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
