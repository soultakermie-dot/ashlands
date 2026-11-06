// Обгортка для подій з відповіддю: ловить помилки й завжди відповідає клієнту.
// Відповідь: { ok: true, ...результат } або { ok: false, error }.
import { GameError } from '../services/errors.js';

export function handle(fn) {
  return async (payload, reply) => {
    if (typeof reply !== 'function') return;
    try {
      reply({ ok: true, ...(await fn(payload ?? {})) });
    } catch (err) {
      if (!(err instanceof GameError)) console.error('[socket]', err);
      reply({ ok: false, error: err instanceof GameError ? err.message : 'Помилка сервера', ...(err.code ? { code: err.code } : {}) });
    }
  };
}
