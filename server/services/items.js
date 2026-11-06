// Бібліотека предметів: створює, змінює й видаляє лише ДМ.
// common — звичайний (зілля, стріли…), в інвентарі складається в стопку;
// special — особливий (зброя, броня, артефакти), кожен окремо, ДМ може змінити характеристики конкретної копії.
import crypto from 'node:crypto';
import { stores } from '../storage/index.js';
import { files } from '../storage/files.js';
import { GameError } from './errors.js';
import { readImage } from './images.js';

export const ITEM_KINDS = { COMMON: 'common', SPECIAL: 'special' };
const BUCKET = 'items';

const list = () => stores.items.data.items;

export function findItem(id) {
  return typeof id === 'string' ? list().find((i) => i.id === id) ?? null : null;
}

export function getItem(id) {
  const item = findItem(id);
  if (!item) throw new GameError('Предмет не знайдено');
  return item;
}

export function toPublicItem(item) {
  return {
    id: item.id,
    name: item.name,
    kind: item.kind,
    description: item.description,
    stats: item.stats,
    imageUrl: item.imagePath ? files.urlFor(BUCKET, item.imagePath) : null,
  };
}

export function listItems() {
  return [...list()].sort((a, b) => a.name.localeCompare(b.name, 'uk')).map(toPublicItem);
}

function text(value, label, { min = 0, max }) {
  if (typeof value !== 'string') value = '';
  const clean = value.replace(/\r\n/g, '\n').trim();
  const length = [...clean].length;
  if (length < min || length > max) {
    throw new GameError(min ? `${label}: від ${min} до ${max} символів` : `${label}: до ${max} символів`);
  }
  return clean;
}

function cleanFields({ name, kind, description, stats }) {
  if (!Object.values(ITEM_KINDS).includes(kind)) throw new GameError('Виберіть тип предмета');
  return {
    name: text(name, 'Назва', { min: 2, max: 60 }).replace(/\s+/g, ' '),
    kind,
    description: text(description, 'Опис', { max: 1000 }),
    stats: text(stats, 'Характеристики', { max: 1000 }),
  };
}

async function saveImage(item, image) {
  const { buffer, type, ext } = readImage(image);
  const filePath = `${item.id}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const old = item.imagePath;
  item.imagePath = await files.put(BUCKET, filePath, buffer, type);
  if (old) await files.remove(BUCKET, old);
}

export async function createItem(data) {
  const now = new Date().toISOString();
  const item = { id: crypto.randomUUID(), ...cleanFields(data), imagePath: null, createdAt: now, updatedAt: now };
  if (data.image) await saveImage(item, data.image);
  list().push(item);
  stores.items.save();
  return item;
}

// image: нова картинка; removeImage: true — прибрати картинку.
export async function updateItem(id, data) {
  const item = getItem(id);
  const fields = cleanFields(data);
  if (data.image) await saveImage(item, data.image);
  else if (data.removeImage && item.imagePath) {
    await files.remove(BUCKET, item.imagePath);
    item.imagePath = null;
  }
  Object.assign(item, fields, { updatedAt: new Date().toISOString() });
  stores.items.save();
  return item;
}

// Видалення предмета з бібліотеки прибирає його й з усіх інвентарів (робить inventory.js).
export async function deleteItemRecord(id) {
  const item = getItem(id);
  list().splice(list().indexOf(item), 1);
  stores.items.save();
  if (item.imagePath) await files.remove(BUCKET, item.imagePath);
  return item;
}
