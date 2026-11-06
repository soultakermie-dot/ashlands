// Точка входу інтерфейсу: запускає всі частини.
import { socket } from './net/socket.js';
import { session } from './state/session.js';
import { showScreen } from './ui/screens.js';
import { initConnectionStatus } from './ui/connectionStatus.js';
import { initServerInfo } from './ui/serverInfo.js';
import { initAuthScreen } from './ui/authScreen.js';
import { initUserBar } from './ui/userBar.js';
import { initAccountsPanel } from './ui/accountsPanel.js';
import { initCharactersPanel } from './ui/charactersPanel.js';
import { initCharacterReviewPanel } from './ui/characterReviewPanel.js';

initConnectionStatus(socket, document.getElementById('connection-status'));
initServerInfo(socket, document.getElementById('server-info'));
initAuthScreen(document.getElementById('auth-screen'));
initUserBar();
initAccountsPanel(document.getElementById('accounts-panel'));
initCharactersPanel(document.getElementById('characters-panel'));
initCharacterReviewPanel(document.getElementById('character-review-panel'));

// Не увійшов — вхід; увійшов, але ДМ ще не пустив — очікування; інакше — гра.
function screenFor(user) {
  if (!user) return 'auth';
  return user.admitted ? 'home' : 'waiting';
}

session.onChange((user) => showScreen(screenFor(user)));

// При кожному (пере)підключенні до сервера відновлюємо вхід за токеном.
socket.on('connect', () => session.resume());
