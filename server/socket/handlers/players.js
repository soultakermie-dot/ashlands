// Панель «Гравці»: players:list — імена й статуси (онлайн / пропав / офлайн).
import { buildPlayers } from '../../services/players.js';
import { handle } from '../handle.js';
import { onlineUserIds, requireInGame } from '../identity.js';

export function registerPlayers(io, socket) {
  socket.on('players:list', handle(() => {
    requireInGame(socket);
    return { players: buildPlayers(onlineUserIds(io)) };
  }));
}
