// Групи: моя група й запрошення (гравець), усі групи (ДМ), повідомлення («ви відстали» тощо).
import { socket } from '../net/socket.js';
import { request } from '../net/request.js';
import { session } from './session.js';

const listeners = new Set();
let state = { group: null, invite: null, all: [], notice: '' };

function set(patch) {
  state = { ...state, ...patch };
  for (const fn of listeners) fn(state);
}

socket.on('groups:state', ({ group, invite }) => set({ group, invite }));
socket.on('groups:all', (all) => set({ all }));
socket.on('groups:notice', ({ text }) => set({ notice: text }));

session.onChange((user) => { if (!user?.admitted) set({ group: null, invite: null, all: [], notice: '' }); });

export const groupsState = {
  get group() { return state.group; },
  get invite() { return state.invite; },
  get all() { return state.all; },
  takeNotice() {
    const text = state.notice;
    state = { ...state, notice: '' };
    return text;
  },
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  // Гравець
  sendInvite: (characterId) => request('groups:invite', { characterId }),
  answer: (accept) => request('groups:answer', { accept }),
  leave: () => request('groups:leave'),
  follow: () => request('groups:follow'),
  startVote: () => request('groups:voteStart'),
  vote: (choice) => request('groups:vote', { choice }),

  // ДМ
  disband: (groupId) => request('groups:disband', { groupId }),
  remove: (groupId, characterId) => request('groups:remove', { groupId, characterId }),
  setLeader: (groupId, characterId) => request('groups:setLeader', { groupId, characterId }),
  pause: (groupId) => request('groups:pause', { groupId }),
  resume: (groupId) => request('groups:resume', { groupId }),
  cancel: (groupId) => request('groups:cancel', { groupId }),
};
