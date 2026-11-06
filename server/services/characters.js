// Персонажі: створення гравцем, підтвердження ДМ, вибір активного, видалення.
import crypto from 'node:crypto';
import { stores } from '../storage/index.js';
import { files } from '../storage/files.js';
import { GameError } from './errors.js';
import { readImage } from './images.js';
import { findUserById, setActiveCharacter } from './users.js';

export const CHARACTER_STATUS = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' };
const NAME_MIN = 2;
const NAME_MAX = 40;
const AVATAR_BUCKET = 'avatars';

const list = () => stores.characters.data.characters;

function cleanName(name) {
  if (typeof name !== 'string') throw new GameError('Вкажіть ім\'я персонажа');
  const clean = name.normalize('NFC').trim().replace(/\s+/g, ' ');
  const length = [...clean].length;
  if (length < NAME_MIN || length > NAME_MAX) {
    throw new GameError(`Ім'я персонажа: від ${NAME_MIN} до ${NAME_MAX} символів`);
  }
  if (/[\p{C}<>]/u.test(clean)) throw new GameError('Ім\'я містить недозволені символи');
  return clean;
}

// Те, що бачить клієнт.
export function toPublicCharacter(c) {
  return {
    id: c.id,
    userId: c.userId,
    name: c.name,
    avatarUrl: c.avatarPath ? files.urlFor(AVATAR_BUCKET, c.avatarPath) : null,
    status: c.status,
    createdAt: c.createdAt,
  };
}

export function listCharactersOf(userId) {
  return list()
    .filter((c) => c.userId === userId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function listPendingCharacters() {
  return list()
    .filter((c) => c.status === CHARACTER_STATUS.PENDING)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function findCharacter(id) {
  return list().find((c) => c.id === id) ?? null;
}

function getOwnCharacter(user, characterId) {
  const character = typeof characterId === 'string' ? findCharacter(characterId) : null;
  if (!character || character.userId !== user.id) throw new GameError('Персонажа не знайдено');
  return character;
}

// Гравець створює персонажа; він чекає на підтвердження ДМ.
export async function createCharacter(user, { name, avatar }) {
  const character = {
    id: crypto.randomUUID(),
    userId: user.id,
    name: cleanName(name),
    avatarPath: null,
    status: CHARACTER_STATUS.PENDING,
    x: null,                 // де стоїть на карті (з'явиться в стартовій точці, коли вийде на карту)
    y: null,
    sheet: {},               // лист персонажа (поля — у sheet.js)
    gold: 0,
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  };

  if (avatar) {
    const image = readImage(avatar);
    const filePath = `${user.id}/${character.id}-${crypto.randomBytes(4).toString('hex')}.${image.ext}`;
    character.avatarPath = await files.put(AVATAR_BUCKET, filePath, image.buffer, image.type);
  }

  list().push(character);
  stores.characters.save();
  return character;
}

export async function deleteCharacter(user, characterId) {
  const character = getOwnCharacter(user, characterId);
  list().splice(list().indexOf(character), 1);
  stores.characters.save();
  if (user.activeCharacterId === character.id) setActiveCharacter(user, null);
  if (character.avatarPath) await files.remove(AVATAR_BUCKET, character.avatarPath);
}

// Вибрати активного персонажа (лише підтвердженого).
export function selectCharacter(user, characterId) {
  if (characterId === null) {
    setActiveCharacter(user, null);
    return;
  }
  const character = getOwnCharacter(user, characterId);
  if (character.status !== CHARACTER_STATUS.APPROVED) {
    throw new GameError('Вибрати можна лише персонажа, якого підтвердив ДМ');
  }
  setActiveCharacter(user, character.id);
}

// ДМ: підтвердити або відхилити. Повертає персонажа.
export function reviewCharacter(characterId, approve) {
  const character = typeof characterId === 'string' ? findCharacter(characterId) : null;
  if (!character) throw new GameError('Персонажа не знайдено');
  character.status = approve ? CHARACTER_STATUS.APPROVED : CHARACTER_STATUS.REJECTED;
  character.reviewedAt = new Date().toISOString();
  stores.characters.save();

  // Відхилений персонаж не може лишатися вибраним.
  const owner = findUserById(character.userId);
  if (!approve && owner?.activeCharacterId === character.id) setActiveCharacter(owner, null);
  return character;
}

// Для панелі ДМ: персонаж разом з власником.
export function toReviewEntry(c) {
  const owner = findUserById(c.userId);
  return {
    ...toPublicCharacter(c),
    ownerLogin: owner?.login ?? '?',
    ownerName: owner ? (owner.displayName || owner.login) : '?',
    isActive: owner?.activeCharacterId === c.id,
  };
}

// ДМ: усі персонажі всіх гравців (за власником, потім за датою).
export function listAllCharacters() {
  return list()
    .map(toReviewEntry)
    .sort((a, b) => a.ownerName.localeCompare(b.ownerName, 'uk') || a.createdAt.localeCompare(b.createdAt));
}
