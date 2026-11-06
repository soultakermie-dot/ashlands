// Перемикання екранів: показуємо один, решту ховаємо.
// Екран — це елемент з атрибутом data-screen="назва".
export function showScreen(name) {
  for (const el of document.querySelectorAll('[data-screen]')) {
    el.hidden = el.dataset.screen !== name;
  }
}
