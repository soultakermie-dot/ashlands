// Запит до сервера з очікуванням відповіді.
// Сервер відповідає { ok: true, ... } або { ok: false, error }.
import { socket } from './socket.js';

const TIMEOUT_MS = 8000;

export async function request(event, payload = {}) {
  try {
    return await socket.timeout(TIMEOUT_MS).emitWithAck(event, payload);
  } catch {
    return { ok: false, error: 'Сервер не відповідає, спробуйте ще раз' };
  }
}
