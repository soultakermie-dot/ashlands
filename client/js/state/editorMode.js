// Режим ДМ: 'game' (ігровий), 'creative' (творчий — редагування світу), 'builder' (будівельник 3D-міст) і вибраний інструмент.
// Інструменти творчого режиму: select (вибір і перетягування), city, road, spawn.
// В ігровому режимі ДМ може тимчасово ввімкнути інструмент dungeon (поставити підземелля).
import { session } from './session.js';

const STORAGE_KEY = 'ashlands.editorMode';
const listeners = new Set();

let mode = 'game';
let tool = 'select';

const MODES = ['game', 'creative', 'builder'];
try { const saved = localStorage.getItem(STORAGE_KEY); if (MODES.includes(saved)) mode = saved; } catch { /* не критично */ }

function emit() {
  for (const fn of listeners) fn({ mode, tool });
}

// Гравцям творчий режим недоступний.
session.onChange((user) => {
  if (user?.role !== 'dm' && (mode !== 'game' || tool !== 'select')) {
    mode = 'game';
    tool = 'select';
    emit();
  }
});

export const editor = {
  get mode() { return mode; },
  get tool() { return tool; },
  get isCreative() { return mode === 'creative' && session.user?.role === 'dm'; },
  get isBuilder() { return mode === 'builder' && session.user?.role === 'dm'; },

  setMode(next) {
    mode = MODES.includes(next) ? next : 'game';
    tool = 'select';
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* не критично */ }
    emit();
  },

  setTool(next) {
    tool = next;
    emit();
  },

  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
