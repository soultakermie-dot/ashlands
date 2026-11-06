// Ігровий годинник: доба = 1 реальна година (config.clock). Час іде сам;
// зупиняється, коли ДМ зупинив годинник або поставив на паузу всю гру. ДМ може поставити будь-який час.
import { config } from '../config.js';
import { stores } from '../storage/index.js';
import { GameError } from './errors.js';

const MIN_PER_DAY = 24 * 60;
const START = (8 * 60);   // перший запуск: День 1, 08:00

const settings = () => stores.worldSettings.data;
const rate = () => config.clock.realMsPerGameMinute;

// Стан годинника в налаштуваннях світу: { minutes — ігрові хвилини в момент anchorAt, anchorAt — коли пущено (null — стоїть), stopped }.
function clock() {
  settings().clock ??= { minutes: START, anchorAt: Date.now(), stopped: false };
  return settings().clock;
}

const isRunning = () => !clock().stopped && !settings().gamePaused;

export function gameMinutesNow(now = Date.now()) {
  const c = clock();
  return c.minutes + (c.anchorAt && isRunning() ? (now - c.anchorAt) / rate() : 0);
}

// Зафіксувати пройдений час (перед будь-якою зміною стану).
function settle(now) {
  const c = clock();
  c.minutes = gameMinutesNow(now);
  c.anchorAt = isRunning() ? now : null;
}

function save(now) {
  const c = clock();
  c.anchorAt = isRunning() ? now : null;
  stores.worldSettings.save();
}

// Пауза / продовження всієї гри (викликає travel.pauseGame / resumeGame).
export function freezeForGamePause(now = Date.now()) { settle(now); clock().anchorAt = null; stores.worldSettings.save(); }
export function unfreezeAfterGamePause(now = Date.now()) { save(now); }

export function setClockStopped(stopped, now = Date.now()) {
  settle(now);
  clock().stopped = !!stopped;
  save(now);
}

// Поставити час: день (від 1), години 0–23, хвилини 0–59.
export function setGameTime({ day, hour, minute }, now = Date.now()) {
  const d = Number(day);
  const h = Number(hour);
  const m = Number(minute ?? 0);
  if (!Number.isInteger(d) || d < 1 || d > 100000) throw new GameError('День: ціле число від 1');
  if (!Number.isInteger(h) || h < 0 || h > 23) throw new GameError('Година: від 0 до 23');
  if (!Number.isInteger(m) || m < 0 || m > 59) throw new GameError('Хвилини: від 0 до 59');
  clock().minutes = (d - 1) * MIN_PER_DAY + h * 60 + m;
  save(now);
}

// Для клієнта: він сам рахує час далі за швидкістю.
export function clockState(now = Date.now()) {
  return {
    minutes: gameMinutesNow(now),
    running: isRunning(),
    stopped: !!clock().stopped,
    realMsPerGameMinute: rate(),
  };
}
