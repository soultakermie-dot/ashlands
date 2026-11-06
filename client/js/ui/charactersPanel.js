// Панель гравця «Мої персонажі»: список, вибір, видалення, створення нового.
import { characters } from '../state/characters.js';
import { session } from '../state/session.js';
import { createAvatar } from './avatar.js';
import { initCharacterForm } from './characterForm.js';

const STATUS_TEXT = {
  pending: 'Чекає підтвердження ДМ',
  approved: '',
  rejected: 'ДМ відхилив',
};

export function initCharactersPanel(root) {
  const listEl = root.querySelector('[data-characters]');
  const activeEl = root.querySelector('[data-active-character]');
  const message = root.querySelector(':scope > .form-message');
  const createBtn = root.querySelector('[data-create-character]');
  const form = initCharacterForm(root.querySelector('[data-character-form]'), {
    onDone: () => { createBtn.hidden = false; },
  });

  function showMessage(text) {
    message.textContent = text;
    message.hidden = !text;
  }

  createBtn.addEventListener('click', () => {
    createBtn.hidden = true;
    form.open();
  });

  async function run(action) {
    const res = await action();
    showMessage(res.ok ? '' : res.error);
  }

  function render() {
    const active = characters.active;
    activeEl.textContent = active ? `Ви граєте за: ${active.name}` : 'Персонажа не вибрано';

    if (!characters.list.length) {
      const empty = document.createElement('li');
      empty.className = 'hint';
      empty.textContent = 'У вас ще нема персонажів';
      listEl.replaceChildren(empty);
      return;
    }
    listEl.replaceChildren(...characters.list.map((c) => renderCard(c, c.id === active?.id)));
  }

  function renderCard(c, isActive) {
    const li = document.createElement('li');
    li.className = `character-card character-card--${c.status}${isActive ? ' character-card--active' : ''}`;

    const info = document.createElement('span');
    info.className = 'character-card__info';
    const name = document.createElement('strong');
    name.textContent = c.name;
    const status = document.createElement('span');
    status.className = 'character-card__status';
    status.textContent = isActive ? 'Вибраний' : STATUS_TEXT[c.status];
    info.append(name, status);

    const actions = document.createElement('span');
    actions.className = 'character-card__actions';
    if (c.status === 'approved' && !isActive) {
      actions.append(button('Вибрати', 'btn--ok', () => run(() => characters.select(c.id))));
    }
    actions.append(button('Видалити', 'btn--ghost', () => {
      if (window.confirm(`Видалити персонажа «${c.name}»? Це не можна скасувати.`)) run(() => characters.remove(c.id));
    }));

    li.append(createAvatar(c.name, c.avatarUrl), info, actions);
    return li;
  }

  function button(label, css, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn btn--small ${css}`;
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  characters.onChange(render);

  // Панель для гравців, яких пустили в гру.
  session.onChange((user) => {
    root.hidden = !(user?.admitted && user.role === 'player');
    if (root.hidden) form.close();
  });
}
