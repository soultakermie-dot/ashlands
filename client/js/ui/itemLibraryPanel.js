// ДМ: бібліотека предметів — створити, змінити, видалити. Видача персонажам — в їхньому інвентарі.
import { prepareAvatar } from '../lib/avatarImage.js';
import { button, el, messageLine } from '../lib/dom.js';
import { itemsState } from '../state/items.js';

const KIND_TEXT = {
  common: 'Звичайний — складається в стопку (зілля, стріли, їжа)',
  special: 'Особливий — кожен окремо (зброя, броня, артефакти)',
};

export function initItemLibraryPanel(root) {
  const listEl = root.querySelector('[data-items]');
  const formBox = root.querySelector('[data-item-form]');
  const createBtn = root.querySelector('[data-create-item]');
  const message = messageLine();
  root.querySelector('[data-items-message]').replaceWith(message);

  createBtn.addEventListener('click', () => openForm(null));

  itemsState.onChange(render);

  function render(items) {
    if (!items.length) {
      listEl.replaceChildren(el('li', { class: 'hint' }, 'Предметів ще нема. Створіть перший.'));
      return;
    }
    listEl.replaceChildren(...items.map((item) => el('li', { class: `inv-item${item.kind === 'special' ? ' inv-item--special' : ''}` },
      item.imageUrl
        ? el('img', { class: 'inv-item__img', src: item.imageUrl, alt: '', loading: 'lazy' })
        : el('span', { class: 'inv-item__img inv-item__img--empty' }, item.kind === 'special' ? '⚔' : '🧪'),
      el('div', { class: 'inv-item__info' },
        el('div', { class: 'inv-item__title' }, el('strong', {}, item.name),
          el('span', { class: 'inv-item__kind' }, item.kind === 'special' ? 'особливий' : 'звичайний')),
        item.description ? el('p', { class: 'inv-item__desc' }, item.description) : null,
        item.stats ? el('p', { class: 'inv-item__stats' }, item.stats) : null),
      el('div', { class: 'inv-item__actions' },
        button('Змінити', 'btn--ghost', () => openForm(item)),
        button('Видалити', 'btn--bad', async () => {
          if (!window.confirm(`Видалити «${item.name}» з бібліотеки? Він зникне й з інвентарів усіх персонажів.`)) return;
          const r = await itemsState.remove(item.id);
          message.show(r.ok ? '' : r.error);
        })))));
  }

  // Форма створення / редагування предмета.
  function openForm(item) {
    createBtn.hidden = true;
    let image = null;          // нова картинка { data, previewUrl }
    let removeImage = false;

    const name = el('input', { maxLength: 60, required: true, autocomplete: 'off' });
    name.value = item?.name ?? '';
    const kinds = Object.entries(KIND_TEXT).map(([value, text]) => {
      const radio = el('input', { type: 'radio', name: 'kind', value });
      radio.checked = (item?.kind ?? 'common') === value;
      return el('label', { class: 'item-kind' }, radio, el('span', {}, text));
    });
    const description = el('textarea', { rows: 2, maxLength: 1000 });
    description.value = item?.description ?? '';
    const stats = el('textarea', { rows: 2, maxLength: 1000, placeholder: 'Наприклад: 1к8 рубаючої, +1 до атаки' });
    stats.value = item?.stats ?? '';

    const preview = el('span', { class: 'avatar avatar--lg item-preview' });
    const setPreview = (url) => preview.replaceChildren(url ? el('img', { src: url, alt: '' }) : '🧪');
    setPreview(item?.imageUrl ?? null);
    const file = el('input', { type: 'file', accept: 'image/*', hidden: true });
    file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      try {
        image = await prepareAvatar(file.files[0]);
        removeImage = false;
        setPreview(image.previewUrl);
      } catch (err) { formMessage.show(err.message); }
      file.value = '';
    });

    const formMessage = messageLine();
    const form = el('form', { class: 'form', novalidate: true },
      el('div', { class: 'avatar-picker' }, preview,
        el('div', { class: 'avatar-picker__hint' },
          el('label', { class: 'btn btn--small btn--ghost' }, 'Вибрати картинку', file),
          button('Без картинки', 'btn--ghost', () => { image = null; removeImage = true; setPreview(null); }))),
      el('label', { class: 'field' }, el('span', {}, 'Назва'), name),
      el('fieldset', { class: 'item-kinds' }, el('legend', {}, 'Тип'), kinds),
      el('label', { class: 'field' }, el('span', {}, 'Опис'), description),
      el('label', { class: 'field' }, el('span', {}, 'Характеристики'), stats),
      formMessage,
      el('div', { class: 'form-actions' },
        button('Скасувати', 'btn--ghost', close),
        el('button', { type: 'submit', class: 'btn' }, item ? 'Зберегти' : 'Створити')));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        name: name.value,
        kind: form.querySelector('input[name="kind"]:checked')?.value,
        description: description.value,
        stats: stats.value,
        ...(image ? { image: image.data } : {}),
        ...(removeImage ? { removeImage: true } : {}),
      };
      const r = item ? await itemsState.update(item.id, data) : await itemsState.create(data);
      if (!r.ok) return formMessage.show(r.error);
      close();
      message.show(item ? 'Збережено' : `Предмет «${r.item.name}» створено`, 'info');
    });

    function close() {
      if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
      formBox.replaceChildren();
      formBox.hidden = true;
      createBtn.hidden = false;
    }

    formBox.replaceChildren(el('h3', { class: 'sheet__title' }, item ? `Змінити «${item.name}»` : 'Новий предмет'), form);
    formBox.hidden = false;
    name.focus();
  }
}
