// Катакомби (лише ДМ): dungeon:near { dungeonId }, dungeon:enter { dungeonId, characterIds },
//   dungeon:pause / dungeon:resume / dungeon:release { runId }, dungeon:exit { runId, mode, point, radius }.
import { charactersNear, enterDungeon, pauseRun, releaseRun, resumeRun, setExit, tickDungeons } from '../../services/dungeons.js';
import { scheduleGameUpdate } from '../broadcast.js';
import { handle } from '../handle.js';
import { requireDm, userRoom } from '../identity.js';

const TICK_MS = 1000;

function announceExit(io, { characters, dungeonName }) {
  for (const c of characters) {
    io.to(userRoom(c.userId)).emit('dungeon:exited', { characterId: c.id, dungeonName });
  }
  console.log(`[dungeon] з «${dungeonName}» вийшли: ${characters.map((c) => c.name).join(', ')}`);
}

export function startDungeonTicker(io) {
  setInterval(() => {
    const done = tickDungeons();
    if (!done.length) return;
    for (const r of done) announceExit(io, r);
    scheduleGameUpdate(io);
  }, TICK_MS).unref();
}

export function registerDungeons(io, socket) {
  const dm = (fn) => handle(async (payload) => {
    const user = requireDm(socket);
    const result = await fn(payload, user);
    scheduleGameUpdate(io);
    return result ?? {};
  });

  socket.on('dungeon:near', handle(({ dungeonId }) => { requireDm(socket); return { characters: charactersNear(dungeonId) }; }));

  socket.on('dungeon:enter', dm(({ dungeonId, characterIds }, user) => {
    const { dungeon, characters } = enterDungeon(dungeonId, characterIds);
    console.log(`[dungeon] ${user.login} завів у «${dungeon.name}»: ${characters.map((c) => c.name).join(', ')}`);
    for (const c of characters) io.to(userRoom(c.userId)).emit('dungeon:entered', { characterId: c.id, dungeonName: dungeon.name });
  }));

  socket.on('dungeon:pause', dm(({ runId }) => { pauseRun(runId); }));
  socket.on('dungeon:resume', dm(({ runId }) => { resumeRun(runId); }));
  socket.on('dungeon:exit', dm(({ runId, mode, point, radius }) => { setExit(runId, { mode, point, radius }); }));
  socket.on('dungeon:release', dm(({ runId }) => { announceExit(io, releaseRun(runId)); }));
}
