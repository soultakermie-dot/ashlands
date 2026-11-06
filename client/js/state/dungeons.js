// Катакомби: де мій персонаж (гравець), усі походи (ДМ), дії ДМ і вибір точки виходу на карті.
import { socket } from '../net/socket.js';
import { request } from '../net/request.js';
import { editor } from './editorMode.js';
import { session } from './session.js';

const listeners = new Set();
let state = { mine: null, runs: [], notice: '' };
let picking = null;   // { runId, mode, radius } — ДМ вибирає точку виходу кліком по карті

function set(patch) {
  state = { ...state, ...patch };
  for (const fn of listeners) fn(state);
}

socket.on('dungeon:state', (mine) => set({ mine }));
socket.on('dungeon:runs', (runs) => set({ runs }));
socket.on('dungeon:exited', ({ dungeonName }) => set({ notice: `🕯 Ви вибрались з катакомб «${dungeonName}»` }));
session.onChange((user) => { if (!user?.admitted) set({ mine: null, runs: [], notice: '' }); });

export const dungeonsState = {
  get mine() { return state.mine; },
  get runs() { return state.runs; },
  get picking() { return picking; },
  takeNotice() {
    const t = state.notice;
    state = { ...state, notice: '' };
    return t;
  },
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  near: (dungeonId) => request('dungeon:near', { dungeonId }),
  enter: (dungeonId, characterIds) => request('dungeon:enter', { dungeonId, characterIds }),
  pause: (runId) => request('dungeon:pause', { runId }),
  resume: (runId) => request('dungeon:resume', { runId }),
  release: (runId) => request('dungeon:release', { runId }),
  setExit: (runId, mode, point, radius) => request('dungeon:exit', { runId, mode, point, radius }),

  // ДМ: «вибрати точку на карті» — наступний клік по карті стане точкою виходу.
  startPicking(runId, mode, radius) {
    picking = { runId, mode, radius };
    editor.setTool('exitPoint');
  },
  async finishPicking(x, y) {
    const p = picking;
    picking = null;
    editor.setTool('select');
    return p ? request('dungeon:exit', { runId: p.runId, mode: p.mode, point: { x, y }, radius: p.radius }) : { ok: false, error: 'Нема що вибирати' };
  },
  cancelPicking() {
    picking = null;
    if (editor.tool === 'exitPoint') editor.setTool('select');
  },
};
