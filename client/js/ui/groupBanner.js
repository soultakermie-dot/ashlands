// Гравець: рядок угорі карти про групу — запрошення, «Йти за лідером», голосування, повідомлення.
import { button, el } from '../lib/dom.js';
import { characters } from '../state/characters.js';
import { groupsState } from '../state/groups.js';
import { session } from '../state/session.js';
import { tokensState } from '../state/tokens.js';

const NOTICE_MS = 7000;

export function initGroupBanner(root) {
  let notice = '';
  let noticeTimer = 0;

  const myId = () => characters.active?.id;
  const myToken = () => tokensState.list.find((t) => t.characterId === myId());

  function render() {
    if (session.user?.role !== 'player') { root.hidden = true; return; }
    const fresh = groupsState.takeNotice();
    if (fresh) {
      notice = fresh;
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => { notice = ''; render(); }, NOTICE_MS);
    }

    const { group, invite } = groupsState;
    let content = null;

    if (invite) {
      content = [
        el('span', {}, `🤝 ${invite.fromName} кличе вас у групу`),
        button('Прийняти', 'btn--ok', () => groupsState.answer(true)),
        button('Відхилити', 'btn--ghost', () => groupsState.answer(false)),
      ];
    } else if (group?.vote && group.vote.stage !== 'tie' && !hasVoted(group.vote)) {
      content = group.vote.stage === 'confirm'
        ? [el('span', {}, '🗳 Переобрати лідера?'),
          button('Так', 'btn--ok', () => groupsState.vote(true)),
          button('Ні', 'btn--ghost', () => groupsState.vote(false))]
        : [el('span', {}, '🗳 Хто буде лідером?'),
          ...group.members.map((m) => button(m.name, 'btn--ghost', () => groupsState.vote(m.characterId)))];
    } else if (group && group.leaderId !== myId()) {
      const leader = tokensState.list.find((t) => t.characterId === group.leaderId);
      const mine = myToken();
      const leaderGoing = leader?.travel;
      const following = mine?.travel && leaderGoing && mine.travel.destinationId === leaderGoing.destinationId;
      if (leaderGoing && !following) {
        content = [
          el('span', {}, `👣 Лідер іде до «${leaderGoing.destinationName}»`),
          button('Йти за лідером', 'btn--ok', () => groupsState.follow()),
        ];
      }
    }
    if (!content && notice) content = [el('span', {}, notice)];

    root.replaceChildren(...(content ?? []));
    root.hidden = !content;
  }

  // Чи я вже проголосував.
  function hasVoted(vote) {
    const id = myId();
    if (vote.stage === 'confirm') return vote.yes.includes(id) || vote.no.includes(id);
    return vote.voted.includes(id);
  }

  groupsState.onChange(render);
  tokensState.onChange(render);
  characters.onChange(render);
  session.onChange(render);
}
