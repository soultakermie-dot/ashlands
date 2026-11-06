// Жетони на карті. Сервер сам надсилає оновлений список після кожної зміни.
// Разом зі списком приходить серверний час — за ним клієнт рахує, де зараз мандрівники.
import { socket } from '../net/socket.js';
import { request } from '../net/request.js';
import { pointAt } from '../lib/path.js';
import { session } from './session.js';

const listeners = new Set();
let tokens = [];
let receivedAt = { server: Date.now(), client: Date.now() };

function setTokens(next, serverNow = Date.now()) {
  tokens = next;
  receivedAt = { server: serverNow, client: Date.now() };
  for (const fn of listeners) fn(tokens);
}

socket.on('tokens:update', ({ tokens: list, now }) => setTokens(list, now));

session.onChange(async (user) => {
  if (!user?.admitted) {
    setTokens([]);
    return;
  }
  const res = await request('tokens:list');
  if (res.ok) setTokens(res.tokens, res.now);
});

// Скільки мілісекунд подорожі пройдено зараз.
function elapsedNow(travel) {
  return travel.elapsedMs + (travel.running ? Date.now() - receivedAt.client : 0);
}

export const tokensState = {
  get list() { return tokens; },
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  move: (characterId, x, y) => request('tokens:move', { characterId, x, y }),

  // Де жетон зараз (для мандрівників — точка на маршруті) і скільки пройдено (0..1).
  positionOf(token) {
    const t = token.travel;
    if (!t) return { x: token.x, y: token.y, progress: null };
    const progress = t.durationMs > 0 ? Math.min(1, elapsedNow(t) / t.durationMs) : 1;
    const { point } = pointAt(t.path, progress * t.length);
    return { x: point[0], y: point[1], progress };
  },

  // Скільки мілісекунд лишилось іти.
  remainingMs(token) {
    const t = token.travel;
    return t ? Math.max(0, t.durationMs - elapsedNow(t)) : 0;
  },
};
