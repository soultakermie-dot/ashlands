// Стан входу: хто зараз увійшов. Токен зберігається в браузері, щоб не логінитись щоразу.
import { request } from '../net/request.js';

const TOKEN_KEY = 'ashlands.token';
const listeners = new Set();

let currentUser = null;

function readToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function writeToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* сховище недоступне: просто доведеться входити знову */ }
}

function setUser(user) {
  currentUser = user;
  for (const fn of listeners) fn(currentUser);
}

async function signIn(event, payload) {
  const res = await request(event, payload);
  if (res.ok) {
    writeToken(res.token);
    setUser(res.user);
  }
  return res;
}

export const session = {
  get user() { return currentUser; },

  // Підписатися на зміну користувача (вхід / вихід).
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  register: (login, password) => signIn('auth:register', { login, password }),
  login: (login, password) => signIn('auth:login', { login, password }),

  // Відновити вхід за збереженим токеном. Повертає true, якщо вдалося.
  async resume() {
    const token = readToken();
    if (!token) {
      setUser(null);
      return false;
    }
    const res = await request('auth:resume', { token });
    if (res.ok) {
      setUser(res.user);
      return true;
    }
    // Мережева помилка — токен не чіпаємо; недійсний токен — прибираємо.
    if (res.error && !res.error.startsWith('Сервер не відповідає')) writeToken(null);
    setUser(null);
    return false;
  },

  async logout() {
    await request('auth:logout');
    writeToken(null);
    setUser(null);
  },
};
