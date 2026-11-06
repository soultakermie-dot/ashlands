// ДМ: «💀 Катакомби» — хто зараз у катакомбах, скільки лишилось, пауза, випустити, де вийдуть.
// А також вікно «Завести в підземелля» (з картки підземелля).
import { button, el, messageLine } from '../lib/dom.js';
import { dungeonsState } from '../state/dungeons.js';
import { formatDuration } from '../state/travel.js';
import { closeModal, onModalChange, openModal } from './modal.js';

const EXIT_TEXT = {
  random: '🎲 Випадково біля підземелля (усі разом)',
  entry: '🚪 Там, де зайшли',
  point: '📍 У вибраній точці (усі разом)',
  scatter: '💥 Розкид: кожного в випадкову точку',
};

export function openDungeonEnter(dungeon) {
  openModal('dungeon-enter', { dungeon, title: `🕯 Завести в «${dungeon.name}»` });
}

export function initDungeonsDmPanel(root, enterRoot, { onMessage }) {
  const message = messageLine();
  let tick = 0;

  // ---------- Список походів ----------
  function render() {
    const runs = dungeonsState.runs;
    if (!runs.length) {
      root.replaceChildren(el('p', { class: 'hint' }, 'Зараз у катакомбах нікого. Завести загін — клік по підземеллю на карті → «🕯 Завести в підземелля».'), message);
      return;
    }
    root.replaceChildren(message, ...runs.map(renderRun));
  }

  function renderRun(run) {
    const paused = !run.running;
    const mode = el('select', { class: 'inv-input' }, Object.entries(EXIT_TEXT).map(([v, t]) => el('option', { value: v, selected: run.exit.mode === v }, t)));
    const radius = el('input', { type: 'number', min: 10, max: 2000, step: 10, value: run.exit.radius ?? 200, class: 'inv-input inv-input--num', title: 'Радіус розкиду (пікселі карти)', hidden: run.exit.mode !== 'scatter' });
    mode.addEventListener('change', () => { radius.hidden = mode.value !== 'scatter'; });
    const point = run.exit.point ? `точка ${run.exit.point.x}, ${run.exit.point.y}` : 'точку не вибрано';

    return el('section', { class: 'dm-group' },
      el('div', { class: 'dm-group__head' },
        el('strong', {}, `💀 ${run.dungeonName}`),
        el('span', { class: 'dungeon-run__time', 'data-remaining': run.remainingMs, 'data-running': run.running ? '1' : '' },
          paused ? `⏸ ${run.pausedBy === 'game' ? 'гра на паузі' : 'на паузі'} · ${formatDuration(run.remainingMs)}` : `⏳ ${formatDuration(run.remainingMs)}`)),
      el('p', { class: 'hint' }, `У тунелях: ${run.characters.map((c) => `${c.name} (${c.ownerName})`).join(', ')}`),
      el('div', { class: 'dm-group__actions' },
        paused
          ? button('▶ Продовжити', 'btn--ok', () => act(dungeonsState.resume(run.runId)))
          : button('⏸ Пауза', 'btn--ghost', () => act(dungeonsState.pause(run.runId))),
        button('🚪 Випустити зараз', 'btn--bad', () => act(dungeonsState.release(run.runId)))),
      el('div', { class: 'dungeon-exit' },
        el('span', {}, 'Вихід:'), mode, radius,
        button('Зберегти', 'btn--ghost', () => act(dungeonsState.setExit(run.runId, mode.value, run.exit.point, Number(radius.value)))),
        button('📍 Вибрати точку на карті', 'btn--ghost', () => {
          const m = mode.value === 'point' || mode.value === 'scatter' ? mode.value : 'point';
          dungeonsState.startPicking(run.runId, m, Number(radius.value));
          closeModal();
          onMessage('Клікни на карті, де вийдуть з катакомб (Esc — скасувати)', 'info');
        })),
      ['point', 'scatter'].includes(run.exit.mode) ? el('p', { class: 'hint' }, point) : null);
  }

  async function act(promise) {
    const r = await promise;
    message.show(r.ok ? '' : r.error);
  }

  // Відлік часу на відкритій панелі (без запитів до сервера).
  function countdown() {
    for (const span of root.querySelectorAll('.dungeon-run__time[data-running="1"]')) {
      const left = Math.max(0, Number(span.dataset.remaining) - 1000);
      span.dataset.remaining = left;
      span.textContent = `⏳ ${formatDuration(left)}`;
    }
  }

  dungeonsState.onChange(render);
  clearInterval(tick);
  tick = setInterval(countdown, 1000);
  render();

  // ---------- Вікно «Завести в підземелля» ----------
  onModalChange(async (view, { dungeon }) => {
    if (view !== 'dungeon-enter') return;
    enterRoot.replaceChildren(el('p', { class: 'hint' }, 'Завантаження...'));
    const r = await dungeonsState.near(dungeon.id);
    if (!r.ok) { enterRoot.replaceChildren(el('p', { class: 'form-message' }, r.error)); return; }
    const msg = messageLine();
    const boxes = r.characters.map((c) => {
      const box = el('input', { type: 'checkbox', value: c.characterId, checked: c.distance <= 300 });
      return el('label', { class: 'dungeon-pick' }, box, el('span', {}, `${c.name} `, el('small', { class: 'hint' }, `${c.ownerName} · ${c.distance} м`)));
    });
    enterRoot.replaceChildren(
      el('p', {}, 'Кого завести в катакомби? (позначено тих, хто ближче 300 м)'),
      boxes.length ? el('div', { class: 'dungeon-picks' }, boxes) : el('p', { class: 'hint' }, 'Нікого нема на карті'),
      msg,
      el('div', { class: 'form-actions' },
        button('Скасувати', 'btn--ghost', () => closeModal()),
        button('🕯 Завести', 'btn--ok', async () => {
          const ids = boxes.map((b) => b.querySelector('input')).filter((i) => i.checked).map((i) => i.value);
          const res = await dungeonsState.enter(dungeon.id, ids);
          if (!res.ok) return msg.show(res.error);
          closeModal();
          onMessage(`Загін зайшов у «${dungeon.name}»`, 'info');
        })),
    );
  });
}
