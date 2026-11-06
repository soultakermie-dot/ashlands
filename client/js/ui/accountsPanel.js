// Панель ДМ «Гравці»: нові заявки, активні й заблоковані гравці з кнопками дій.
import { socket } from '../net/socket.js';
import { request } from '../net/request.js';
import { session } from '../state/session.js';

const STATUS_NAMES = { pending: 'Чекає', active: 'Грає', blocked: 'Вигнаний' };

// Які кнопки показувати для кожного статусу.
const ACTIONS = {
  pending: [
    { event: 'accounts:approve', label: 'Пустити', css: 'btn--ok' },
    { event: 'accounts:reject', label: 'Не пускати', css: 'btn--bad', confirm: 'Відхилити заявку «{login}»?' },
  ],
  active: [
    { event: 'accounts:block', label: 'Вигнати', css: 'btn--bad', confirm: 'Вигнати «{login}» з гри?' },
  ],
  blocked: [
    { event: 'accounts:approve', label: 'Повернути', css: 'btn--ok' },
  ],
};

export function initAccountsPanel(root) {
  const listEl = root.querySelector('[data-players]');
  const countEl = root.querySelector('[data-pending-count]');
  const errorEl = root.querySelector('.form-error');

  function render(players) {
    const pending = players.filter((p) => p.status === 'pending').length;
    countEl.textContent = pending ? `Нових заявок: ${pending}` : 'Нових заявок нема';

    listEl.replaceChildren(...players.map(renderRow));
    if (!players.length) {
      const empty = document.createElement('li');
      empty.className = 'hint';
      empty.textContent = 'Поки ніхто не зареєструвався';
      listEl.append(empty);
    }
  }

  function renderRow(player) {
    const li = document.createElement('li');
    li.className = `player-row player-row--${player.status}`;

    const name = document.createElement('span');
    name.className = 'player-row__name';
    name.textContent = player.login;

    const status = document.createElement('span');
    status.className = 'player-row__status';
    status.textContent = STATUS_NAMES[player.status] ?? player.status;

    const actions = document.createElement('span');
    actions.className = 'player-row__actions';
    for (const action of ACTIONS[player.status] ?? []) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn btn--small ${action.css}`;
      btn.textContent = action.label;
      btn.addEventListener('click', () => runAction(action, player, btn));
      actions.append(btn);
    }

    li.append(name, status, actions);
    return li;
  }

  async function runAction(action, player, btn) {
    if (action.confirm && !window.confirm(action.confirm.replace('{login}', player.login))) return;
    btn.disabled = true;
    const res = await request(action.event, { userId: player.id });
    errorEl.textContent = res.ok ? '' : res.error;
    errorEl.hidden = res.ok;
    btn.disabled = false;
  }

  // Сервер сам надсилає оновлений список після кожної зміни.
  socket.on('accounts:list', render);

  // Панель видно лише ДМ; при вході ДМ завантажуємо список.
  session.onChange(async (user) => {
    const isDm = user?.role === 'dm' && user.status === 'active';
    root.hidden = !isDm;
    if (!isDm) return;
    const res = await request('accounts:list');
    if (res.ok) render(res.players);
  });
}
