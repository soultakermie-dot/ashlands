// Підготовка аватарки в браузері: обрізаємо до квадрата по центру, зменшуємо й стискаємо.
// Так на сервер іде маленький файл (зазвичай 10–40 КБ), і програма лишається легкою.
export const AVATAR_SIZE = 256;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

export async function prepareAvatar(file) {
  if (!file.type.startsWith('image/')) throw new Error('Це не картинка');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('Картинка завелика (до 15 МБ)');

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Не вдалося відкрити картинку');
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side,
    0, 0, AVATAR_SIZE, AVATAR_SIZE,
  );
  bitmap.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
  if (!blob) throw new Error('Не вдалося обробити картинку');
  return { data: await blob.arrayBuffer(), previewUrl: URL.createObjectURL(blob) };
}
