// Стан входу: хто зараз увійшов. Токен зберігається в браузері, щоб не логінитись щоразу.
import { socket } from '../net/socket.js';
import { request } from '../net/request.js';

const TOKEN_KEY = 'ashlands.token';
const listeners = new Set();

let currentUser = null;
let notice = '';

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

// Сервер повідомив, що акаунт змінився (наприклад, ДМ пустив у гру).
socket.on('auth:changed', (user) => setUser(user));

// Сервер повернув на екран входу (ДМ не пустив / вигнав / вихід з іншої вкладки).
socket.on('auth:kicked', ({ reason }) => {
  notice = reason;
  writeToken(null);
  setUser(null);
});

export const session = {
  get user() { return currentUser; },

  // Повідомлення для екрана входу (чому користувача повернуло). Читається один раз.
  takeNotice() {
    const text = notice;
    notice = '';
    return text;
  },

  // Підписатися на зміну користувача (вхід / вихід / допуск).
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  // Реєстрація лише створює акаунт — увійти треба окремо.
  register: (login, password, displayName) => request('auth:register', { login, password, displayName }),

  async login(login, password) {
    const res = await request('auth:login', { login, password });
    if (res.ok) {
      writeToken(res.token);
      setUser(res.user);
    }
    return res;
  },

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
