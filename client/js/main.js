// Точка входу інтерфейсу: запускає всі частини.
import { socket } from './net/socket.js';
import { initConnectionStatus } from './ui/connectionStatus.js';

initConnectionStatus(socket, document.getElementById('connection-status'));
