// ДМ: кнопка «⏸ Пауза гри / ▶ Продовжити гру» у лівій панелі (ігровий режим). Гравці бачать «Гра на паузі».
import { button } from '../lib/dom.js';
import { editor } from '../state/editorMode.js';
import { session } from '../state/session.js';
import { travelState } from '../state/travel.js';

export function initGamePauseControl(root, { onMessage }) {
  function render() {
    const show = session.user?.role === 'dm' && editor.mode === 'game';
    root.hidden = !show;
    document.body.classList.toggle('is-game-paused', travelState.gamePaused);
    if (!show) return;
    const paused = travelState.gamePaused;
    root.replaceChildren(button(
      paused ? '▶ Продовжити гру' : '⏸ Пауза гри',
      paused ? 'btn--ok' : 'btn--ghost',
      async () => {
        const r = await (paused ? travelState.resumeGame() : travelState.pauseGame());
        if (!r.ok) onMessage(r.error);
      },
      paused ? 'Усі знову рушать' : 'Зупинити всіх, хто в дорозі (і час — коли з\'явиться годинник)',
    ));
  }
  travelState.onChange(render);
  editor.onChange(render);
  session.onChange(render);
}
