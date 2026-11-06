// Події входу: auth:register, auth:login, auth:resume, auth:logout.
// Кожна відповідає через callback: { ok: true, ... } або { ok: false, error }.
import { AuthError, login, logout, register, resume } from '../../services/auth.js';

// Обгортка: ловить помилки й завжди відповідає клієнту.
function handle(fn) {
  return (payload, reply) => {
    if (typeof reply !== 'function') return;
    try {
      reply({ ok: true, ...fn(payload ?? {}) });
    } catch (err) {
      if (!(err instanceof AuthError)) console.error('[auth]', err);
      reply({ ok: false, error: err instanceof AuthError ? err.message : 'Помилка сервера' });
    }
  };
}

export function registerAuth(io, socket) {
  const signIn = ({ token, user }) => {
    socket.data.user = user;
    socket.data.token = token;
    console.log(`[auth] ${user.login} (${user.role}) увійшов`);
    return { token, user };
  };

  socket.on('auth:register', handle(({ login: l, password }) => signIn(register(l, password))));
  socket.on('auth:login', handle(({ login: l, password }) => signIn(login(l, password))));
  socket.on('auth:resume', handle(({ token }) => signIn({ token, user: resume(token) })));

  socket.on('auth:logout', handle(() => {
    logout(socket.data.token);
    if (socket.data.user) console.log(`[auth] ${socket.data.user.login} вийшов`);
    socket.data.user = null;
    socket.data.token = null;
    return {};
  }));
}
