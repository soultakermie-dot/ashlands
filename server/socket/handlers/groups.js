// Групи.
//   Гравець: groups:invite { characterId }, groups:answer { accept }, groups:leave, groups:follow,
//            groups:voteStart, groups:vote { choice } (так/ні або characterId кандидата).
//   ДМ: groups:disband / groups:pause / groups:resume / groups:cancel { groupId },
//       groups:remove / groups:setLeader { groupId, characterId }.
import {
  answerInvite, castVote, dmCancelGroupTravel, dmDisband, dmPauseGroup, dmRemoveMember, dmResumeGroup,
  dmSetLeader, followLeader, invite, leaveGroup, startVote, tickGroups, tickVotes,
} from '../../services/groups.js';
import { findCharacter } from '../../services/characters.js';
import { scheduleGameUpdate } from '../broadcast.js';
import { handle } from '../handle.js';
import { requireDm, requireInGame, userRoom } from '../identity.js';

const TICK_MS = 1000;

// Раз на секунду: хто відстав — випадає; голосування, у яких вийшов час.
export function startGroupsTicker(io) {
  setInterval(() => {
    const dropped = tickGroups();
    for (const { character, groupName } of dropped) {
      console.log(`[groups] ${character.name} відстав і вийшов з «${groupName}»`);
      io.to(userRoom(character.userId)).emit('groups:notice', { text: `Ви відстали від групи «${groupName}» і вийшли з неї` });
    }
    const votes = tickVotes();
    if (dropped.length || votes.length) scheduleGameUpdate(io);
  }, TICK_MS).unref();
}

export function registerGroups(io, socket) {
  const done = () => { scheduleGameUpdate(io); return {}; };

  socket.on('groups:invite', handle(({ characterId }) => {
    const { from, target } = invite(requireInGame(socket), characterId);
    console.log(`[groups] ${from.name} запросив ${target.name}`);
    return done();
  }));

  socket.on('groups:answer', handle(({ accept }) => {
    const user = requireInGame(socket);
    const r = answerInvite(user, accept === true);
    if (r.declined) {
      const from = findCharacter(r.fromId);
      if (from) io.to(userRoom(from.userId)).emit('groups:notice', { text: 'Запрошення відхилили' });
    }
    return done();
  }));

  socket.on('groups:leave', handle(() => { leaveGroup(requireInGame(socket)); return done(); }));
  socket.on('groups:follow', handle(() => { followLeader(requireInGame(socket)); return done(); }));
  socket.on('groups:voteStart', handle(() => { startVote(requireInGame(socket)); return done(); }));
  socket.on('groups:vote', handle(({ choice }) => { castVote(requireInGame(socket), choice); return done(); }));

  // ---------- ДМ ----------
  socket.on('groups:disband', handle(({ groupId }) => { requireDm(socket); dmDisband(groupId); return done(); }));
  socket.on('groups:remove', handle(({ groupId, characterId }) => { requireDm(socket); dmRemoveMember(groupId, characterId); return done(); }));
  socket.on('groups:setLeader', handle(({ groupId, characterId }) => { requireDm(socket); dmSetLeader(groupId, characterId); return done(); }));
  socket.on('groups:pause', handle(({ groupId }) => { requireDm(socket); dmPauseGroup(groupId); return done(); }));
  socket.on('groups:resume', handle(({ groupId }) => { requireDm(socket); dmResumeGroup(groupId); return done(); }));
  socket.on('groups:cancel', handle(({ groupId }) => { requireDm(socket); dmCancelGroupTravel(groupId); return done(); }));
}
