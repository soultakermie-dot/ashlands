// Socket.io: зв'язок з гравцями в реальному часі.
// Кожна тема (онлайн, акаунти, персонажі...) — окремий файл у handlers/.
import { Server } from 'socket.io';
import { registerPresence } from './handlers/presence.js';
import { registerServerInfo } from './handlers/serverInfo.js';
import { registerAuth } from './handlers/auth.js';

const handlers = [registerPresence, registerServerInfo, registerAuth];

export function createSocketServer(httpServer) {
  const io = new Server(httpServer);

  io.on('connection', (socket) => {
    for (const register of handlers) register(io, socket);
  });

  return io;
}
