// Усі сховища гри в одному місці. Нові (акаунти, персонажі, карта) додаються сюди.
import path from 'node:path';
import { config } from '../config.js';
import { JsonStore } from './JsonStore.js';

const file = (name) => path.join(config.paths.data, `${name}.json`);

export const stores = {
  // Службова інформація про сервер.
  meta: new JsonStore(file('meta'), { launches: 0, firstLaunchAt: null, lastLaunchAt: null }),
};

// Дописати на диск усе незбережене (викликається при зупинці сервера).
export function flushAll() {
  for (const store of Object.values(stores)) {
    if (store.hasPendingSave()) store.saveNow();
  }
}
