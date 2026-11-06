// Інвентар персонажа: золото й предмети.
// Гравець (зі свого вибраного персонажа) може передавати предмети й золото тим, хто поруч.
// ДМ може видавати й забирати предмети, змінювати золото та характеристики особливих предметів.
import { request } from '../net/request.js';
import { button, el, messageLine } from '../lib/dom.js';
import { characters } from '../state/characters.js';
import { itemsState } from '../state/items.js';
import { session } from '../state/session.js';

export async function renderInventory(container, character) {
  container.replaceChildren(el('p', { class: 'hint' }, 'Завантаження...'));
  const res = await request('inventory:get', { characterId: character.id });
  if (!res.ok) {
    container.replaceChildren(el('p', { class: 'form-message' }, res.error));
    return;
  }

  const isDm = session.user?.role === 'dm';
  const canTransfer = !isDm && characters.active?.id === character.id;
  const message = messageLine();
  const run = async (event, payload) => {
    const r = await request(event, payload);
    message.show(r.ok ? '' : r.error);
    return r.ok;
  };

  // Кому можна передати (лише якщо гравець дивиться свого вибраного персонажа).
  const nearby = canTransfer ? ((await request('inventory:nearby')).characters ?? []) : [];

  // replaceChildren() перетворює null на текст «null», тому порожні частини відкидаємо.
  container.replaceChildren(...[
    renderGold(res.gold, { isDm, canTransfer, nearby, character, run }),
    message,
    isDm ? renderGiveForm(character, run) : null,
    renderEntries(res.entries, { isDm, canTransfer, nearby, run }),
    !isDm && !canTransfer
      ? el('p', { class: 'hint' }, 'Передавати речі можна лише з персонажа, за якого ви зараз граєте.')
      : null,
    canTransfer && !nearby.length
      ? el('p', { class: 'hint' }, 'Поруч нікого нема: передати можна персонажу, який стоїть не далі 100 м.')
      : null,
  ].filter(Boolean));
}

// ---------- Золото ----------
function renderGold(gold, { isDm, canTransfer, nearby, character, run }) {
  const row = el('div', { class: 'inv-gold' }, el('span', { class: 'inv-gold__value' }, `💰 ${gold} золота`));

  if (isDm) {
    const input = el('input', { type: 'number', min: 0, step: 1, value: gold, class: 'inv-input inv-input--num', title: 'Нова кількість золота' });
    row.append(input, button('Змінити', 'btn--ghost', () => run('inventory:setGold', { characterId: character.id, amount: Number(input.value) })));
  } else if (canTransfer && nearby.length && gold > 0) {
    const amount = el('input', { type: 'number', min: 1, max: gold, step: 1, value: 1, class: 'inv-input inv-input--num' });
    const to = recipientSelect(nearby);
    row.append(el('span', { class: 'inv-transfer' }, amount, to,
      button('Передати', 'btn--ghost', () => run('inventory:transferGold', { toCharacterId: to.value, amount: Number(amount.value) }))));
  }
  return row;
}

// ---------- Предмети ----------
function renderEntries(entries, ctx) {
  if (!entries.length) return el('p', { class: 'hint inv-empty' }, 'Інвентар порожній');
  return el('ul', { class: 'inv-list' }, entries.map((entry) => renderEntry(entry, ctx)));
}

function renderEntry(entry, { isDm, canTransfer, nearby, run }) {
  const { item } = entry;
  const special = item.kind === 'special';
  const stats = entry.customStats ?? item.stats;

  const image = item.imageUrl
    ? el('img', { class: 'inv-item__img', src: item.imageUrl, alt: '', loading: 'lazy' })
    : el('span', { class: 'inv-item__img inv-item__img--empty' }, special ? '⚔' : '🧪');

  const info = el('div', { class: 'inv-item__info' },
    el('div', { class: 'inv-item__title' },
      el('strong', {}, item.name),
      entry.quantity > 1 ? el('span', { class: 'inv-item__qty' }, `×${entry.quantity}`) : null,
      special ? el('span', { class: 'inv-item__kind' }, 'особливий') : null),
    item.description ? el('p', { class: 'inv-item__desc' }, item.description) : null,
    stats ? el('p', { class: 'inv-item__stats' }, entry.customStats ? '✨ ' : '', stats) : null,
  );

  const actions = el('div', { class: 'inv-item__actions' });

  if (canTransfer && nearby.length) {
    const qty = el('input', { type: 'number', min: 1, max: entry.quantity, step: 1, value: 1, class: 'inv-input inv-input--num', hidden: entry.quantity === 1 });
    const to = recipientSelect(nearby);
    actions.append(el('span', { class: 'inv-transfer' }, qty, to,
      button('Передати', 'btn--ghost', () => run('inventory:transfer', { toCharacterId: to.value, entryId: entry.id, quantity: Number(qty.value) }))));
  }

  if (isDm) {
    const qty = el('input', { type: 'number', min: 1, max: entry.quantity, step: 1, value: 1, class: 'inv-input inv-input--num', hidden: entry.quantity === 1 });
    actions.append(el('span', { class: 'inv-transfer' }, qty,
      button('Забрати', 'btn--bad', () => run('inventory:remove', { entryId: entry.id, quantity: Number(qty.value) }))));
    if (special) actions.append(button('✨ Характеристики', 'btn--ghost', () => editStats(info, entry, run)));
  }

  return el('li', { class: `inv-item${special ? ' inv-item--special' : ''}` }, image, info, actions);
}

// ДМ: змінити характеристики саме цієї копії особливого предмета.
function editStats(info, entry, run) {
  if (info.querySelector('.inv-stats-form')) return;
  const area = el('textarea', { rows: 2, maxLength: 1000, class: 'inv-input', placeholder: `Як у бібліотеці: ${entry.item.stats || '—'}` });
  area.value = entry.customStats ?? '';
  const form = el('div', { class: 'inv-stats-form' }, area,
    el('div', { class: 'form-actions' },
      button('Скасувати', 'btn--ghost', () => form.remove()),
      button('Зберегти', 'btn--ok', () => run('inventory:setStats', { entryId: entry.id, stats: area.value }))),
    el('p', { class: 'hint' }, 'Порожньо — як у бібліотеці.'));
  info.append(form);
  area.focus();
}

// ДМ: видати предмет з бібліотеки.
function renderGiveForm(character, run) {
  const select = el('select', { class: 'inv-input' });
  const fill = () => {
    select.replaceChildren(...(itemsState.list.length
      ? itemsState.list.map((i) => el('option', { value: i.id }, `${i.name}${i.kind === 'special' ? ' (особливий)' : ''}`))
      : [el('option', { value: '' }, 'Бібліотека порожня — створіть предмет у «🧪 Предмети»')]));
  };
  fill();
  const qty = el('input', { type: 'number', min: 1, step: 1, value: 1, class: 'inv-input inv-input--num' });
  return el('div', { class: 'inv-give' },
    el('span', {}, 'Видати:'), select, qty,
    button('+ Видати', 'btn--ok', () => select.value && run('inventory:give', { characterId: character.id, itemId: select.value, quantity: Number(qty.value) })));
}

function recipientSelect(nearby) {
  return el('select', { class: 'inv-input', title: 'Кому' },
    nearby.map((c) => el('option', { value: c.characterId }, `${c.name} (${c.ownerName}, ${c.distance} м)`)));
}
