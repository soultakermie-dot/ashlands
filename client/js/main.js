// Точка входу інтерфейсу: запускає всі частини.
import { socket } from './net/socket.js';
import { session } from './state/session.js';
import { showScreen } from './ui/screens.js';
import { initConnectionStatus } from './ui/connectionStatus.js';
import { initServerInfo } from './ui/serverInfo.js';
import { initAuthScreen } from './ui/authScreen.js';
import { initUserBar } from './ui/userBar.js';

initConnectionStatus(socket, document.getElementById('connection-status'));
initServerInfo(socket, document.getElementById('server-info'));
initAuthScreen(document.getElementById('auth-screen'));
initUserBar(document.getElementById('user-bar'));

// Увійшов — головний екран, вийшов — екран входу.
session.onChange((user) => showScreen(user ? 'home' : 'auth'));

// При кожному (пере)підключенні до сервера відновлюємо вхід за токеном.
socket.on('connect', () => session.resume());
