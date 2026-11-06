// Розділ «Гравці»: хто в грі — 🟢 онлайн, 🟡 пропав, ⚪ офлайн. Без персонажів.
import { playersState } from '../state/players.js';
import { session } from '../state/session.js';

const STATUS = {
  online: { icon: '🟢', text: 'онлайн' },
  away: { icon: '🟡', text: 'пропав' },
  offline: { icon: '⚪', text: 'офлайн' },
};

export function initPlayersPanel(root) {
  const listEl = root.querySelector('[data-players]');
  const summary = root.querySelector('[data-players-summary]');

  playersState.onChange((players) => {
    const online = players.filter((p) => p.status === 'online').length;
    summary.textContent = `Онлайн: ${online} з ${players.length}`;
    listEl.replaceChildren(...players.map((p) => {
      const li = document.createElement('li');
      li.className = `person person--${p.status}`;
      const dot = document.createElement('span');
      dot.className = 'person__status';
      dot.textContent = STATUS[p.status].icon;
      dot.title = STATUS[p.status].text;
      const name = document.createElement('span');
      name.className = 'person__name';
      name.textContent = p.displayName;
      if (p.id === session.user?.id) name.textContent += ' (ви)';
      const tag = document.createElement('span');
      tag.className = 'person__tag';
      tag.textContent = p.isDm ? 'ДМ' : STATUS[p.status].text;
      li.append(dot, name, tag);
      return li;
    }));
  });
}
