// Одне спільне підключення до сервера для всієї програми.
import { io } from '/socket.io/socket.io.esm.min.js';

export const socket = io();
