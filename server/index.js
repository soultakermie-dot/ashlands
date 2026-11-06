// Точка входу: збирає сервер з частин і запускає його.
import { createServer } from 'node:http';
import { config } from './config.js';
import { createApp } from './http/app.js';
import { createSocketServer } from './socket/index.js';

const httpServer = createServer(createApp());
createSocketServer(httpServer);

httpServer.listen(config.port, () => {
  console.log(`Ashlands запущено: http://localhost:${config.port}`);
});
