// Таймер із паузою: { elapsedMs, runningSince (null — стоїть), pausedBy ('dm' | 'game' | null) }.
// Ним користуються подорожі й катакомби, щоб пауза гри зупиняла все однаково.

export function elapsedOf(t, now = Date.now()) {
  return t.elapsedMs + (t.runningSince ? now - t.runningSince : 0);
}

// Поставити на паузу. Повертає true, якщо таймер ішов.
export function pauseTimer(t, by, now = Date.now()) {
  if (!t || !t.runningSince) return false;
  t.elapsedMs = elapsedOf(t, now);
  t.runningSince = null;
  t.pausedBy = by;
  return true;
}

// Продовжити. by='game' продовжує лише те, що зупинила пауза гри (а не ДМ окремо).
export function resumeTimer(t, by, now = Date.now()) {
  if (!t || t.runningSince) return false;
  if (by === 'game' && t.pausedBy !== 'game') return false;
  t.runningSince = now;
  t.pausedBy = null;
  return true;
}
