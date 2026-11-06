// Усі сховища гри в одному місці. Нові (інвентар, карта) додаються сюди і в supabase/tables.js.
// Якщо в .env є ключі Supabase — дані йдуть у Supabase, інакше — у JSON-файли в папці data/.
import path from 'node:path';
import { config } from '../config.js';
import { JsonStore } from './JsonStore.js';
import { SupabaseStore } from './supabase/SupabaseStore.js';
import { createSupabaseClient } from './supabase/client.js';
import { tables } from './supabase/tables.js';

export const storageBackend = config.supabase.enabled ? 'supabase' : 'json';

const client = config.supabase.enabled ? createSupabaseClient() : null;

function makeStore(name, dependsOn = []) {
  const spec = tables[name];
  return client
    ? new SupabaseStore(client, spec, dependsOn)
    : new JsonStore(path.join(config.paths.data, `${name}.json`), spec.defaults);
}

const users = makeStore('users');

export const stores = {
  meta: makeStore('meta'),               // службова інформація
  users,                                 // акаунти: логін, роль, хеш пароля, примітка ДМ
  sessions: makeStore('sessions', [users]),     // активні входи
  admissions: makeStore('admissions', [users]), // кого ДМ пустив у гру
  characters: makeStore('characters', [users]), // персонажі гравців (з листом і золотом)
  items: makeStore('items'),             // бібліотека предметів (створює ДМ)
  locations: makeStore('locations'),     // міста й підземелля
  worldSettings: makeStore('worldSettings'), // стартова точка тощо
};

// Інвентар посилається і на персонажів, і на предмети — зберігається після них.
stores.inventory = makeStore('inventory', [stores.characters, stores.items]);
// Дорога посилається на дві локації.
stores.roads = makeStore('roads', [stores.locations]);
// Групи посилаються на персонажів.
stores.groups = makeStore('groups', [stores.characters]);

// Завантажуємо всі дані перед стартом сервера.
try {
  await Promise.all(Object.values(stores).map((s) => s.load()));
} catch (err) {
  console.error(`\n[storage] Не вдалося завантажити дані (${storageBackend}):\n  ${err.message}\n`);
  process.exit(1);
}

// Дописати все незбережене (викликається при зупинці сервера).
export async function flushAll() {
  for (const store of Object.values(stores)) {
    if (store.hasPendingSave()) await store.saveNow();
  }
}
