// Хто онлайн: рахуємо підключення й повідомляємо всім.
export function registerPresence(io, socket) {
  const onlineCount = () => io.of('/').sockets.size;
  const broadcastOnline = () => io.emit('presence:online', onlineCount());

  console.log(`[+] підключився ${socket.id} (онлайн: ${onlineCount()})`);
  broadcastOnline();

  socket.on('disconnect', () => {
    console.log(`[-] відключився ${socket.id} (онлайн: ${onlineCount()})`);
    broadcastOnline();
  });
}
