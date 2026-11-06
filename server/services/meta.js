// Службова інформація про сервер: скільки разів запускався і коли.
import { stores } from '../storage/index.js';

export function recordLaunch() {
  const meta = stores.meta.data;
  const now = new Date().toISOString();
  meta.launches += 1;
  meta.firstLaunchAt ??= now;
  meta.lastLaunchAt = now;
  stores.meta.save();
}

export function getServerInfo() {
  const { launches, firstLaunchAt, lastLaunchAt } = stores.meta.data;
  return { launches, firstLaunchAt, lastLaunchAt };
}
