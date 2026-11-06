// HTTP-частина: віддає файли інтерфейсу гри.
import express from 'express';
import { config } from '../config.js';

export function createApp() {
  const app = express();

  app.use(express.static(config.paths.client));

  return app;
}
