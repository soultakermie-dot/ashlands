// Ім'я та роль користувача в усіх місцях, де вони показуються, і кнопки «Вийти».
import { session } from '../state/session.js';

const ROLE_NAMES = { player: 'Гравець', dm: 'Майстер (ДМ)' };

export function initUserBar() {
  session.onChange((user) => {
    if (!user) return;
    for (const el of document.querySelectorAll('[data-user-name]')) el.textContent = user.displayName || user.login;
    for (const el of document.querySelectorAll('[data-user-role]')) el.textContent = ROLE_NAMES[user.role] ?? user.role;
  });

  for (const btn of document.querySelectorAll('[data-logout]')) {
    btn.addEventListener('click', () => session.logout());
  }
}
