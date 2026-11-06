// Лист персонажа: форма з полями, які надсилає сервер. Заповнює власник, правити може й ДМ.
import { request } from '../net/request.js';
import { button, el, messageLine } from '../lib/dom.js';

const GROUP_TITLES = { main: '', combat: 'Бій', abilities: 'Характеристики', text: '' };

// Модифікатор характеристики DnD: (значення − 10) / 2, вниз.
const modifier = (score) => {
  if (!Number.isFinite(score)) return '';
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : String(m);
};

export async function renderSheet(container, character) {
  container.replaceChildren(el('p', { class: 'hint' }, 'Завантаження...'));
  const res = await request('sheet:get', { characterId: character.id });
  if (!res.ok) {
    container.replaceChildren(el('p', { class: 'form-message' }, res.error));
    return;
  }

  const message = messageLine();
  const inputs = new Map();
  const form = el('form', { class: 'sheet', novalidate: true });

  const groups = new Map();
  for (const field of res.fields) {
    if (!groups.has(field.group)) groups.set(field.group, []);
    groups.get(field.group).push(field);
  }

  for (const [group, fields] of groups) {
    const box = el('div', { class: `sheet__group sheet__group--${group}` });
    if (GROUP_TITLES[group]) form.append(el('h3', { class: 'sheet__title' }, GROUP_TITLES[group]));
    for (const field of fields) box.append(renderField(field, res.sheet[field.key], inputs));
    form.append(box);
  }

  const save = el('button', { type: 'submit', class: 'btn' }, 'Зберегти');
  form.append(message, el('div', { class: 'form-actions' }, save));

  form.addEventListener('input', () => { form.dataset.dirty = '1'; message.show(''); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const sheet = {};
    for (const [key, input] of inputs) sheet[key] = input.value === '' ? null : (input.type === 'number' ? Number(input.value) : input.value);
    save.disabled = true;
    const r = await request('sheet:update', { characterId: character.id, sheet });
    save.disabled = false;
    if (!r.ok) return message.show(r.error);
    delete form.dataset.dirty;
    message.show('Збережено', 'info');
  });

  container.replaceChildren(form);
}

function renderField(field, value, inputs) {
  let input;
  if (field.type === 'textarea') {
    input = el('textarea', { name: field.key, rows: 3, maxLength: field.max });
    input.value = value ?? '';
  } else if (field.type === 'int') {
    input = el('input', { name: field.key, type: 'number', min: field.min, max: field.max, step: 1, inputMode: 'numeric' });
    input.value = value ?? '';
  } else {
    input = el('input', { name: field.key, maxLength: field.max, autocomplete: 'off' });
    input.value = value ?? '';
  }
  inputs.set(field.key, input);

  // Для характеристик показуємо модифікатор (+2, −1...).
  if (field.group === 'abilities') {
    const mod = el('span', { class: 'sheet__mod' }, modifier(value));
    input.addEventListener('input', () => { mod.textContent = modifier(input.value === '' ? NaN : Number(input.value)); });
    return el('label', { class: 'field sheet__ability' }, el('span', {}, field.label), input, mod);
  }
  return el('label', { class: `field sheet__field sheet__field--${field.type}` }, el('span', {}, field.label), input);
}
