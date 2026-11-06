// Панель користувача: хто увійшов, роль, кнопка «Вийти».
import { session } from '../state/session.js';

const ROLE_NAMES = { player: 'Гравець', dm: 'Майстер (ДМ)' };

export function initUserBar(root) {
  const name = root.querySelector('[data-user-name]');
  const role = root.querySelector('[data-user-role]');
  const logoutBtn = root.querySelector('[data-logout]');

  session.onChange((user) => {
    if (!user) return;
    name.textContent = user.login;
    role.textContent = ROLE_NAMES[user.role] ?? user.role;
  });

  logoutBtn.addEventListener('click', () => session.logout());
}
