// Загальні налаштування сервера: порт і шляхи до папок.
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  port: Number(process.env.PORT) || 3000,
  paths: {
    root: ROOT,
    client: path.join(ROOT, 'client'),
    data: path.join(ROOT, 'data'),
  },
};
