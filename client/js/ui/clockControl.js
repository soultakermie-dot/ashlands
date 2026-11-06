// ДМ (ліва панель, ігровий режим): зупинити / пустити годинник, поставити день і час.
import { button, el } from '../lib/dom.js';
import { clockState, splitTime } from '../state/clock.js';
import { editor } from '../state/editorMode.js';
import { session } from '../state/session.js';

export function initClockControl(root, { onMessage }) {
  const day = el('input', { type: 'number', min: 1, step: 1, class: 'inv-input inv-input--num', title: 'День' });
  const time = el('input', { type: 'time', class: 'inv-input', title: 'Час' });
  const form = el('div', { class: 'clock-form', hidden: true }, el('span', {}, 'День'), day, time,
    button('OK', 'btn--ok', async () => {
      const [h, m] = (time.value || '0:0').split(':').map(Number);
      const r = await clockState.set(Number(day.value), h, m);
      if (!r.ok) return onMessage(r.error);
      form.hidden = true;
    }));
  const toggle = el('span');

  root.replaceChildren(el('div', { class: 'clock-control' }, toggle,
    button('🕰 Поставити час', 'btn--ghost', () => {
      const { day: d, hour, minute } = splitTime(clockState.minutesNow() ?? 0);
      day.value = d;
      time.value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      form.hidden = !form.hidden;
    })), form);

  function render() {
    const show = session.user?.role === 'dm' && editor.mode === 'game';
    root.hidden = !show;
    if (!show || !clockState.state) return;
    const stopped = clockState.state.stopped;
    toggle.replaceChildren(button(stopped ? '▶ Пустити годинник' : '⏸ Зупинити годинник', stopped ? 'btn--ok' : 'btn--ghost', async () => {
      const r = await (stopped ? clockState.start() : clockState.stop());
      if (!r.ok) onMessage(r.error);
    }));
  }
  clockState.onChange(render);
  editor.onChange(render);
  session.onChange(render);
}
