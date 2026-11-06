// Реєстрація, вхід, вихід і відновлення входу за токеном.
import crypto from 'node:crypto';
import { stores } from '../storage/index.js';
import { verifyPassword } from './passwords.js';
import { createUser, findUserById, findUserByLogin, toPublicUser } from './users.js';

const LOGIN_RE = /^[\p{L}\p{N}_-]{3,20}$/u;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 100;

// Помилка, текст якої можна показати гравцю.
export class AuthError extends Error {}

const sessions = () => stores.sessions.data.sessions;
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function validate(login, password) {
  if (typeof login !== 'string' || !LOGIN_RE.test(login.trim())) {
    throw new AuthError('Логін: 3–20 символів, лише літери, цифри, _ або -');
  }
  if (typeof password !== 'string' || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    throw new AuthError(`Пароль: щонайменше ${PASSWORD_MIN} символів`);
  }
}

function openSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions()[hashToken(token)] = { userId: user.id, createdAt: new Date().toISOString() };
  stores.sessions.save();
  return { token, user: toPublicUser(user) };
}

export function register(login, password) {
  validate(login, password);
  if (findUserByLogin(login)) throw new AuthError('Такий логін уже зайнятий');
  return openSession(createUser(login, password));
}

export function login(login, password) {
  if (typeof login !== 'string' || typeof password !== 'string') {
    throw new AuthError('Невірний логін або пароль');
  }
  const user = findUserByLogin(login);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new AuthError('Невірний логін або пароль');
  }
  return openSession(user);
}

// Повернути акаунт за збереженим токеном (після оновлення сторінки).
export function resume(token) {
  if (typeof token !== 'string') throw new AuthError('Сесія недійсна');
  const session = sessions()[hashToken(token)];
  const user = session && findUserById(session.userId);
  if (!user) throw new AuthError('Сесія недійсна, увійдіть знову');
  return toPublicUser(user);
}

export function logout(token) {
  if (typeof token !== 'string') return;
  delete sessions()[hashToken(token)];
  stores.sessions.save();
}
