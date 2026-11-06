// Кубики: dice:roll { sides, count, modifier, hidden } — кинути; dice:log — останні кидки.
import { roll, rollLog } from '../../services/dice.js';
import { ROLES } from '../../services/users.js';
import { handle } from '../handle.js';
import { DM_ROOM, GAME_ROOM, requireInGame } from '../identity.js';

export function registerDice(io, socket) {
  socket.on('dice:roll', handle((payload) => {
    const user = requireInGame(socket);
    const entry = roll(user, payload);
    // Відкритий кидок — усім у грі, прихований — лише ДМ.
    io.to(entry.hidden ? DM_ROOM : GAME_ROOM).emit('dice:rolled', entry);
    console.log(`[dice] ${entry.by}${entry.character ? ` (${entry.character})` : ''}: ${entry.expr} = ${entry.total}${entry.hidden ? ' (приховано)' : ''}`);
    return { entry };
  }));

  socket.on('dice:log', handle(() => {
    const user = requireInGame(socket);
    return { log: rollLog({ forDm: user.role === ROLES.DM }) };
  }));
}
