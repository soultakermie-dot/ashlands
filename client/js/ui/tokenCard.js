// Картка жетона (клік по персонажу на карті): хто це, де він / куди йде.
// ДМ: зупинити тут, продовжити, скасувати подорож, відправити до локації. Власник: зупинитись.
import { button, el } from '../lib/dom.js';
import { characters } from '../state/characters.js';
import { session } from '../state/session.js';
import { tokensState } from '../state/tokens.js';
import { formatDuration, travelState } from '../state/travel.js';
import { worldState } from '../state/world.js';

export function initTokenCard(root, { onMessage }) {
  let characterId = null;
  let timer = 0;

  const act = async (promise) => {
    const r = await promise;
    if (!r.ok) onMessage(r.error);
  };

  function show(token) {
    characterId = token.characterId;
    render();
  }

  function hide() {
    characterId = null;
    root.hidden = true;
    clearTimeout(timer);
  }

  function render() {
    clearTimeout(timer);
    const token = tokensState.list.find((t) => t.characterId === characterId);
    if (!token) return hide();
    const isDm = session.user?.role === 'dm';
    const isMine = token.characterId === characters.active?.id;
    const t = token.travel;

    let status = 'Стоїть';
    if (t?.running) status = `🚶 Іде до «${t.destinationName}» · ${formatDuration(tokensState.remainingMs(token))}`;
    else if (t) status = `⏸ Зупинений дорогою до «${t.destinationName}»`;
    else if (token.requested) status = '🙋 Просить дозволу на подорож';

    const actions = [];
    if (isDm) {
      if (t?.running) actions.push(button('⏸ Зупинити тут', 'btn--ghost', () => act(travelState.pause(token.characterId))));
      if (t && !t.running) actions.push(button('▶ Продовжити', 'btn--ok', () => act(travelState.resume(token.characterId))));
      if (t) actions.push(button('✖ Скасувати подорож', 'btn--bad', () => act(travelState.cancel(token.characterId))));
      const select = el('select', { class: 'inv-input' },
        (worldState.current?.locations ?? []).map((l) => el('option', { value: l.id }, `${l.type === 'dungeon' ? '💀' : '🏰'} ${l.name}`)));
      actions.push(el('span', { class: 'token-card__send' }, select,
        button('Відправити', 'btn--ghost', () => act(travelState.send(token.characterId, select.value)), 'Відправити персонажа дорогами до вибраної локації')));
    } else if (isMine && t?.running) {
      actions.push(button('Зупинитись', 'btn--ghost', () => act(travelState.stop())));
    }

    // replaceChildren() перетворює null на текст «null» — порожні частини відкидаємо.
    root.replaceChildren(...[
      el('button', { type: 'button', class: 'location-card__close', title: 'Закрити', onclick: hide }, '×'),
      el('span', { class: 'location-card__type' }, isMine ? 'Ваш персонаж' : 'Персонаж'),
      el('h2', { class: 'location-card__name' }, token.name),
      token.ownerLogin ? el('p', { class: 'hint' }, `гравець: ${token.ownerLogin}`) : null,
      el('p', { class: 'token-card__status' }, status),
      actions.length ? el('div', { class: 'location-card__actions token-card__actions' }, actions) : null,
    ].filter(Boolean));
    root.hidden = false;
    if (t?.running) timer = setTimeout(render, 5000);
  }

  tokensState.onChange(() => { if (characterId) render(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  return { show, hide, get open() { return !root.hidden; } };
}
