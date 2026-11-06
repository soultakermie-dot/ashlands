// Кубики: стрічка останніх кидків (сервер надсилає кожен новий кидок).
import { socket } from '../net/socket.js';
import { request } from '../net/request.js';
import { session } from './session.js';

const LOG_SIZE = 30;
const listeners = new Set();
let log = [];

function emit(latest = null) {
  for (const fn of listeners) fn(log, latest);
}

socket.on('dice:rolled', (entry) => {
  if (log.some((e) => e.id === entry.id)) return;
  log = [...log, entry].slice(-LOG_SIZE);
  emit(entry);
});

session.onChange(async (user) => {
  if (!user?.admitted) { log = []; emit(); return; }
  const res = await request('dice:log');
  if (res.ok) { log = res.log; emit(); }
});

export const diceState = {
  get log() { return log; },
  // fn(log, latest) — latest = щойно кинутий кубик (або null при завантаженні)
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  roll: (sides, count, modifier, hidden) => request('dice:roll', { sides, count, modifier, hidden }),
};

// «Аня (Лія): 2к20+3 = 27»
export function describeRoll(e) {
  const who = e.character ? `${e.by} (${e.character})` : e.by;
  return `${who}: ${e.expr} = ${e.total}`;
}
