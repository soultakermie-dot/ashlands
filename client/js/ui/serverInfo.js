// Напис зі службовою інформацією сервера (скільки разів запускався).
export function initServerInfo(socket, element) {
  socket.on('server:info', ({ launches }) => {
    element.textContent = `Сервер запускався: ${launches} раз(ів)`;
  });
}
