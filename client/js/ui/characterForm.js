// Форма «Новий персонаж»: ім'я + аватарка з попереднім переглядом.
import { prepareAvatar } from '../lib/avatarImage.js';
import { characters } from '../state/characters.js';

export function initCharacterForm(root, { onDone }) {
  const form = root.querySelector('form');
  const fileInput = form.elements.avatar;
  const preview = root.querySelector('[data-avatar-preview]');
  const message = root.querySelector('.form-message');
  const submit = form.querySelector('button[type="submit"]');

  let avatar = null; // { data, previewUrl }

  function showMessage(text) {
    message.textContent = text;
    message.hidden = !text;
  }

  function setAvatar(next) {
    if (avatar?.previewUrl) URL.revokeObjectURL(avatar.previewUrl);
    avatar = next;
    preview.replaceChildren();
    if (avatar) {
      const img = document.createElement('img');
      img.src = avatar.previewUrl;
      img.alt = '';
      preview.append(img);
    } else {
      preview.textContent = '+';
    }
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    showMessage('');
    try {
      setAvatar(await prepareAvatar(file));
    } catch (err) {
      setAvatar(null);
      showMessage(err.message);
    }
    fileInput.value = '';
  });

  root.querySelector('[data-avatar-clear]').addEventListener('click', () => setAvatar(null));
  root.querySelector('[data-cancel]').addEventListener('click', () => close());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submit.disabled = true;
    showMessage('');
    const res = await characters.create(form.elements.name.value, avatar?.data ?? null);
    submit.disabled = false;
    if (!res.ok) return showMessage(res.error);
    close();
  });

  function open() {
    form.reset();
    setAvatar(null);
    showMessage('');
    root.hidden = false;
    form.elements.name.focus();
  }

  function close() {
    root.hidden = true;
    setAvatar(null);
    onDone?.();
  }

  setAvatar(null);
  return { open, close };
}
