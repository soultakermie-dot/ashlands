// Жетони на карті. Сервер сам надсилає оновлений список після кожної зміни.
import { socket } from '../net/socket.js';
import { request } from '../net/request.js';
import { session } from './session.js';

const listeners = new Set();
let tokens = [];

function setTokens(next) {
  tokens = next;
  for (const fn of listeners) fn(tokens);
}

socket.on('tokens:update', setTokens);

session.onChange(async (user) => {
  if (!user?.admitted) {
    setTokens([]);
    return;
  }
  const res = await request('tokens:list');
  if (res.ok) setTokens(res.tokens);
});

export const tokensState = {
  get list() { return tokens; },
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  move: (characterId, x, y) => request('tokens:move', { characterId, x, y }),
};
