// Світ: карта, локації, дороги (і стартова точка — для ДМ). Сервер надсилає оновлення після кожної зміни.
import { socket } from '../net/socket.js';
import { request } from '../net/request.js';
import { session } from './session.js';

const listeners = new Set();
let world = null;

function setWorld(next) {
  world = next;
  if (world) for (const fn of listeners) fn(world);
}

socket.on('world:update', setWorld);

session.onChange(async (user) => {
  if (!user?.admitted) {
    world = null;
    return;
  }
  const res = await request('world:get');
  if (res.ok) setWorld({ map: res.map, locations: res.locations, roads: res.roads, spawn: res.spawn ?? null });
});

export const worldState = {
  get current() { return world; },
  location: (id) => world?.locations.find((l) => l.id === id) ?? null,
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  // Зміни (лише ДМ)
  createCity: (x, y) => request('world:createCity', { x, y }),
  placeDungeon: (x, y) => request('world:placeDungeon', { x, y }),
  updateLocation: (locationId, patch) => request('world:updateLocation', { locationId, ...patch }),
  deleteLocation: (locationId) => request('world:deleteLocation', { locationId }),
  createRoad: (fromId, toId) => request('world:createRoad', { fromId, toId }),
  updateRoad: (roadId, points) => request('world:updateRoad', { roadId, points }),
  deleteRoad: (roadId) => request('world:deleteRoad', { roadId }),
  setSpawn: (x, y) => request('world:setSpawn', { x, y }),
};
