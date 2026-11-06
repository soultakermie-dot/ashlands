// Бібліотека предметів (лише ДМ): items:list / create / update / delete.
import { deleteItem } from '../../services/inventory.js';
import { createItem, findItem, listItems, toPublicItem, updateItem } from '../../services/items.js';
import { handle } from '../handle.js';
import { DM_ROOM, requireDm } from '../identity.js';
import { notifyItemsChanged } from '../notify.js';

function broadcastLibrary(io) {
  io.to(DM_ROOM).emit('items:list', listItems());
}

export function registerItems(io, socket) {
  socket.on('items:list', handle(() => {
    requireDm(socket);
    return { items: listItems() };
  }));

  socket.on('items:create', handle(async (data) => {
    const dm = requireDm(socket);
    const item = await createItem(data);
    console.log(`[items] ${dm.login} створив предмет «${item.name}» (${item.kind})`);
    broadcastLibrary(io);
    return { item: toPublicItem(item) };
  }));

  socket.on('items:update', handle(async ({ itemId, ...data }) => {
    const dm = requireDm(socket);
    const item = await updateItem(itemId, data);
    console.log(`[items] ${dm.login} змінив предмет «${item.name}»`);
    broadcastLibrary(io);
    notifyItemsChanged(io);
    return { item: toPublicItem(item) };
  }));

  socket.on('items:delete', handle(async ({ itemId }) => {
    const dm = requireDm(socket);
    const name = findItem(itemId)?.name;
    const affected = await deleteItem(itemId);
    console.log(`[items] ${dm.login} видалив предмет «${name}» (було в ${affected.length} персонажів)`);
    broadcastLibrary(io);
    notifyItemsChanged(io);
    return {};
  }));
}
