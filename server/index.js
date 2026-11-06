import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const PORT = process.env.PORT || 3000;
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Віддаємо інтерфейс гри (папка client/)
app.use(express.static(path.join(ROOT, 'client')));

// Підключення гравців у реальному часі
io.on('connection', (socket) => {
  console.log(`[+] підключився ${socket.id} (онлайн: ${io.engine.clientsCount})`);
  io.emit('online', io.engine.clientsCount);

  socket.on('disconnect', () => {
    console.log(`[-] відключився ${socket.id} (онлайн: ${io.engine.clientsCount})`);
    io.emit('online', io.engine.clientsCount);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Ashlands запущено: http://localhost:${PORT}`);
});
