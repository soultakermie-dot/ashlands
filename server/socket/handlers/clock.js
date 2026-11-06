// Годинник: clock:get (усі в грі); ДМ — clock:stop / clock:start, clock:set { day, hour, minute }.
import { clockState, setClockStopped, setGameTime } from '../../services/clock.js';
import { handle } from '../handle.js';
import { GAME_ROOM, requireDm, requireInGame } from '../identity.js';

export function broadcastClock(io) {
  io.to(GAME_ROOM).emit('clock:update', clockState());
}

export function registerClock(io, socket) {
  socket.on('clock:get', handle(() => { requireInGame(socket); return { clock: clockState() }; }));

  const dm = (fn) => handle((payload) => {
    requireDm(socket);
    fn(payload);
    broadcastClock(io);
    return {};
  });
  socket.on('clock:stop', dm(() => setClockStopped(true)));
  socket.on('clock:start', dm(() => setClockStopped(false)));
  socket.on('clock:set', dm((p) => setGameTime(p)));
}
