// Підключення до Supabase секретним ключем (тільки на сервері, ніколи не в браузері).
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config.js';

export function createSupabaseClient() {
  return createClient(config.supabase.url, config.supabase.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
