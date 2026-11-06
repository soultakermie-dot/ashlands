// Бібліотека предметів (лише для ДМ). Сервер надсилає оновлений список після кожної зміни.
import { socket } from '../net/socket.js';
import { request } from '../net/request.js';
import { session } from './session.js';

const listeners = new Set();
let items = [];

function setItems(next) {
  items = next;
  for (const fn of listeners) fn(items);
}

socket.on('items:list', setItems);

session.onChange(async (user) => {
  if (user?.role !== 'dm') {
    setItems([]);
    return;
  }
  const res = await request('items:list');
  if (res.ok) setItems(res.items);
});

export const itemsState = {
  get list() { return items; },
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  create: (data) => request('items:create', data),
  update: (itemId, data) => request('items:update', { itemId, ...data }),
  remove: (itemId) => request('items:delete', { itemId }),
};
