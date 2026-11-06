// Будівельник (лише ДМ): build:scene { locationId }, build:setFolder { locationId, folder },
//   build:add { locationId, model, x, y, z, rotY, scale }, build:update { locationId, objectId, ... }, build:delete { locationId, objectId }.
// Зміни одразу бачить інший ДМ, якщо будує те саме місто.
import { addObject, deleteObject, getScene, setFolder, updateObject } from '../../services/cityScenes.js';
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

  socket.on('build:delete', handle(({ locationId, objectId }) => {
    requireDm(socket);
    deleteObject(locationId, objectId);
    share(locationId);
    return {};
  }));
}
