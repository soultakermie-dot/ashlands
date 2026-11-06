// ДМ: перемикач «🎲 Ігровий / 🛠 Творчий» у верхній панелі та інструменти зліва.
// Творчий: ✋ вибір, 🏰 місто, 〰 дорога, 🚩 старт. Ігровий: 💀 поставити підземелля.
import { editor } from '../state/editorMode.js';
import { session } from '../state/session.js';

const TOOLS = {
  creative: [
    { id: 'select', label: '✋ Вибір', hint: 'Тягни міста й стартову точку. Клік по місту — змінити. Клік по дорозі — точки згину.' },
    { id: 'city', label: '🏰 Місто', hint: 'Клікни на карті, де поставити нове місто.' },
    { id: 'road', label: '〰 Дорога', hint: 'Клікни по одній локації, потім по іншій — між ними з\'явиться дорога.' },
    { id: 'spawn', label: '🚩 Старт', hint: 'Клікни на карті, де з\'являтимуться нові персонажі.' },
  ],
  game: [
    { id: 'dungeon', label: '💀 Поставити підземелля', hint: 'Клікни на карті — там з\'явиться підземелля, і гравці одразу його побачать. Esc — скасувати.' },
  ],
};

export function initEditorToolbar(switchRoot, toolbar) {
  const hint = toolbar.querySelector('[data-editor-hint]');
  const buttons = toolbar.querySelector('[data-editor-tools]');

  for (const btn of switchRoot.querySelectorAll('[data-set-mode]')) {
    btn.addEventListener('click', () => editor.setMode(btn.dataset.setMode));
  }

  function render() {
    const isDm = session.user?.role === 'dm' && session.user.admitted;
    switchRoot.hidden = !isDm;
    toolbar.hidden = !isDm;
    if (!isDm) return;

    for (const btn of switchRoot.querySelectorAll('[data-set-mode]')) {
      btn.classList.toggle('mode-switch__btn--active', btn.dataset.setMode === editor.mode);
    }
    document.body.classList.toggle('is-creative', editor.mode === 'creative');

    const tools = TOOLS[editor.mode];
    buttons.replaceChildren(...tools.map((t) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `tool-btn${editor.tool === t.id ? ' tool-btn--active' : ''}`;
      b.textContent = t.label;
      // В ігровому режимі кнопка підземелля — перемикач: повторний клік скасовує.
      b.addEventListener('click', () => editor.setTool(editor.mode === 'game' && editor.tool === t.id ? 'select' : t.id));
      return b;
    }));
    const active = tools.find((t) => t.id === editor.tool);
    hint.textContent = active?.hint ?? '';
    hint.hidden = !active;
    toolbar.classList.toggle('editor-toolbar--game', editor.mode === 'game');
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && editor.tool !== 'select') editor.setTool('select');
  });

  editor.onChange(render);
  session.onChange(render);
}
