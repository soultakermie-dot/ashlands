// Панель ДМ «Вхід у гру»: хто проситься (Новий / Старий), хто в грі, примітки ДМ.
import { socket } from '../net/socket.js';
import { request } from '../net/request.js';
import { session } from '../state/session.js';

const NOTE_MAX = 200;

export function initAccountsPanel(root) {
  const waitingEl = root.querySelector('[data-waiting]');
  const inGameEl = root.querySelector('[data-in-game]');
  const waitingCount = root.querySelector('[data-waiting-count]');
  const inGameCount = root.querySelector('[data-in-game-count]');
  const errorEl = root.querySelector('.form-message');

  function showError(text) {
    errorEl.textContent = text;
    errorEl.hidden = !text;
  }

  async function send(event, payload) {
    const res = await request(event, payload);
    showError(res.ok ? '' : res.error);
    return res.ok;
  }

  function render({ waiting, inGame }) {
    waitingCount.textContent = waiting.length;
    inGameCount.textContent = inGame.length;
    fillList(waitingEl, waiting, renderWaiting, 'Ніхто не проситься');
    fillList(inGameEl, inGame, renderInGame, 'У грі поки нікого');
  }

  function fillList(listEl, items, renderItem, emptyText) {
    if (!items.length) {
      const empty = document.createElement('li');
      empty.className = 'hint player-list__empty';
      empty.textContent = emptyText;
      listEl.replaceChildren(empty);
      return;
    }
    listEl.replaceChildren(...items.map(renderItem));
  }

  function renderWaiting(player) {
    const row = baseRow(player);
    row.classList.add('player-row--waiting');
    row.querySelector('.player-row__actions').append(
      button('Пустити', 'btn--ok', () => send('accounts:admit', { userId: player.id })),
      button('Не пускати', 'btn--bad', () => send('accounts:reject', { userId: player.id })),
    );
    return row;
  }

  function renderInGame(player) {
    const row = baseRow(player);
    if (!player.online) row.classList.add('player-row--away');
    row.querySelector('.player-row__actions').append(
      button('Вигнати', 'btn--bad', () => {
        if (window.confirm(`Вигнати «${player.login}» з гри?`)) send('accounts:kick', { userId: player.id });
      }),
    );
    return row;
  }

  // Рядок: позначка Новий/Старий, логін, примітка ДМ, місце для кнопок.
  function baseRow(player) {
    const li = document.createElement('li');
    li.className = 'player-row';

    const badge = document.createElement('span');
    badge.className = `badge ${player.isNew ? 'badge--new' : 'badge--old'}`;
    badge.textContent = player.isNew ? 'Новий' : 'Старий';

    const name = document.createElement('span');
    name.className = 'player-row__name';
    name.textContent = player.login;
    if (!player.online) name.title = 'Відійшов (допуск діє ще до 10 хв)';

    const actions = document.createElement('span');
    actions.className = 'player-row__actions';

    li.append(badge, name, noteInput(player), actions);
    return li;
  }

  // Примітка: пише сам ДМ, зберігається, коли поле втрачає фокус або натиснуто Enter.
  function noteInput(player) {
    const input = document.createElement('input');
    input.className = 'player-row__note';
    input.placeholder = 'примітка...';
    input.maxLength = NOTE_MAX;
    input.value = player.note;
    input.title = 'Примітку бачить тільки ДМ';

    const save = () => {
      if (input.value.trim() === player.note) return;
      player.note = input.value.trim();
      send('accounts:note', { userId: player.id, note: player.note });
    };
    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    return input;
  }

  function button(label, css, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn btn--small ${css}`;
    btn.textContent = label;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await onClick();
      btn.disabled = false;
    });
    return btn;
  }

  // Сервер сам надсилає оновлення після кожної зміни.
  // Поки ДМ пише примітку, не перемальовуємо список, щоб не збити введення.
  let pending = null;
  socket.on('accounts:lobby', (lobby) => {
    if (root.contains(document.activeElement) && document.activeElement.matches('.player-row__note')) {
      pending = lobby;
      return;
    }
    render(lobby);
  });
  root.addEventListener('focusout', () => setTimeout(() => {
    if (pending && !root.contains(document.activeElement)) {
      render(pending);
      pending = null;
    }
  }));

  // Панель видно лише ДМ; при вході ДМ завантажуємо стан.
  session.onChange(async (user) => {
    const isDm = user?.role === 'dm';
    root.hidden = !isDm;
    if (!isDm) return;
    const res = await request('accounts:lobby');
    if (res.ok) render(res);
  });
}
