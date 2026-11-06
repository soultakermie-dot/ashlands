// Напис зі статусом підключення та кількістю гравців онлайн.
export function initConnectionStatus(socket, element) {
  const set = (text, ok) => {
    element.textContent = text;
    element.className = `status ${ok ? 'status--ok' : 'status--bad'}`;
  };

  socket.on('connect', () => set('Підключено до сервера', true));
  socket.on('presence:online', (count) => set(`Підключено до сервера · онлайн: ${count}`, true));
  socket.on('disconnect', () => set('Зв\'язок втрачено, перепідключаюсь...', false));
}
