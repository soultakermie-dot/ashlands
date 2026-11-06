// Верхня панель: аватарка й ім'я персонажа, за якого зараз грає гравець.
import { characters } from '../state/characters.js';
import { createAvatar } from './avatar.js';

export function initActiveCharacterBadge(root) {
  characters.onChange(() => {
    const active = characters.active;
    if (!active) {
      root.replaceChildren();
      return;
    }
    const name = document.createElement('span');
    name.textContent = active.name;
    const avatar = createAvatar(active.name, active.avatarUrl, 'sm');
    root.replaceChildren(avatar, name);
  });
}
