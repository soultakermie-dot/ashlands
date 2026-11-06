// Екран входу та реєстрації.
import { session } from '../state/session.js';

export function initAuthScreen(root) {
  const form = root.querySelector('form');
  const tabs = root.querySelectorAll('[data-mode]');
  const submit = form.querySelector('button[type="submit"]');
  const repeatField = form.querySelector('[data-field="repeat"]');
  const errorBox = root.querySelector('.form-error');

  let mode = 'login';

  function setMode(next) {
    mode = next;
    for (const tab of tabs) tab.classList.toggle('tab--active', tab.dataset.mode === mode);
    repeatField.hidden = mode !== 'register';
    form.elements.repeat.required = mode === 'register';
    form.elements.password.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    submit.textContent = mode === 'register' ? 'Зареєструватися' : 'Увійти';
    showError('');
  }

  function showError(text) {
    errorBox.textContent = text;
    errorBox.hidden = !text;
  }

  for (const tab of tabs) tab.addEventListener('click', () => setMode(tab.dataset.mode));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = form.elements.login.value.trim();
    const password = form.elements.password.value;

    if (mode === 'register' && password !== form.elements.repeat.value) {
      showError('Паролі не збігаються');
      return;
    }

    submit.disabled = true;
    showError('');
    const res = mode === 'register'
      ? await session.register(login, password)
      : await session.login(login, password);
    submit.disabled = false;

    if (res.ok) form.reset();
    else showError(res.error);
  });

  setMode('login');
}
