// Бічна шухляда з панелями (персонажі, вхід у гру). Відкрита/закрита — запам'ятовується.
const STORAGE_KEY = 'ashlands.sidebar';

export function initSidebar(sidebar, toggleButton) {
  function setOpen(open) {
    sidebar.classList.toggle('sidebar--open', open);
    toggleButton.setAttribute('aria-expanded', String(open));
    try { localStorage.setItem(STORAGE_KEY, open ? '1' : '0'); } catch { /* не критично */ }
  }

  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* немає доступу */ }
  setOpen(saved !== '0');

  toggleButton.addEventListener('click', () => setOpen(!sidebar.classList.contains('sidebar--open')));
}
