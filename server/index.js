// Точка входу: збирає сервер з частин і запускає його.
import { createServer } from 'node:http';
import { config } from './config.js';
import { createApp } from './http/app.js';
import { createSocketServer } from './socket/index.js';
import { flushAll } from './storage/index.js';
import { recordLaunch } from './services/meta.js';
import { markAllAwayOnStartup } from './services/admission.js';

recordLaunch();
markAllAwayOnStartup(); // після перезапуску в гравців є 10 хв, щоб повернутися без нового допуску

const httpServer = createServer(createApp());
createSocketServer(httpServer);

httpServer.listen(config.port, () => {
  console.log(`Ashlands запущено: http://localhost:${config.port}`);
});

// Перед зупинкою дописуємо всі незбережені дані на диск.
function shutdown(signal) {
  console.log(`Зупинка (${signal}), зберігаю дані...`);
  flushAll();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
