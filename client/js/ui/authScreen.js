// Екран входу та реєстрації.
import { session } from '../state/session.js';

export function initAuthScreen(root) {
  const form = root.querySelector('form');
  const tabs = root.querySelectorAll('[data-mode]');
  const submit = form.querySelector('button[type="submit"]');
  const repeatField = form.querySelector('[data-field="repeat"]');
  const displayNameField = form.querySelector('[data-field="display-name"]');
  const messageBox = root.querySelector('.form-message');

  let mode = 'login';

  function setMode(next) {
    mode = next;
    for (const tab of tabs) tab.classList.toggle('tab--active', tab.dataset.mode === mode);
    repeatField.hidden = mode !== 'register';
    displayNameField.hidden = mode !== 'register';
    form.elements.repeat.required = mode === 'register';
    form.elements.displayName.required = mode === 'register';
    form.elements.password.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    submit.textContent = mode === 'register' ? 'Створити акаунт' : 'Увійти';
    showMessage('');
  }

  // kind: 'error' (червоне) або 'info' (зелене).
  function showMessage(text, kind = 'error') {
    messageBox.textContent = text;
    messageBox.hidden = !text;
    messageBox.classList.toggle('form-message--info', kind === 'info');
  }

  for (const tab of tabs) tab.addEventListener('click', () => setMode(tab.dataset.mode));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = form.elements.login.value.trim();
    const password = form.elements.password.value;

    if (mode === 'register' && password !== form.elements.repeat.value) {
      showMessage('Паролі не збігаються');
      return;
    }

    submit.disabled = true;
    showMessage('');

    if (mode === 'register') {
      const res = await session.register(login, password, form.elements.displayName.value);
      submit.disabled = false;
      if (!res.ok) return showMessage(res.error);
      // Акаунт створено — переходимо на вхід з уже вписаним логіном.
      form.reset();
      setMode('login');
      form.elements.login.value = res.login;
      form.elements.password.focus();
      showMessage('Акаунт створено. Тепер увійдіть.', 'info');
      return;
    }

    const res = await session.login(login, password);
    submit.disabled = false;
    if (res.ok) form.reset();
    else showMessage(res.error);
  });

  // Якщо користувача повернуло на вхід — показуємо причину.
  session.onChange((user) => {
    if (user) return;
    const notice = session.takeNotice();
    if (notice) showMessage(notice);
  });

  setMode('login');
}
