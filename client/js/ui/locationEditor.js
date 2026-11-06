// ДМ: вікно редагування локації — назва, опис, видалити (місто) / прибрати (підземелля).
import { button, el, messageLine } from '../lib/dom.js';
import { worldState } from '../state/world.js';
import { closeModal, onModalChange, openModal } from './modal.js';

export function openLocationEditor(locationId) {
  openModal('location-editor', { locationId });
}

export function initLocationEditor(container) {
  onModalChange((view, { locationId }) => {
    if (view !== 'location-editor') return;
    const loc = worldState.location(locationId);
    if (!loc) {
      container.replaceChildren(el('p', { class: 'hint' }, 'Локацію не знайдено'));
      return;
    }
    render(loc);
  });

  function render(loc) {
    const isCity = loc.type === 'city';
    const message = messageLine();
    const name = el('input', { maxLength: 60, autocomplete: 'off' });
    name.value = loc.name;
    const description = el('textarea', { rows: 5, maxLength: 2000, placeholder: 'Що гравці побачать, коли відкриють цю локацію' });
    description.value = loc.description ?? '';

    const form = el('form', { class: 'form', novalidate: true },
      el('p', { class: 'hint' }, isCity ? '🏰 Місто' : '💀 Підземелля'),
      el('label', { class: 'field' }, el('span', {}, 'Назва'), name),
      el('label', { class: 'field' }, el('span', {}, 'Опис'), description),
      message,
      el('div', { class: 'form-actions form-actions--split' },
        button(isCity ? '🗑 Видалити місто' : '💀 Прибрати підземелля', 'btn--bad', async () => {
          const question = isCity
            ? `Видалити місто «${loc.name}»? Дороги до нього теж зникнуть.`
            : `Прибрати підземелля «${loc.name}» з карти?`;
          if (!window.confirm(question)) return;
          const r = await worldState.deleteLocation(loc.id);
          if (!r.ok) return message.show(r.error);
          closeModal();
        }),
        el('button', { type: 'submit', class: 'btn' }, 'Зберегти')));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await worldState.updateLocation(loc.id, { name: name.value, description: description.value });
      if (!r.ok) return message.show(r.error);
      closeModal();
    });

    container.replaceChildren(form);
    name.focus();
    name.select();
  }
}
