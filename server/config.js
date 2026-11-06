// Загальні налаштування сервера: порт, шляхи до папок, база даних, правила гри.
// Секрети (ключі Supabase) беруться з файлу .env — див. .env.example.
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MINUTE = 60 * 1000;

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY?.trim();

export const config = {
  port: Number(process.env.PORT) || 3000,
  paths: {
    root: ROOT,
    client: path.join(ROOT, 'client'),
    data: path.join(ROOT, 'data'),
  },
  supabase: {
    enabled: Boolean(supabaseUrl && supabaseSecretKey),
    url: supabaseUrl,
    secretKey: supabaseSecretKey,
  },
  travel: {
    // Скільки мілісекунд іде 1 піксель карти (0.5 с ≈ сусіднє місто за 5 хв).
    msPerPixel: 500,
    // Найкоротша й найдовша подорож.
    minMs: 5 * MINUTE,
    maxMs: 20 * MINUTE,
    // Для тестів: TRAVEL_TIME_SCALE=0.01 — усі подорожі в 100 разів швидші.
    timeScale: Number(process.env.TRAVEL_TIME_SCALE) || 1,
  },
  admission: {
    // Скільки гравець може бути відсутнім, не втрачаючи допуску ДМ.
    awayLimitMs: Number(process.env.AWAY_LIMIT_MS) || 10 * MINUTE,
    // Як часто перевіряти, чи хтось перевищив ліміт.
    expiryCheckMs: Number(process.env.EXPIRY_CHECK_MS) || 30 * 1000,
  },
};
