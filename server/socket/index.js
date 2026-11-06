// Socket.io: зв'язок з гравцями в реальному часі.
// Кожна тема (онлайн, акаунти, персонажі...) — окремий файл у handlers/.
import { Server } from 'socket.io';
import { registerPresence } from './handlers/presence.js';
import { registerServerInfo } from './handlers/serverInfo.js';
import { registerAuth } from './handlers/auth.js';
import { registerAccounts, startAwayExpiry } from './handlers/accounts.js';
import { registerCharacters } from './handlers/characters.js';
import { registerWorld } from './handlers/world.js';
import { registerTokens } from './handlers/tokens.js';
import { registerPlayers } from './handlers/players.js';
import { registerSheet } from './handlers/sheet.js';
import { registerItems } from './handlers/items.js';
import { registerInventory } from './handlers/inventory.js';
import { registerTravel, startTravelTicker } from './handlers/travel.js';
import { registerGroups, startGroupsTicker } from './handlers/groups.js';
import { registerDice } from './handlers/dice.js';
import { registerNotes } from './handlers/notes.js';
import { registerClock } from './handlers/clock.js';
import { registerDungeons, startDungeonTicker } from './handlers/dungeons.js';

const handlers = [
  registerPresence, registerServerInfo, registerAuth, registerAccounts, registerCharacters, registerWorld,
  registerTokens, registerPlayers, registerSheet, registerItems, registerInventory, registerTravel,
  registerGroups, registerDice, registerNotes, registerClock, registerDungeons,
];

// Найбільше повідомлення від клієнта (з запасом для аватарки до 512 КБ).
const MAX_MESSAGE_BYTES = 1024 * 1024;

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, { maxHttpBufferSize: MAX_MESSAGE_BYTES });

  io.on('connection', (socket) => {
    for (const register of handlers) register(io, socket);
  });

  startAwayExpiry(io);
  startTravelTicker(io);
  startGroupsTicker(io);
  startDungeonTicker(io);
  return io;
}
