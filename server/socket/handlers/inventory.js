// Інвентар: inventory:get / nearby / transfer / transferGold (гравець), give / remove / setStats / setGold (ДМ).
import {
  assertCanView, getCharacter, getInventory, giveItem, nearbyCharacters, removeItem,
  setCustomStats, setGold, transferGold, transferItem,
} from '../../services/inventory.js';
import { handle } from '../handle.js';
import { requireDm, requireInGame } from '../identity.js';
import { notifyCharacter } from '../notify.js';

export function registerInventory(io, socket) {
  socket.on('inventory:get', handle(({ characterId }) => {
    const user = requireInGame(socket);
    const character = getCharacter(characterId);
    assertCanView(user, character);
    return getInventory(character);
  }));

  // Кому можна передати (персонажі інших гравців поруч з моїм вибраним).
  socket.on('inventory:nearby', handle(() => {
    const user = requireInGame(socket);
    if (!user.activeCharacterId) return { characters: [] };
    return { characters: nearbyCharacters(getCharacter(user.activeCharacterId)) };
  }));

  socket.on('inventory:transfer', handle(({ toCharacterId, entryId, quantity }) => {
    const user = requireInGame(socket);
    const { from, to, item, quantity: qty } = transferItem(user, toCharacterId, entryId, quantity);
    console.log(`[inventory] ${from.name} → ${to.name}: «${item.name}» ×${qty}`);
    notifyCharacter(io, from.id, 'inventory');
    notifyCharacter(io, to.id, 'inventory');
    return {};
  }));

  socket.on('inventory:transferGold', handle(({ toCharacterId, amount }) => {
    const user = requireInGame(socket);
    const { from, to, amount: n } = transferGold(user, toCharacterId, amount);
    console.log(`[inventory] ${from.name} → ${to.name}: ${n} золота`);
    notifyCharacter(io, from.id, 'inventory');
    notifyCharacter(io, to.id, 'inventory');
    return {};
  }));

  // ---------- ДМ ----------
  socket.on('inventory:give', handle(({ characterId, itemId, quantity }) => {
    const dm = requireDm(socket);
    const { character, item } = giveItem(characterId, itemId, quantity);
    console.log(`[inventory] ${dm.login} видав «${item.name}» ×${quantity} → ${character.name}`);
    notifyCharacter(io, character.id, 'inventory');
    return {};
  }));

  socket.on('inventory:remove', handle(({ entryId, quantity }) => {
    requireDm(socket);
    const entry = removeItem(entryId, quantity);
    notifyCharacter(io, entry.characterId, 'inventory');
    return {};
  }));

  socket.on('inventory:setStats', handle(({ entryId, stats }) => {
    requireDm(socket);
    const entry = setCustomStats(entryId, stats);
    notifyCharacter(io, entry.characterId, 'inventory');
    return {};
  }));

  socket.on('inventory:setGold', handle(({ characterId, amount }) => {
    requireDm(socket);
    const character = setGold(characterId, amount);
    notifyCharacter(io, character.id, 'inventory');
    return {};
  }));
}
