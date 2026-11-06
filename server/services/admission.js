// Допуск у гру: кого ДМ пустив у поточну сесію.
// Допуск зберігається, якщо гравець відійшов менш ніж на AWAY_LIMIT (оновив сторінку, пропав інтернет).
// Якщо довше — допуск знімається (ліміт у config.js), і гравець має проситися знову.
import { config } from '../config.js';
import { stores } from '../storage/index.js';

const AWAY_LIMIT_MS = config.admission.awayLimitMs;

// userId → { admittedAt, awaySince } (awaySince = null, поки гравець онлайн)
const admitted = () => stores.admissions.data.users;

export function isAdmitted(userId) {
  return Boolean(admitted()[userId]);
}

export function admit(userId) {
  admitted()[userId] = { admittedAt: new Date().toISOString(), awaySince: null };
  stores.admissions.save();
}

export function revoke(userId) {
  if (!admitted()[userId]) return;
  delete admitted()[userId];
  stores.admissions.save();
}

// Гравець закрив усі вкладки — починаємо відлік.
export function markAway(userId) {
  const entry = admitted()[userId];
  if (!entry || entry.awaySince) return;
  entry.awaySince = Date.now();
  stores.admissions.save();
}

// Гравець повернувся вчасно — відлік скасовується.
export function markBack(userId) {
  const entry = admitted()[userId];
  if (!entry || !entry.awaySince) return;
  entry.awaySince = null;
  stores.admissions.save();
}

export function isAway(userId) {
  return Boolean(admitted()[userId]?.awaySince);
}

export function listAdmittedIds() {
  return Object.keys(admitted());
}

// Зняти допуск з тих, хто відсутній довше ліміту. Повертає їхні id.
export function expireAway(now = Date.now()) {
  const expired = Object.entries(admitted())
    .filter(([, e]) => e.awaySince && now - e.awaySince >= AWAY_LIMIT_MS)
    .map(([id]) => id);
  for (const id of expired) delete admitted()[id];
  if (expired.length) stores.admissions.save();
  return expired;
}

// Після перезапуску сервера всі відключені: хто був допущений — починає відлік з цього моменту.
export function markAllAwayOnStartup() {
  for (const entry of Object.values(admitted())) entry.awaySince ??= Date.now();
  stores.admissions.save();
}
