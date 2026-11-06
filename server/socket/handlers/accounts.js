// Панель ДМ «Гравці»: accounts:list, accounts:approve, accounts:reject, accounts:block.
import { approve, block, listPlayers, reject } from '../../services/accounts.js';
import { findUserById } from '../../services/users.js';
import { handle } from '../handle.js';
import { DM_ROOM, kickUser, pushUserUpdate, requireDm } from '../identity.js';

// Розіслати всім ДМ свіжий список гравців.
export function broadcastPlayers(io) {
  io.to(DM_ROOM).emit('accounts:list', listPlayers());
}

export function registerAccounts(io, socket) {
  // Перевіряє права ДМ, виконує дію й пише в журнал лише успішні дії.
  const dmAction = (label, action) => handle(async ({ userId }) => {
    const dm = requireDm(socket);
    const login = findUserById(userId)?.login;
    await action(userId);
    console.log(`[accounts] ${dm.login}: ${label} ${login}`);
    broadcastPlayers(io);
    return {};
  });

  socket.on('accounts:list', handle(() => {
    requireDm(socket);
    return { players: listPlayers() };
  }));

  socket.on('accounts:approve', dmAction('пустив', (userId) => {
    pushUserUpdate(io, approve(userId));
  }));

  socket.on('accounts:reject', dmAction('не пустив', async (userId) => {
    reject(userId);
    await kickUser(io, userId, 'Майстер відхилив вашу заявку. Можете зареєструватися знову.');
  }));

  socket.on('accounts:block', dmAction('вигнав', async (userId) => {
    block(userId);
    await kickUser(io, userId, 'Ваш акаунт заблоковано майстром.');
  }));
}
