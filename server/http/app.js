// HTTP-частина: віддає файли інтерфейсу гри та (без Supabase) завантажені картинки.
import express from 'express';
import { config } from '../config.js';
import path from 'node:path';
import { LOCAL_UPLOADS_DIR, UPLOADS_URL } from '../storage/files.js';

export function createApp() {
  const app = express();

  app.use(express.static(config.paths.client));

  // 3D-рушій Three.js (режим «Будівельник», 3D-міста) — з node_modules.
  app.use('/vendor/three', express.static(path.join(config.paths.root, 'node_modules', 'three'), { fallthrough: false }));

  // У режимі «файли» аватарки лежать у data/uploads/; із Supabase вони віддаються напряму звідти.
  if (!config.supabase.enabled) {
    app.use(UPLOADS_URL, express.static(LOCAL_UPLOADS_DIR, { fallthrough: false }));
  }

  return app;
}
