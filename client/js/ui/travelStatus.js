// Гравець: рядок «🚶 В дорозі до … · ~N хв» зверху карти, кнопка «Зупинитись», повідомлення про прибуття.
import { socket } from '../net/socket.js';
import { button, el } from '../lib/dom.js';
import { characters } from '../state/characters.js';
import { session } from '../state/session.js';
import { tokensState } from '../state/tokens.js';
import { formatDuration, travelState } from '../state/travel.js';

const ARRIVED_SHOW_MS = 6000;

export function initTravelStatus(root) {
  let timer = 0;
  let arrivedText = '';
  let arrivedTimer = 0;

  const myToken = () => tokensState.list.find((t) => t.characterId === characters.active?.id);

  function render() {
    const token = session.user?.role === 'player' ? myToken() : null;
    const t = token?.travel;
    let content = null;

    if (t?.running) {
      content = [
        el('span', {}, `🚶 В дорозі до «${t.destinationName}» · ${formatDuration(tokensState.remainingMs(token))}`),
        button('Зупинитись', 'btn--ghost', () => travelState.stop()),
      ];
    } else if (t) {
      content = [el('span', {}, `⏸ Майстер зупинив вас дорогою до «${t.destinationName}»`)];
    } else if (token?.requested) {
      content = [
        el('span', {}, '🙋 Чекаємо дозволу майстра на подорож'),
        button('Скасувати', 'btn--ghost', () => travelState.stop()),
      ];
    } else if (arrivedText) {
      content = [el('span', {}, arrivedText)];
    }

    root.replaceChildren(...(content ?? []));
    root.hidden = !content;
    root.classList.toggle('travel-status--arrived', !!arrivedText && !t && !token?.requested);

    // Поки в дорозі — оновлюємо «залишилось» раз на кілька секунд.
    clearTimeout(timer);
    if (t?.running) timer = setTimeout(render, 5000);
  }

  socket.on('travel:arrived', ({ characterId, destinationName }) => {
    if (characterId !== characters.active?.id) return;
    arrivedText = `✅ Ви прибули до «${destinationName}»`;
    clearTimeout(arrivedTimer);
    arrivedTimer = setTimeout(() => { arrivedText = ''; render(); }, ARRIVED_SHOW_MS);
    render();
  });

  tokensState.onChange(render);
  characters.onChange(render);
  session.onChange(render);
}
