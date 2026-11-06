// Лист персонажа: простий «листочок» з характеристиками. Заповнює гравець, ДМ може правити будь-що.
import { stores } from '../storage/index.js';
import { GameError } from './errors.js';

// Поля листа. Клієнт отримує цей опис і будує форму сам — додати поле можна лише тут.
export const SHEET_FIELDS = [
  { key: 'class', label: 'Клас', type: 'text', max: 40, group: 'main' },
  { key: 'race', label: 'Раса', type: 'text', max: 40, group: 'main' },
  { key: 'level', label: 'Рівень', type: 'int', min: 1, max: 30, group: 'main' },
  { key: 'hpCurrent', label: 'HP зараз', type: 'int', min: -999, max: 9999, group: 'combat' },
  { key: 'hpMax', label: 'HP макс', type: 'int', min: 0, max: 9999, group: 'combat' },
  { key: 'ac', label: 'Клас броні', type: 'int', min: 0, max: 99, group: 'combat' },
  { key: 'speed', label: 'Швидкість', type: 'int', min: 0, max: 999, group: 'combat' },
  { key: 'str', label: 'СИЛ', type: 'int', min: 1, max: 30, group: 'abilities' },
  { key: 'dex', label: 'СПР', type: 'int', min: 1, max: 30, group: 'abilities' },
  { key: 'con', label: 'ВИТ', type: 'int', min: 1, max: 30, group: 'abilities' },
  { key: 'int', label: 'ІНТ', type: 'int', min: 1, max: 30, group: 'abilities' },
  { key: 'wis', label: 'МДР', type: 'int', min: 1, max: 30, group: 'abilities' },
  { key: 'cha', label: 'ХАР', type: 'int', min: 1, max: 30, group: 'abilities' },
  { key: 'skills', label: 'Навички й уміння', type: 'textarea', max: 2000, group: 'text' },
  { key: 'bio', label: 'Опис / історія', type: 'textarea', max: 4000, group: 'text' },
  { key: 'notes', label: 'Нотатки', type: 'textarea', max: 4000, group: 'text' },
];

const BY_KEY = new Map(SHEET_FIELDS.map((f) => [f.key, f]));

// Перевіряє й чистить одне поле. Порожнє значення — дозволене (поле просто не заповнене).
function cleanValue(field, value) {
  if (value === null || value === undefined || value === '') return null;
  if (field.type === 'int') {
    const n = Number(value);
    if (!Number.isInteger(n) || n < field.min || n > field.max) {
      throw new GameError(`«${field.label}»: ціле число від ${field.min} до ${field.max}`);
    }
    return n;
  }
  if (typeof value !== 'string') throw new GameError(`«${field.label}»: має бути текст`);
  const text = field.type === 'text' ? value.trim().replace(/\s+/g, ' ') : value.replace(/\r\n/g, '\n').trimEnd();
  if ([...text].length > field.max) throw new GameError(`«${field.label}»: до ${field.max} символів`);
  return text || null;
}

export function getSheet(character) {
  const sheet = {};
  for (const f of SHEET_FIELDS) sheet[f.key] = character.sheet?.[f.key] ?? null;
  return sheet;
}

// Оновити лист (лише передані поля). Невідомі поля ігноруються.
export function updateSheet(character, patch) {
  if (!patch || typeof patch !== 'object') throw new GameError('Немає даних листа');
  const next = { ...(character.sheet ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    const field = BY_KEY.get(key);
    if (!field) continue;
    const clean = cleanValue(field, value);
    if (clean === null) delete next[key];
    else next[key] = clean;
  }
  character.sheet = next;
  stores.characters.save();
  return getSheet(character);
}
