// Лист персонажа та інвентар у вікні. Поки — шапка з персонажем і заглушка (наповнимо на етапі 4).
// Гравець бачить свого вибраного персонажа (або того, на кого клікнув), ДМ — будь-кого.
import { characters } from '../state/characters.js';
import { createAvatar } from './avatar.js';
import { onModalChange, openModal } from './modal.js';

const STATUS_TEXT = { pending: 'Чекає підтвердження ДМ', approved: 'Підтверджений', rejected: 'ДМ відхилив' };

// Відкрити лист або інвентар конкретного персонажа.
export function openCharacterView(view, character) {
  openModal(view, { character });
}

export function initCharacterDetails(modalRoot) {
  const sheet = modalRoot.querySelector('[data-character-sheet]');
  const inventory = modalRoot.querySelector('[data-character-inventory]');
  let shown = { view: null, character: null };

  onModalChange((view, context) => {
    if (view !== 'sheet' && view !== 'inventory') {
      shown = { view: null, character: null };
      return;
    }
    shown = { view, character: context.character ?? null };
    render();
  });

  // Якщо гравець змінив персонажа, поки вікно відкрите, — оновлюємо.
  characters.onChange(() => { if (shown.view) render(); });

  function render() {
    const character = shown.character ?? characters.active;
    const target = shown.view === 'sheet' ? sheet : inventory;
    if (!character) {
      target.replaceChildren(note('Спершу виберіть персонажа в розділі «🧙 Персонажі».'));
      return;
    }
    const soon = shown.view === 'sheet'
      ? 'Лист персонажа (характеристики) з\'явиться на наступному етапі.'
      : 'Інвентар (предмети й золото) з\'явиться на наступному етапі.';
    target.replaceChildren(header(character), note(soon));
  }
}

function header(character) {
  const wrap = document.createElement('div');
  wrap.className = 'character-header';
  const info = document.createElement('div');
  const name = document.createElement('strong');
  name.className = 'character-header__name';
  name.textContent = character.name;
  const meta = document.createElement('span');
  meta.className = 'hint';
  meta.textContent = [character.ownerName && `гравець: ${character.ownerName}`, STATUS_TEXT[character.status]]
    .filter(Boolean).join(' · ');
  info.append(name, meta);
  wrap.append(createAvatar(character.name, character.avatarUrl, 'lg'), info);
  return wrap;
}

function note(text) {
  const p = document.createElement('p');
  p.className = 'hint character-placeholder';
  p.textContent = text;
  return p;
}
