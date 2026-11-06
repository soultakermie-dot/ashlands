// Мої персонажі та вибраний персонаж. Сервер сам надсилає оновлення після кожної зміни.
import { socket } from '../net/socket.js';
import { request } from '../net/request.js';
import { session } from './session.js';

const listeners = new Set();
let state = { characters: [], activeCharacterId: null };

function setState(next) {
  state = next;
  for (const fn of listeners) fn(state);
}

socket.on('characters:mine', setState);

// Коли гравця пустили в гру — завантажуємо його персонажів; вийшов — очищаємо.
session.onChange(async (user) => {
  if (!user?.admitted) {
    setState({ characters: [], activeCharacterId: null });
    return;
  }
  const res = await request('characters:mine');
  if (res.ok) setState({ characters: res.characters, activeCharacterId: res.activeCharacterId });
});

export const characters = {
  get list() { return state.characters; },
  get active() { return state.characters.find((c) => c.id === state.activeCharacterId) ?? null; },

  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  create: (name, avatar) => request('characters:create', { name, avatar }),
  remove: (characterId) => request('characters:delete', { characterId }),
  select: (characterId) => request('characters:select', { characterId }),
};
