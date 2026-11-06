// Ігровий годинник: сервер надсилає стан, далі клієнт сам рахує час.
import { socket } from '../net/socket.js';
import { request } from '../net/request.js';
import { session } from './session.js';

const listeners = new Set();
let state = null;          // { minutes, running, stopped, realMsPerGameMinute }
let receivedAt = 0;

function set(next) {
  state = next;
  receivedAt = Date.now();
  for (const fn of listeners) fn(state);
}

socket.on('clock:update', set);
session.onChange(async (user) => {
  if (!user?.admitted) return;
  const r = await request('clock:get');
  if (r.ok) set(r.clock);
});

export const clockState = {
  get state() { return state; },
  // Ігрові хвилини зараз.
  minutesNow() {
    if (!state) return null;
    return state.minutes + (state.running ? (Date.now() - receivedAt) / state.realMsPerGameMinute : 0);
  },
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  stop: () => request('clock:stop'),
  start: () => request('clock:start'),
  set: (day, hour, minute) => request('clock:set', { day, hour, minute }),
};

// Розкласти ігрові хвилини на день, години, хвилини.
export function splitTime(minutes) {
  const m = Math.floor(minutes);
  return { day: Math.floor(m / 1440) + 1, hour: Math.floor((m % 1440) / 60), minute: m % 60 };
}

// Пора доби та наскільки темно (0 — день, 1 — глуха ніч).
export function dayPhase(minutes) {
  const h = (minutes % 1440) / 60;
  if (h >= 22 || h < 4) return { icon: '🌙', name: 'ніч', dark: 1 };
  if (h < 7) return { icon: '🌅', name: 'світанок', dark: 1 - (h - 4) / 3 };
  if (h < 18) return { icon: '☀', name: 'день', dark: 0 };
  return { icon: '🌇', name: 'вечір', dark: (h - 18) / 4 };
}
