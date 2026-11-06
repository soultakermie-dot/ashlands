// Подорожі.
//   Гравець: travel:go { locationId } — іти (або попросити ДМ), travel:stop — зупинитися / скасувати запит.
//   ДМ: travel:pause / travel:resume / travel:cancel { characterId }, travel:approve / travel:reject { characterId },
//       travel:setApproval { required }, travel:send { characterId, locationId } — відправити будь-кого.
import { config } from '../../config.js';
import { findCharacter } from '../../services/characters.js';
import { GameError } from '../../services/errors.js';
import {
  approveRequest, cancelRequest, cancelTravel, cancelTravelById, pauseTravel, playerTravel,
  pauseGame, rejectRequest, resumeGame, resumeTravel, setApprovalRequired, startTravel, tickTravel,
} from '../../services/travel.js';
import { groupOf } from '../../services/groups.js';
import { broadcastClock } from './clock.js';
import { scheduleGameUpdate } from '../broadcast.js';
import { handle } from '../handle.js';
import { requireDm, requireInGame, userRoom } from '../identity.js';

const TICK_MS = 1000;

// Раз на секунду перевіряємо, хто вже дійшов.
export function startTravelTicker(io) {
  setInterval(() => {
    const arrived = tickTravel();
    if (!arrived.length) return;
    for (const { character, destinationName } of arrived) {
      console.log(`[travel] ${character.name} прибув до «${destinationName}»`);
      io.to(userRoom(character.userId)).emit('travel:arrived', { characterId: character.id, destinationName });
    }
    scheduleGameUpdate(io);
  }, TICK_MS).unref();
}

export function registerTravel(io, socket) {
  const done = () => { scheduleGameUpdate(io); return {}; };

  socket.on('travel:go', handle(({ locationId }) => {
    const user = requireInGame(socket);
    const r = playerTravel(user, locationId);
    console.log(`[travel] ${r.character.name} ${r.started ? 'вирушив' : 'просить дозволу йти'} до «${r.destination.name}»`);
    scheduleGameUpdate(io);
    return { started: !!r.started, requested: !!r.requested };
  }));

  // Гравець зупиняється сам (або скасовує свій запит).
  socket.on('travel:stop', handle(() => {
    const user = requireInGame(socket);
    const c = user.activeCharacterId && findCharacter(user.activeCharacterId);
    if (!c) throw new GameError('Спершу виберіть персонажа');
    const hadRequest = cancelRequest(c.id);
    if (!cancelTravel(c) && !hadRequest) throw new GameError('Ви й так нікуди не йдете');
    return done();
  }));

  // ---------- ДМ ----------
  // Окремого учасника групи ДМ не зупиняє — лише всю групу (groups:pause).
  const notInGroup = (characterId) => {
    if (groupOf(characterId)) throw new GameError('Персонаж у групі — зупинити можна лише всю групу');
  };
  socket.on('travel:pause', handle(({ characterId }) => { requireDm(socket); notInGroup(characterId); pauseTravel(characterId); return done(); }));
  socket.on('travel:resume', handle(({ characterId }) => { requireDm(socket); notInGroup(characterId); resumeTravel(characterId); return done(); }));

  socket.on('travel:pauseGame', handle(() => { const dm = requireDm(socket); pauseGame(); broadcastClock(io); console.log(`[travel] ${dm.login}: ПАУЗА гри`); return done(); }));
  socket.on('travel:resumeGame', handle(() => { const dm = requireDm(socket); resumeGame(); broadcastClock(io); console.log(`[travel] ${dm.login}: гра продовжується`); return done(); }));
  socket.on('travel:cancel', handle(({ characterId }) => { requireDm(socket); cancelTravelById(characterId); return done(); }));
  socket.on('travel:approve', handle(({ characterId }) => { requireDm(socket); approveRequest(characterId); return done(); }));
  socket.on('travel:reject', handle(({ characterId }) => { requireDm(socket); rejectRequest(characterId); return done(); }));

  socket.on('travel:send', handle(({ characterId, locationId }) => {
    requireDm(socket);
    const c = findCharacter(characterId);
    if (!c) throw new GameError('Персонажа не знайдено');
    startTravel(c, locationId);
    return done();
  }));

  socket.on('travel:setApproval', handle(({ required }) => {
    const dm = requireDm(socket);
    setApprovalRequired(required);
    console.log(`[travel] ${dm.login}: рух гравців — ${required ? 'з дозволом ДМ' : 'вільний'}`);
    return done();
  }));
}

export const travelTimeScale = config.travel.timeScale;
