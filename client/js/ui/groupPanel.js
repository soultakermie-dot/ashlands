// Розділ «⚑ Група» (гравець): учасники, хто лідер, хто відстає; вийти; переобрати лідера.
import { button, el } from '../lib/dom.js';
import { characters } from '../state/characters.js';
import { groupsState } from '../state/groups.js';

export function initGroupPanel(root) {
  const message = el('p', { class: 'form-message', hidden: true });

  function run(promise) {
    promise.then((r) => {
      message.textContent = r.ok ? '' : r.error;
      message.hidden = r.ok;
    });
  }

  function render() {
    const g = groupsState.group;
    if (!g) {
      root.replaceChildren(
        el('p', {}, 'Ви не в групі.'),
        el('p', { class: 'hint' }, 'Щоб зібрати групу, клікніть на карті по жетону гравця, який стоїть поруч, → «🤝 Запросити в групу». Хто зібрав групу — той і лідер.'),
        message);
      return;
    }
    const me = characters.active?.id;
    // replaceChildren() перетворює null на текст «null» — порожні частини відкидаємо.
    root.replaceChildren(...[
      el('h3', { class: 'sheet__title' }, g.name),
      el('ul', { class: 'people-list' }, g.members.map((m) => el('li', { class: 'person' },
        el('span', { class: 'person__status' }, m.characterId === g.leaderId ? '⚑' : '•'),
        el('span', { class: 'person__name' }, `${m.name}${m.characterId === me ? ' (ви)' : ''}`),
        el('span', { class: 'person__tag' }, [
          m.ownerName,
          m.traveling ? `🚶 до «${m.destinationName}»` : '🧍 стоїть',
          m.lagging ? '⚠ відстає' : '',
        ].filter(Boolean).join(' · '))))),
      voteInfo(g),
      message,
      el('div', { class: 'form-actions form-actions--split' },
        button('🚪 Вийти з групи', 'btn--bad', () => { if (window.confirm('Вийти з групи?')) run(groupsState.leave()); }),
        g.vote ? null : button('🗳 Переобрати лідера', 'btn--ghost', () => run(groupsState.startVote()))),
      el('p', { class: 'hint' }, 'Хто відстане від лідера далі ніж на 300 м (і не йде за ним) довше хвилини — вийде з групи.'),
    ].filter(Boolean));
  }

  function voteInfo(g) {
    const v = g.vote;
    if (!v) return null;
    const text = v.stage === 'confirm'
      ? `🗳 Голосування «переобрати лідера?»: так — ${v.yes.length}, ні — ${v.no.length} з ${g.members.length}`
      : v.stage === 'elect'
        ? `🗳 Обираємо лідера: проголосували ${v.voted.length} з ${g.members.length}`
        : '🗳 Нічия — лідера обере майстер';
    return el('p', { class: 'group-vote' }, text);
  }

  groupsState.onChange(render);
  characters.onChange(render);
  render();
}
