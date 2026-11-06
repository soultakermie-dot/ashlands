// Світ: world:get (усі в грі); зміни — лише ДМ:
//   творчий режим — world:createCity, world:updateLocation, world:deleteLocation,
//                    world:createRoad, world:updateRoad, world:deleteRoad, world:setSpawn;
//   гра — world:placeDungeon (гравці одразу бачать нове підземелля), прибрати — world:deleteLocation.
import {
  LOCATION_TYPES, createLocation, createRoad, deleteLocation, deleteRoad, findLocation,
  getWorld, setSpawnPoint, updateLocation, updateRoad,
} from '../../services/world.js';
import { ROLES } from '../../services/users.js';
import { handle } from '../handle.js';
import { DM_ROOM, GAME_ROOM, requireDm, requireInGame } from '../identity.js';

// Розіслати світ усім у грі (ДМ — разом зі стартовою точкою).
export function broadcastWorld(io) {
  io.to(GAME_ROOM).except(DM_ROOM).emit('world:update', getWorld());
  io.to(DM_ROOM).emit('world:update', getWorld({ forDm: true }));
}

export function registerWorld(io, socket) {
  // Обгортка для змін ДМ: перевірка прав, дія, журнал, розсилка.
  const dmChange = (fn) => handle(async (payload) => {
    const dm = requireDm(socket);
    const result = await fn(payload, dm);
    broadcastWorld(io);
    return result ?? {};
  });

  socket.on('world:get', handle(() => {
    const user = requireInGame(socket);
    return getWorld({ forDm: user.role === ROLES.DM });
  }));

  socket.on('world:createCity', dmChange(({ x, y, name }, dm) => {
    const loc = createLocation({ type: LOCATION_TYPES.CITY, name: name || 'Нове місто', x, y });
    console.log(`[world] ${dm.login} додав місто «${loc.name}»`);
    return { location: { id: loc.id } };
  }));

  socket.on('world:placeDungeon', dmChange(({ x, y, name }, dm) => {
    const loc = createLocation({ type: LOCATION_TYPES.DUNGEON, name: name || 'Підземелля', x, y });
    console.log(`[world] ${dm.login} поставив підземелля «${loc.name}»`);
    return { location: { id: loc.id } };
  }));

  socket.on('world:updateLocation', dmChange(({ locationId, name, description, x, y }) => {
    updateLocation(locationId, { name, description, x, y });
  }));

  socket.on('world:deleteLocation', dmChange(({ locationId }, dm) => {
    const name = findLocation(locationId)?.name;
    deleteLocation(locationId);
    console.log(`[world] ${dm.login} прибрав «${name}»`);
  }));

  socket.on('world:createRoad', dmChange(({ fromId, toId, points }) => {
    const road = createRoad(fromId, toId, points ?? []);
    return { road: { id: road.id } };
  }));

  socket.on('world:updateRoad', dmChange(({ roadId, points }) => { updateRoad(roadId, points); }));
  socket.on('world:deleteRoad', dmChange(({ roadId }) => { deleteRoad(roadId); }));
  socket.on('world:setSpawn', dmChange(({ x, y }) => { setSpawnPoint(x, y); }));
}
