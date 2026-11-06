// Годинник у верхній панелі («🕰 День 3 · 14:20 ☀») і затемнення карти вночі.
import { clockState, dayPhase, splitTime } from '../state/clock.js';

const NIGHT_ALPHA = 0.55;   // наскільки темна карта в глуху ніч
const TICK_MS = 1000;

export function initClockDisplay(label, nightOverlay) {
  function tick() {
    const minutes = clockState.minutesNow();
    if (minutes === null) { label.hidden = true; return; }
    const { day, hour, minute } = splitTime(minutes);
    const phase = dayPhase(minutes);
    const s = clockState.state;
    label.hidden = false;
    label.textContent = `${phase.icon} День ${day} · ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}${s.running ? '' : ' ⏸'}`;
    label.title = `${phase.name}${s.stopped ? ' · годинник зупинено' : !s.running ? ' · гра на паузі' : ''}`;
    nightOverlay.style.opacity = String(phase.dark * NIGHT_ALPHA);
  }
  clockState.onChange(tick);
  setInterval(tick, TICK_MS);
}
