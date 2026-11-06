// ДМ: розділ «⚑ Групи» — усі групи, учасники, керування; нічия в голосуванні — вибір лідера.
import { button, el } from '../lib/dom.js';
import { groupsState } from '../state/groups.js';
import { tokensState } from '../state/tokens.js';

export function initGroupsDmPanel(root) {
  const message = el('p', { class: 'form-message', hidden: true });

  const run = async (promise) => {
    const r = await promise;
    message.textContent = r.ok ? '' : r.error;
    message.hidden = r.ok;
  };

  function render() {
    const groups = groupsState.all;
    if (!groups.length) {
      root.replaceChildren(el('p', { class: 'hint' }, 'Груп поки нема. Гравці збирають їх самі, запрошуючи тих, хто поруч.'), message);
      return;
    }
    root.replaceChildren(message, ...groups.map(renderGroup));
  }

  function renderGroup(g) {
    const anyTraveling = g.members.some((m) => m.traveling);
    const paused = g.members.some((m) => tokensState.list.find((t) => t.characterId === m.characterId)?.travel?.pausedBy === 'dm');
    const tie = g.vote?.stage === 'tie';
    return el('section', { class: `dm-group${tie ? ' dm-group--tie' : ''}` },
      el('div', { class: 'dm-group__head' },
        el('strong', {}, `⚑ ${g.name}`),
        el('span', { class: 'dm-group__actions' },
          anyTraveling && !paused ? button('⏸ Зупинити групу', 'btn--ghost', () => run(groupsState.pause(g.id))) : null,
          paused ? button('▶ Продовжити', 'btn--ok', () => run(groupsState.resume(g.id))) : null,
          anyTraveling ? button('✖ Скасувати подорож', 'btn--ghost', () => run(groupsState.cancel(g.id))) : null,
          button('Розбити', 'btn--bad', () => { if (window.confirm(`Розбити «${g.name}»?`)) run(groupsState.disband(g.id)); }))),
      tie ? el('p', { class: 'group-vote' }, '🗳 Нічия в голосуванні — оберіть лідера:') : null,
      tie ? el('div', { class: 'dm-group__tie' }, g.vote.candidates.map((id) => {
        const m = g.members.find((x) => x.characterId === id);
        return button(m?.name ?? '?', 'btn--ok', () => run(groupsState.setLeader(g.id, id)));
      })) : null,
      g.vote && !tie ? el('p', { class: 'hint' }, g.vote.stage === 'confirm' ? '🗳 Голосують: переобрати лідера?' : '🗳 Голосують за нового лідера') : null,
      el('ul', { class: 'people-list' }, g.members.map((m) => el('li', { class: 'person' },
        el('span', { class: 'person__status' }, m.characterId === g.leaderId ? '⚑' : '•'),
        el('span', { class: 'person__name' }, `${m.name}`, el('small', { class: 'player-row__login' }, `${m.ownerName}${m.traveling ? ` · 🚶 до «${m.destinationName}»` : ''}${m.lagging ? ' · ⚠ відстає' : ''}`)),
        el('span', { class: 'dm-group__member-actions' },
          m.characterId !== g.leaderId ? button('⚑', 'btn--ghost', () => run(groupsState.setLeader(g.id, m.characterId)), 'Зробити лідером') : null,
          button('Вивести', 'btn--ghost', () => run(groupsState.remove(g.id, m.characterId))))))));
  }

  groupsState.onChange(render);
  tokensState.onChange(render);
  render();
}
