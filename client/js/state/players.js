// Список гравців (ім'я + статус). Сервер сам надсилає оновлення.
import { socket } from '../net/socket.js';
import { request } from '../net/request.js';
import { session } from './session.js';

const listeners = new Set();
let players = [];

function setPlayers(next) {
  players = next;
  for (const fn of listeners) fn(players);
}

socket.on('players:update', setPlayers);

session.onChange(async (user) => {
  if (!user?.admitted) {
    setPlayers([]);
    return;
  }
  const res = await request('players:list');
  if (res.ok) setPlayers(res.players);
});

export const playersState = {
  get list() { return players; },
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
