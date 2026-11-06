// Точка входу інтерфейсу: запускає всі частини.
import { socket } from './net/socket.js';
import { session } from './state/session.js';
import { showScreen } from './ui/screens.js';
import { initConnectionStatus } from './ui/connectionStatus.js';
import { initServerInfo } from './ui/serverInfo.js';
import { initAuthScreen } from './ui/authScreen.js';
import { initUserBar } from './ui/userBar.js';
import { initAccountsPanel } from './ui/accountsPanel.js';

initConnectionStatus(socket, document.getElementById('connection-status'));
initServerInfo(socket, document.getElementById('server-info'));
initAuthScreen(document.getElementById('auth-screen'));
initUserBar();
initAccountsPanel(document.getElementById('accounts-panel'));

// Який екран показати залежно від стану акаунта.
function screenFor(user) {
  if (!user) return 'auth';
  if (user.status === 'pending') return 'pending';
  return 'home';
}

session.onChange((user) => showScreen(screenFor(user)));

// При кожному (пере)підключенні до сервера відновлюємо вхід за токеном.
socket.on('connect', () => session.resume());
