// Перевірка завантажених картинок: справді картинка, потрібного формату й розміру.
import { GameError } from './errors.js';

export const IMAGE_MAX_BYTES = 512 * 1024;

// Формат визначаємо за першими байтами файлу, а не за тим, що надіслав браузер.
const SIGNATURES = [
  { type: 'image/webp', ext: 'webp', test: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
  { type: 'image/png', ext: 'png', test: (b) => b.length > 8 && b.readUInt32BE(0) === 0x89504e47 },
  { type: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
];

// Приймає те, що прийшло від клієнта (Buffer / ArrayBuffer), повертає { buffer, type, ext }.
export function readImage(data) {
  let buffer;
  if (Buffer.isBuffer(data)) buffer = data;
  else if (data instanceof ArrayBuffer) buffer = Buffer.from(data);
  else if (ArrayBuffer.isView(data)) buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  else throw new GameError('Картинка не отримана');

  if (buffer.length === 0) throw new GameError('Порожня картинка');
  if (buffer.length > IMAGE_MAX_BYTES) throw new GameError('Картинка завелика (до 512 КБ)');

  const format = SIGNATURES.find((s) => s.test(buffer));
  if (!format) throw new GameError('Підходять лише картинки PNG, JPEG або WebP');
  return { buffer, type: format.type, ext: format.ext };
}
