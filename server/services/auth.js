// Реєстрація, вхід, вихід і відновлення входу за токеном.
import crypto from 'node:crypto';
import { stores } from '../storage/index.js';
import { GameError } from './errors.js';
import { verifyPassword } from './passwords.js';
import { STATUS, createUser, findUserById, findUserByLogin, toPublicUser } from './users.js';

const LOGIN_RE = /^[\p{L}\p{N}_-]{3,20}$/u;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 100;

const sessions = () => stores.sessions.data.sessions;
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function validate(login, password) {
  if (typeof login !== 'string' || !LOGIN_RE.test(login.trim())) {
    throw new GameError('Логін: 3–20 символів, лише літери, цифри, _ або -');
  }
  if (typeof password !== 'string' || password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    throw new GameError(`Пароль: щонайменше ${PASSWORD_MIN} символів`);
  }
}

function assertNotBlocked(user) {
  if (user.status === STATUS.BLOCKED) throw new GameError('Ваш акаунт заблоковано майстром');
}

function openSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions()[hashToken(token)] = { userId: user.id, createdAt: new Date().toISOString() };
  stores.sessions.save();
  return { token, user: toPublicUser(user) };
}

export function register(login, password) {
  validate(login, password);
  if (findUserByLogin(login)) throw new GameError('Такий логін уже зайнятий');
  return openSession(createUser(login, password));
}

export function login(login, password) {
  if (typeof login !== 'string' || typeof password !== 'string') {
    throw new GameError('Невірний логін або пароль');
  }
  const user = findUserByLogin(login);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new GameError('Невірний логін або пароль');
  }
  assertNotBlocked(user);
  return openSession(user);
}

// Повернути акаунт за збереженим токеном (після оновлення сторінки).
export function resume(token) {
  if (typeof token !== 'string') throw new GameError('Сесія недійсна');
  const session = sessions()[hashToken(token)];
  const user = session && findUserById(session.userId);
  if (!user) throw new GameError('Сесія недійсна, увійдіть знову');
  assertNotBlocked(user);
  return toPublicUser(user);
}

export function logout(token) {
  if (typeof token !== 'string') return;
  delete sessions()[hashToken(token)];
  stores.sessions.save();
}

// Скасувати всі входи акаунта (при блокуванні чи видаленні).
export function revokeUserSessions(userId) {
  const all = sessions();
  for (const [key, session] of Object.entries(all)) {
    if (session.userId === userId) delete all[key];
  }
  stores.sessions.save();
}
