// Приватні нотатки ДМ: назва + текст. Бачать і правлять лише ДМ.
import crypto from 'node:crypto';
import { stores } from '../storage/index.js';
import { GameError } from './errors.js';

const TITLE_MAX = 100;
const BODY_MAX = 10000;

const notes = () => stores.dmNotes.data.notes;

export function listNotes() {
  return [...notes()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function getNote(id) {
  const n = typeof id === 'string' ? notes().find((x) => x.id === id) : null;
  if (!n) throw new GameError('Нотатку не знайдено');
  return n;
}

function clean(value, max, label) {
  const text = typeof value === 'string' ? value.replace(/\r\n/g, '\n') : '';
  if ([...text].length > max) throw new GameError(`${label}: до ${max} символів`);
  return text;
}

export function createNote() {
  const now = new Date().toISOString();
  const note = { id: crypto.randomUUID(), title: '', body: '', createdAt: now, updatedAt: now };
  notes().push(note);
  stores.dmNotes.save();
  return note;
}

export function updateNote(id, { title, body }) {
  const note = getNote(id);
  if (title !== undefined) note.title = clean(title, TITLE_MAX, 'Назва').trim();
  if (body !== undefined) note.body = clean(body, BODY_MAX, 'Текст');
  note.updatedAt = new Date().toISOString();
  stores.dmNotes.save();
  return note;
}

export function deleteNote(id) {
  const note = getNote(id);
  notes().splice(notes().indexOf(note), 1);
  stores.dmNotes.save();
}
