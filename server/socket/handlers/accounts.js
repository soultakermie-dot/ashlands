// Панель ДМ «Вхід у гру»: accounts:lobby, accounts:admit, accounts:reject, accounts:kick, accounts:note.
import { config } from '../../config.js';
import { expireAway } from '../../services/admission.js';
import { buildLobby, letIn, sendToLogin, updateNote } from '../../services/accounts.js';
import { findUserById } from '../../services/users.js';
import { handle } from '../handle.js';
import { DM_ROOM, kickUser, onlineUserIds, pushSelf, refreshGameRoom, requireDm } from '../identity.js';
import { scheduleGameUpdate } from '../broadcast.js';

// Розіслати всім ДМ свіжий стан: хто проситься, хто в грі.
export function broadcastLobby(io, exceptSocket = null) {
  io.to(DM_ROOM).emit('accounts:lobby', buildLobby(onlineUserIds(io, exceptSocket)));
}

// Періодично знімаємо допуск з тих, хто відсутній довше ліміту.
export function startAwayExpiry(io) {
  setInterval(() => {
    const expired = expireAway();
    if (!expired.length) return;
    for (const id of expired) console.log(`[accounts] ${findUserById(id)?.login ?? id}: відсутній довше ліміту, допуск знято`);
    broadcastLobby(io);
    scheduleGameUpdate(io);
  }, config.admission.expiryCheckMs).unref();
}

export function registerAccounts(io, socket) {
  // Перевіряє права ДМ, виконує дію, пише в журнал лише успішні дії й оновлює панель.
  const dmAction = (label, action) => handle(async (payload) => {
    const dm = requireDm(socket);
    const login = findUserById(payload.userId)?.login;
    await action(payload);
    if (label) console.log(`[accounts] ${dm.login}: ${label} ${login}`);
    broadcastLobby(io);
    scheduleGameUpdate(io);
    return {};
  });

  socket.on('accounts:lobby', handle(() => {
    requireDm(socket);
    return buildLobby(onlineUserIds(io));
  }));

  socket.on('accounts:admit', dmAction('пустив', ({ userId }) => {
    const user = letIn(userId);
    refreshGameRoom(io, user);
    pushSelf(io, user);
  }));

  socket.on('accounts:reject', dmAction('не пустив', async ({ userId }) => {
    sendToLogin(userId);
    await kickUser(io, userId, 'Майстер вас не пустив.');
  }));

  socket.on('accounts:kick', dmAction('вигнав', async ({ userId }) => {
    sendToLogin(userId);
    await kickUser(io, userId, 'Майстер вигнав вас з гри.');
  }));

  socket.on('accounts:note', dmAction(null, ({ userId, note }) => {
    updateNote(userId, note);
  }));
}
