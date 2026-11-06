// Події входу: auth:register, auth:login, auth:resume, auth:logout.
import { login, logout, register, resume } from '../../services/auth.js';
import { STATUS, findUserById } from '../../services/users.js';
import { handle } from '../handle.js';
import { attachUser, currentUser, detachUser } from '../identity.js';
import { broadcastPlayers } from './accounts.js';

export function registerAuth(io, socket) {
  const signIn = ({ token, user }) => {
    attachUser(socket, findUserById(user.id), token);
    console.log(`[auth] ${user.login} (${user.role}, ${user.status}) увійшов`);
    return { token, user };
  };

  socket.on('auth:register', handle(({ login: l, password }) => {
    const result = signIn(register(l, password));
    if (result.user.status === STATUS.PENDING) broadcastPlayers(io); // ДМ бачить нову заявку
    return result;
  }));

  socket.on('auth:login', handle(({ login: l, password }) => signIn(login(l, password))));
  socket.on('auth:resume', handle(({ token }) => signIn({ token, user: resume(token) })));

  socket.on('auth:logout', handle(() => {
    const user = currentUser(socket);
    logout(socket.data.token);
    if (user) console.log(`[auth] ${user.login} вийшов`);
    detachUser(socket);
    return {};
  }));
}
