// Гравець у катакомбах: замість карти — темний екран з факелом. Поки що без 3D (етап 8).
// Після виходу вгорі карти на кілька секунд — «Ви вибрались з катакомб».
import { el } from '../lib/dom.js';
import { dungeonsState } from '../state/dungeons.js';
import { session } from '../state/session.js';

const NOTICE_MS = 7000;

export function initDungeonOverlay(root, noticeRoot) {
  let timer = 0;

  function render() {
    const d = session.user?.role === 'player' ? dungeonsState.mine : null;
    document.body.classList.toggle('is-in-dungeon', !!d);
    root.hidden = !d;
    if (d) {
      root.replaceChildren(
        el('div', { class: 'dungeon-screen__torch' }, '🔥'),
        el('h2', { class: 'dungeon-screen__title' }, `Катакомби «${d.dungeonName}»`),
        el('p', { class: 'dungeon-screen__text' }, d.running
          ? 'Ваш загін блукає темними тунелями… Відлуння кроків, запах вогкості й старих кісток.'
          : '⏸ Майстер зупинив вас у тунелях.'),
        el('p', { class: 'hint' }, 'Ви не знаєте, скільки ще йти. Майстер скаже, коли знайдете вихід.'),
      );
    }

    const notice = dungeonsState.takeNotice();
    if (notice) {
      noticeRoot.textContent = notice;
      noticeRoot.hidden = false;
      clearTimeout(timer);
      timer = setTimeout(() => { noticeRoot.hidden = true; }, NOTICE_MS);
    }
  }

  dungeonsState.onChange(render);
  session.onChange(render);
}
