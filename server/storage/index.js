// Усі сховища гри в одному місці. Нові (персонажі, карта) додаються сюди.
import path from 'node:path';
import { config } from '../config.js';
import { JsonStore } from './JsonStore.js';

const file = (name) => path.join(config.paths.data, `${name}.json`);

export const stores = {
  // Службова інформація про сервер.
  meta: new JsonStore(file('meta'), { launches: 0, firstLaunchAt: null, lastLaunchAt: null }),

  // Акаунти: логін, роль, хеш пароля, примітка ДМ.
  users: new JsonStore(file('users'), { users: [] }),

  // Активні входи: хеш токена → акаунт (щоб не логінитись після оновлення сторінки).
  sessions: new JsonStore(file('sessions'), { sessions: {} }),

  // Кого ДМ пустив у поточну гру.
  admissions: new JsonStore(file('admissions'), { users: {} }),
};

// Дописати на диск усе незбережене (викликається при зупинці сервера).
export function flushAll() {
  for (const store of Object.values(stores)) {
    if (store.hasPendingSave()) store.saveNow();
  }
}
