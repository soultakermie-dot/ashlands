// Лист персонажа та інвентар у вікні. Гравець бачить своїх персонажів, ДМ — будь-кого.
// Зверху — шапка з персонажем і перемикач «Лист / Інвентар».
import { socket } from '../net/socket.js';
import { el } from '../lib/dom.js';
import { characters } from '../state/characters.js';
import { createAvatar } from './avatar.js';
import { renderInventory } from './inventoryView.js';
import { onModalChange, openModal } from './modal.js';
import { renderSheet } from './sheetView.js';

const STATUS_TEXT = { pending: 'Чекає підтвердження ДМ', approved: 'Підтверджений', rejected: 'ДМ відхилив' };

// Відкрити лист або інвентар конкретного персонажа (без персонажа — вибраний гравцем).
export function openCharacterView(view, character) {
  openModal(view, { character });
}

export function initCharacterDetails(modalRoot) {
  const targets = {
    sheet: modalRoot.querySelector('[data-character-sheet]'),
    inventory: modalRoot.querySelector('[data-character-inventory]'),
  };
  let shown = { view: null, character: null };

  const characterOf = () => shown.character ?? characters.active;

  onModalChange((view, context) => {
    shown = (view === 'sheet' || view === 'inventory') ? { view, character: context.character ?? null } : { view: null, character: null };
    if (shown.view) render();
  });

  // Гравець змінив вибраного персонажа, поки вікно відкрите.
  characters.onChange(() => { if (shown.view && !shown.character) render(); });

  // Хтось змінив лист / інвентар цього персонажа (ДМ видав предмет, передали золото...).
  socket.on('character:changed', ({ characterId, what }) => {
    const current = characterOf();
    if (!current || shown.view !== what) return;
    if (characterId !== '*' && characterId !== current.id) return;
    // Не перебиваємо гравця, який саме редагує лист.
    if (what === 'sheet' && targets.sheet.querySelector('form[data-dirty]')) return;
    render();
  });

  function render() {
    const target = targets[shown.view];
    const character = characterOf();
    if (!character) {
      target.replaceChildren(el('p', { class: 'hint' }, 'Спершу виберіть персонажа в розділі «🧙 Персонажі».'));
      return;
    }
    const body = el('div');
    target.replaceChildren(header(character, shown.view), body);
    if (shown.view === 'sheet') renderSheet(body, character);
    else renderInventory(body, character);
  }

  function header(character, view) {
    const switchTo = (v) => openModal(v, { character: shown.character });
    return el('div', { class: 'character-header' },
      createAvatar(character.name, character.avatarUrl, 'lg'),
      el('div', {},
        el('strong', { class: 'character-header__name' }, character.name),
        el('span', { class: 'hint' }, [character.ownerName && `гравець: ${character.ownerName}`, STATUS_TEXT[character.status]].filter(Boolean).join(' · ')),
        el('div', { class: 'character-header__tabs' },
          el('button', { type: 'button', class: `tab-link${view === 'sheet' ? ' tab-link--active' : ''}`, onclick: () => switchTo('sheet') }, '📜 Лист'),
          el('button', { type: 'button', class: `tab-link${view === 'inventory' ? ' tab-link--active' : ''}`, onclick: () => switchTo('inventory') }, '🎒 Інвентар'))));
  }
}
