// Світ: world:get — карта й локації (для всіх, кого пустили в гру).
import { getWorld } from '../../services/world.js';
import { handle } from '../handle.js';
import { requireInGame } from '../identity.js';

export function registerWorld(io, socket) {
  socket.on('world:get', handle(() => {
    requireInGame(socket);
    return getWorld();
  }));
}
