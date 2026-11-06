// Сховище файлів (аватарки тощо): Supabase Storage або папка data/uploads/.
// put() повертає шлях файлу; urlFor(шлях) — адресу, за якою браузер його покаже.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { createSupabaseClient } from './supabase/client.js';

export const UPLOADS_URL = '/uploads';
const LOCAL_DIR = path.join(config.paths.data, 'uploads');

function localFiles() {
  return {
    async put(bucket, filePath, buffer) {
      const full = path.join(LOCAL_DIR, bucket, filePath);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, buffer);
      return filePath;
    },
    async remove(bucket, filePath) {
      fs.rmSync(path.join(LOCAL_DIR, bucket, filePath), { force: true });
    },
    urlFor: (bucket, filePath) => `${UPLOADS_URL}/${bucket}/${filePath}`,
  };
}

function supabaseFiles() {
  const client = createSupabaseClient();
  return {
    async put(bucket, filePath, buffer, contentType) {
      const { error } = await client.storage.from(bucket).upload(filePath, buffer, { contentType, upsert: true });
      if (error) throw new Error(`Не вдалося завантажити файл у Supabase Storage: ${error.message}`);
      return filePath;
    },
    async remove(bucket, filePath) {
      const { error } = await client.storage.from(bucket).remove([filePath]);
      if (error) console.error(`[files] Не вдалося видалити ${bucket}/${filePath}:`, error.message);
    },
    urlFor: (bucket, filePath) => client.storage.from(bucket).getPublicUrl(filePath).data.publicUrl,
  };
}

export const files = config.supabase.enabled ? supabaseFiles() : localFiles();
export const LOCAL_UPLOADS_DIR = LOCAL_DIR;
