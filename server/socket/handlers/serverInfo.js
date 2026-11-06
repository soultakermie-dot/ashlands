// Надсилає щойно підключеному гравцю інформацію про сервер.
import { getServerInfo } from '../../services/meta.js';

export function registerServerInfo(io, socket) {
  socket.emit('server:info', getServerInfo());
}
