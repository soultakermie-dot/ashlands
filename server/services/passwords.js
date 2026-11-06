// Шифрування паролів (scrypt, вбудований у Node.js). Сам пароль ніде не зберігається.
import crypto from 'node:crypto';

const KEY_LENGTH = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(password, salt, KEY_LENGTH);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
