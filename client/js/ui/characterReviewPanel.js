// Панель ДМ «Нові персонажі»: підтвердити або відхилити.
import { socket } from '../net/socket.js';
import { request } from '../net/request.js';
import { session } from '../state/session.js';
import { createAvatar } from './avatar.js';

export function initCharacterReviewPanel(root) {
  const listEl = root.querySelector('[data-pending-characters]');
  const countEl = root.querySelector('[data-pending-characters-count]');
  const message = root.querySelector('.form-message');

  function render(list) {
    countEl.textContent = list.length;
    if (!list.length) {
      const empty = document.createElement('li');
      empty.className = 'hint';
      empty.textContent = 'Нових персонажів нема';
      listEl.replaceChildren(empty);
      return;
    }
    listEl.replaceChildren(...list.map(renderRow));
  }

  function renderRow(c) {
    const li = document.createElement('li');
    li.className = 'character-card character-card--pending';

    const info = document.createElement('span');
    info.className = 'character-card__info';
    const name = document.createElement('strong');
    name.textContent = c.name;
    const owner = document.createElement('span');
    owner.className = 'character-card__status';
    owner.textContent = `гравець: ${c.ownerLogin}`;
    info.append(name, owner);

    const actions = document.createElement('span');
    actions.className = 'character-card__actions';
    actions.append(
      button('Підтвердити', 'btn--ok', () => review(c.id, true)),
      button('Відхилити', 'btn--bad', () => review(c.id, false)),
    );

    li.append(createAvatar(c.name, c.avatarUrl), info, actions);
    return li;
  }

  async function review(characterId, approve) {
    const res = await request('characters:review', { characterId, approve });
    message.textContent = res.ok ? '' : res.error;
    message.hidden = res.ok;
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

  socket.on('characters:pending', render);

  session.onChange(async (user) => {
    const isDm = user?.role === 'dm';
    root.hidden = !isDm;
    if (!isDm) return;
    const res = await request('characters:pending');
    if (res.ok) render(res.characters);
  });
}
