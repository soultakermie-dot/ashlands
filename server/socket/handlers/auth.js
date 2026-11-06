// Події входу: auth:register, auth:login, auth:resume, auth:logout.
import { markAway, markBack, revoke } from '../../services/admission.js';
import { login, logout, register, resume } from '../../services/auth.js';
import { ROLES } from '../../services/users.js';
import { handle } from '../handle.js';
import { attachUser, currentUser, detachUser, kickUser, onlineUserIds, toSelf } from '../identity.js';
import { broadcastLobby } from './accounts.js';

export function registerAuth(io, socket) {
  const signIn = (user, token) => {
    attachUser(socket, user, token);
    markBack(user.id); // повернувся протягом 10 хв — допуск зберігається
    const self = toSelf(user);
    console.log(`[auth] ${user.login} увійшов (${user.role}${self.admitted ? '' : ', чекає допуску'})`);
    broadcastLobby(io);
    return { token, user: self };
  };

  socket.on('auth:register', handle(({ login: l, password }) => {
    const user = register(l, password);
    console.log(`[auth] новий акаунт: ${user.login}`);
    return { login: user.login };
  }));

  socket.on('auth:login', handle(({ login: l, password }) => {
    const { token, user } = login(l, password);
    return signIn(user, token);
  }));

  socket.on('auth:resume', handle(({ token }) => signIn(resume(token), token)));

  // Вихід: допуск знімається, інші вкладки цього акаунта теж виходять.
  socket.on('auth:logout', handle(async () => {
    const user = currentUser(socket);
    logout(socket.data.token);
    detachUser(socket);
    if (user) {
      if (user.role === ROLES.PLAYER) revoke(user.id);
      await kickUser(io, user.id, '');
      console.log(`[auth] ${user.login} вийшов`);
      broadcastLobby(io);
    }
    return {};
  }));

  // Закрив вкладку / пропав інтернет: якщо це була остання вкладка — починаємо 10-хвилинний відлік.
  socket.on('disconnect', () => {
    const userId = socket.data.userId;
    if (!userId) return;
    if (!onlineUserIds(io, socket).has(userId)) markAway(userId);
    broadcastLobby(io, socket);
  });
}
