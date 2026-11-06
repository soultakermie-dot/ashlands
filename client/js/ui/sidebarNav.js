// Бічна панель — стовпчик кнопок. Клік відкриває розділ у вікні посередині екрана.
// Кнопки гравця (data-player-only) і блок ДМ (data-dm-only) показуються залежно від ролі.
import { session } from '../state/session.js';
import { closeModal, onModalChange, openModal } from './modal.js';

export function initSidebarNav(sidebar) {
  for (const btn of sidebar.querySelectorAll('[data-open-view]')) {
    btn.addEventListener('click', () => openModal(btn.dataset.openView));
  }

  // Підсвічуємо кнопку відкритого розділу.
  onModalChange((view) => {
    for (const btn of sidebar.querySelectorAll('[data-open-view]')) {
      btn.classList.toggle('nav-btn--active', btn.dataset.openView === view);
    }
  });

  session.onChange((user) => {
    const isDm = user?.role === 'dm';
    for (const el of sidebar.querySelectorAll('[data-player-only]')) el.hidden = isDm;
    for (const el of sidebar.querySelectorAll('[data-dm-only]')) el.hidden = !isDm;
    if (!user?.admitted) closeModal();
  });
}

// Лічильник біля кнопки (наприклад, скільки людей чекає на вхід).
export function setBadge(name, count) {
  const badge = document.querySelector(`[data-badge="${name}"]`);
  if (!badge) return;
  badge.textContent = count;
  badge.hidden = !count;
}
