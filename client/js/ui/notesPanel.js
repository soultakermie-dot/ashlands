// ДМ: «📝 Нотатки» — список нотаток; назва й текст зберігаються самі (через секунду після введення).
import { socket } from '../net/socket.js';
import { request } from '../net/request.js';
import { button, el, messageLine } from '../lib/dom.js';
import { session } from '../state/session.js';

const SAVE_DELAY_MS = 800;

export function initNotesPanel(root) {
  const message = messageLine();
  const list = el('div', { class: 'notes' });
  let notes = [];
  let pending = null;   // оновлення від іншого ДМ, поки цей друкує

  root.replaceChildren(
    el('div', { class: 'form-actions form-actions--split' },
      el('span', { class: 'hint' }, 'Бачать лише ДМ. Зберігається само.'),
      button('+ Нова нотатка', 'btn--ok', async () => {
        const r = await request('notes:create');
        if (!r.ok) return message.show(r.error);
        notes = [r.note, ...notes];
        render();
        list.querySelector('.note input')?.focus();
      })),
    message,
    list,
  );

  function render() {
    if (!notes.length) { list.replaceChildren(el('p', { class: 'hint' }, 'Нотаток ще нема.')); return; }
    list.replaceChildren(...notes.map(noteCard));
  }

  function noteCard(note) {
    const title = el('input', { class: 'inv-input note__title', maxLength: 100, placeholder: 'Назва', value: note.title });
    const body = el('textarea', { class: 'inv-input note__body', rows: 5, maxLength: 10000, placeholder: 'Текст нотатки…' });
    body.value = note.body;
    const status = el('span', { class: 'hint note__status' }, '');
    let timer = 0;

    const save = async () => {
      clearTimeout(timer);
      status.textContent = 'зберігаю…';
      const r = await request('notes:update', { noteId: note.id, title: title.value, body: body.value });
      if (!r.ok) { status.textContent = ''; return message.show(r.error); }
      Object.assign(note, r.note);
      status.textContent = 'збережено';
    };
    const later = () => { clearTimeout(timer); status.textContent = '…'; timer = setTimeout(save, SAVE_DELAY_MS); };
    title.addEventListener('input', later);
    body.addEventListener('input', later);
    title.addEventListener('blur', () => { if (timer) save(); });
    body.addEventListener('blur', () => { if (timer) save(); });

    return el('section', { class: 'note' },
      el('div', { class: 'note__head' }, title,
        button('🗑', 'btn--ghost', async () => {
          if (!window.confirm(`Видалити нотатку «${note.title || 'без назви'}»?`)) return;
          const r = await request('notes:delete', { noteId: note.id });
          if (!r.ok) return message.show(r.error);
          notes = notes.filter((n) => n.id !== note.id);
          render();
        }, 'Видалити')),
      body,
      status);
  }

  // Інший ДМ змінив нотатки. Поки цей друкує — не перемальовуємо, щоб не збити введення.
  socket.on('notes:list', (next) => {
    if (root.contains(document.activeElement) && document.activeElement.matches('input, textarea')) { pending = next; return; }
    notes = next;
    render();
  });
  root.addEventListener('focusout', () => setTimeout(() => {
    if (pending && !root.contains(document.activeElement)) { notes = pending; pending = null; render(); }
  }));

  session.onChange(async (user) => {
    if (user?.role !== 'dm') return;
    const r = await request('notes:list');
    if (r.ok) { notes = r.notes; render(); }
  });
}
