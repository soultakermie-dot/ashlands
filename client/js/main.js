// Точка входу інтерфейсу: запускає всі частини.
import { socket } from './net/socket.js';
import { initConnectionStatus } from './ui/connectionStatus.js';
import { initServerInfo } from './ui/serverInfo.js';

initConnectionStatus(socket, document.getElementById('connection-status'));
initServerInfo(socket, document.getElementById('server-info'));
