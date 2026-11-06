// Точка входу: збирає сервер з частин і запускає його.
import { createServer } from 'node:http';
import { config } from './config.js';
import { createApp } from './http/app.js';
import { createSocketServer } from './socket/index.js';
import { flushAll, storageBackend } from './storage/index.js';
import { recordLaunch } from './services/meta.js';
import { markAllAwayOnStartup } from './services/admission.js';
import { seedWorldOnce } from './services/world.js';

recordLaunch();
markAllAwayOnStartup(); // після перезапуску в гравців є 10 хв, щоб повернутися без нового допуску
seedWorldOnce();        // за чистої бази — тестові міста й дороги

const httpServer = createServer(createApp());
createSocketServer(httpServer);

httpServer.listen(config.port, () => {
  const where = storageBackend === 'supabase' ? 'Supabase' : 'файли в папці data/';
  console.log(`Ashlands запущено: http://localhost:${config.port} (дані: ${where})`);
});

// Перед зупинкою дописуємо всі незбережені дані.
let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`Зупинка (${signal}), зберігаю дані...`);
  await flushAll();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
