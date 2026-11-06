// Світ: карта й локації. Завантажується, коли гравця пустили в гру.
import { request } from '../net/request.js';
import { session } from './session.js';

const listeners = new Set();
let world = null;

session.onChange(async (user) => {
  if (!user?.admitted) {
    world = null;
    return;
  }
  const res = await request('world:get');
  if (!res.ok) return;
  world = { map: res.map, locations: res.locations };
  for (const fn of listeners) fn(world);
});

export const worldState = {
  get current() { return world; },
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
