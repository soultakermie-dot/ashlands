// Вікно посередині екрана. Усередині — розділи [data-view="..."], показується один за раз.
// Закривається хрестиком, Esc або кліком повз вікно.
const listeners = new Set();
let root = null;
let current = null;

export function initModal(element) {
  root = element;
  root.querySelector('[data-modal-close]').addEventListener('click', closeModal);
  root.addEventListener('click', (e) => { if (e.target === root) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) closeModal(); });
}

// Відкрити розділ. context — додаткові дані (наприклад, який персонаж).
export function openModal(view, context = {}) {
  const section = root.querySelector(`[data-view="${view}"]`);
  if (!section) return;
  for (const el of root.querySelectorAll('[data-view]')) el.hidden = el !== section;
  root.querySelector('[data-modal-title]').textContent = context.title ?? section.dataset.title ?? '';
  root.hidden = false;
  current = view;
  for (const fn of listeners) fn(view, context);
}

export function closeModal() {
  if (!root) return;
  root.hidden = true;
  current = null;
  for (const fn of listeners) fn(null, {});
}

export const currentView = () => current;

// Підписатися на відкриття/закриття розділів: fn(view | null, context).
export function onModalChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
