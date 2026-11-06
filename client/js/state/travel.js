// Подорожі: чи потрібен дозвіл ДМ, запити (для ДМ), дії.
import { socket } from '../net/socket.js';
import { request } from '../net/request.js';
import { session } from './session.js';

const listeners = new Set();
let state = { approvalRequired: false, gamePaused: false, requests: [] };

function set(patch) {
  state = { ...state, ...patch };
  for (const fn of listeners) fn(state);
}

socket.on('travel:settings', ({ approvalRequired, gamePaused }) => set({ approvalRequired, gamePaused: !!gamePaused }));
socket.on('travel:requests', (requests) => set({ requests }));

session.onChange(async (user) => {
  if (!user?.admitted) return set({ requests: [] });
  const res = await request('world:get');
  if (res.ok) set({ approvalRequired: !!res.approvalRequired, gamePaused: !!res.gamePaused });
});

export const travelState = {
  get approvalRequired() { return state.approvalRequired; },
  get requests() { return state.requests; },
  get gamePaused() { return state.gamePaused; },
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  // Гравець
  go: (locationId) => request('travel:go', { locationId }),
  stop: () => request('travel:stop'),

  // ДМ
  pause: (characterId) => request('travel:pause', { characterId }),
  resume: (characterId) => request('travel:resume', { characterId }),
  cancel: (characterId) => request('travel:cancel', { characterId }),
  approve: (characterId) => request('travel:approve', { characterId }),
  reject: (characterId) => request('travel:reject', { characterId }),
  send: (characterId, locationId) => request('travel:send', { characterId, locationId }),
  setApproval: (required) => request('travel:setApproval', { required }),
  pauseGame: () => request('travel:pauseGame'),
  resumeGame: () => request('travel:resumeGame'),
};

// «~12 хв», «~40 с»
export function formatDuration(ms) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `~${s} с`;
  return `~${Math.ceil(s / 60)} хв`;
}
