// ДМ: усі персонажі всіх гравців. Клік — лист персонажа (з нього можна перейти в інвентар).
import { socket } from '../net/socket.js';
import { request } from '../net/request.js';
import { session } from '../state/session.js';
import { createAvatar } from './avatar.js';
import { openCharacterView } from './characterDetails.js';

const STATUS_TEXT = { pending: 'чекає', approved: '', rejected: 'відхилений' };

export function initAllCharactersPanel(root) {
  const listEl = root.querySelector('[data-all-characters]');

  function render(list) {
    if (!list.length) {
      const empty = document.createElement('li');
      empty.className = 'hint';
      empty.textContent = 'Персонажів ще нема';
      listEl.replaceChildren(empty);
      return;
    }
    listEl.replaceChildren(...list.map((c) => {
      const li = document.createElement('li');
      li.className = `character-card character-card--${c.status} character-card--clickable`;
      li.tabIndex = 0;

      const info = document.createElement('span');
      info.className = 'character-card__info';
      const name = document.createElement('strong');
      name.textContent = c.name;
      const meta = document.createElement('span');
      meta.className = 'character-card__status';
      meta.textContent = [`гравець: ${c.ownerName}`, c.isActive && 'грає зараз', STATUS_TEXT[c.status]].filter(Boolean).join(' · ');
      info.append(name, meta);

      const actions = document.createElement('span');
      actions.className = 'character-card__actions';
      for (const [label, view] of [['📜', 'sheet'], ['🎒', 'inventory']]) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn--small btn--ghost';
        btn.textContent = label;
        btn.title = view === 'sheet' ? 'Лист персонажа' : 'Інвентар';
        btn.addEventListener('click', (e) => { e.stopPropagation(); openCharacterView(view, c); });
        actions.append(btn);
      }

      li.append(createAvatar(c.name, c.avatarUrl), info, actions);
      li.addEventListener('click', () => openCharacterView('sheet', c));
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter') openCharacterView('sheet', c); });
      return li;
    }));
  }

  socket.on('characters:all', render);

  session.onChange(async (user) => {
    if (user?.role !== 'dm') return;
    const res = await request('characters:all');
    if (res.ok) render(res.characters);
  });
}
