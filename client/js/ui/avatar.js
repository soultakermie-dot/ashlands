// Кружечок-аватарка: картинка персонажа або перша літера імені.
export function createAvatar(name, avatarUrl, size = 'md') {
  const el = document.createElement('span');
  el.className = `avatar avatar--${size}`;
  if (avatarUrl) {
    const img = document.createElement('img');
    img.src = avatarUrl;
    img.alt = '';
    img.loading = 'lazy';
    el.append(img);
  } else {
    el.textContent = [...name.trim()][0]?.toUpperCase() ?? '?';
  }
  return el;
}
