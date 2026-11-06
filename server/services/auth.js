// Реєстрація, вхід, вихід і відновлення входу за токеном.
import crypto from 'node:crypto';
import { stores } from '../storage/index.js';
import { GameError } from './errors.js';
import { verifyPassword } from './passwords.js';
import { createUser, findUserById, findUserByLogin, normalizeLogin } from './users.js';

// Логін: літери будь-якої мови, цифри, пробіл, апостроф і символи . _ - @
const LOGIN_MIN = 3;
const LOGIN_MAX = 30;
const LOGIN_ALLOWED_CHAR = /[\p{L}\p{M}\p{N} '._@-]/u;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 100;

const sessions = () => stores.sessions.data.sessions;
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function validate(login, password) {
  if (typeof login !== 'string') throw new GameError('Вкажіть логін');
  const clean = normalizeLogin(login);
  const length = [...clean].length;
  if (length < LOGIN_MIN || length > LOGIN_MAX) {
    throw new GameError(`Логін: від ${LOGIN_MIN} до ${LOGIN_MAX} символів (зараз ${length})`);
  }
  const bad = [...clean].find((ch) => !LOGIN_ALLOWED_CHAR.test(ch));
  if (bad) {
    throw new GameError(`Логін не може містити символ «${bad}». Можна: літери, цифри, пробіл, апостроф, . _ - @`);
  }
  if (!/[\p{L}\p{N}]/u.test(clean)) throw new GameError('Логін має містити хоча б одну літеру або цифру');
  if (typeof password !== 'string' || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    throw new GameError(`Пароль: щонайменше ${PASSWORD_MIN} символів`);
  }
}

function openSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions()[hashToken(token)] = { userId: user.id, createdAt: new Date().toISOString() };
  stores.sessions.save();
  return { token, user };
}

// Реєстрація лише створює акаунт; увійти треба окремо.
export function register(login, password, displayName) {
  validate(login, password);
  if (findUserByLogin(login)) throw new GameError('Такий логін уже зайнятий');
  return createUser(login, password, displayName);
}

export function login(login, password) {
  if (typeof login !== 'string' || typeof password !== 'string') {
    throw new GameError('Невірний логін або пароль');
  }
  const user = findUserByLogin(login);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new GameError('Невірний логін або пароль');
  }
  return openSession(user);
}

// Повернути акаунт за збереженим токеном (після оновлення сторінки).
export function resume(token) {
  if (typeof token !== 'string') throw new GameError('Сесія недійсна');
  const session = sessions()[hashToken(token)];
  const user = session && findUserById(session.userId);
  if (!user) throw new GameError('Сесія недійсна, увійдіть знову');
  return user;
}

export function logout(token) {
  if (typeof token !== 'string') return;
  delete sessions()[hashToken(token)];
  stores.sessions.save();
}

// Скасувати всі входи акаунта (коли ДМ не пустив або вигнав).
export function revokeUserSessions(userId) {
  const all = sessions();
  for (const [key, session] of Object.entries(all)) {
    if (session.userId === userId) delete all[key];
  }
  stores.sessions.save();
}
