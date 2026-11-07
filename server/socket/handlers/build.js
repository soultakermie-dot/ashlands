// Будівельник (лише ДМ): build:scene { locationId }, build:setFolder { locationId, folder },
//   build:plant { locationId } — посадити рослини варіанта, build:add { locationId, model, x, y, z, rotY, scale }, build:update { locationId, objectId, ... }, build:delete { locationId, objectId }.
// Зміни одразу бачить інший ДМ, якщо будує те саме місто.
import { addObject, deleteObject, getScene, plantLayout, setFolder, updateObject } from '../../services/cityScenes.js';
import * as terrain from '../../services/terrain.js';
import { handle } from '../handle.js';
import { DM_ROOM, requireDm } from '../identity.js';

export function registerBuild(io, socket) {
  const share = (locationId) => socket.to(DM_ROOM).emit('build:changed', { locationId });

  socket.on('build:scene', handle(({ locationId }) => { requireDm(socket); return { scene: getScene(locationId) }; }));

  socket.on('build:setFolder', handle(({ locationId, folder }) => {
    requireDm(socket);
    setFolder(locationId, folder ?? null);
    share(locationId);
    return { scene: getScene(locationId) };
  }));

  // Посадити рослини з плану варіанта рельєфу (ще раз).
  socket.on('build:plant', handle(({ locationId }) => {
    requireDm(socket);
    const added = plantLayout(locationId);
    share(locationId);
    return { added, scene: getScene(locationId) };
  }));

  socket.on('build:add', handle(({ locationId, ...data }) => {
    requireDm(socket);
    const object = addObject(locationId, data);
    share(locationId);
    return { object };
  }));

  socket.on('build:update', handle(({ locationId, objectId, ...t }) => {
    requireDm(socket);
    const object = updateObject(locationId, objectId, t);
    share(locationId);
    return { object };
  }));

  // Земля з точок: build:terrain { locationId } → { terrain }; зміни з version → { version }.
  socket.on('build:terrain', handle(({ locationId }) => { requireDm(socket); return { terrain: terrain.getTerrain(locationId) }; }));
  const terrainOp = (event, fn) => socket.on(event, handle((p) => {
    requireDm(socket);
    const version = fn(p);
    socket.to(DM_ROOM).emit('build:terrainChanged', { locationId: p.locationId, version });
    return { version };
  }));
  terrainOp('build:terrain:heights', (p) => terrain.setHeights(p.locationId, p.version, p.indices, p.heights));
  terrainOp('build:terrain:colors', (p) => terrain.setColors(p.locationId, p.version, p.indices, p.colors));
  terrainOp('build:terrain:add', (p) => terrain.addPoints(p.locationId, p.version, p.points, p.colors));
  terrainOp('build:terrain:remove', (p) => terrain.removePoints(p.locationId, p.version, p.indices));
  terrainOp('build:terrain:resize', (p) => terrain.resize(p.locationId, p.version, p.w, p.d));
  terrainOp('build:terrain:replace', (p) => terrain.replaceTerrain(p.locationId, p.version, p));
  terrainOp('build:terrain:mode', (p) => terrain.setMode(p.locationId, p.version, p.mode));

  socket.on('build:delete', handle(({ locationId, objectId }) => {
    requireDm(socket);
    deleteObject(locationId, objectId);
    share(locationId);
    return {};
  }));
}
