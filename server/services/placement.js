// Де стоїть персонаж, якого ще ніколи не ставили на карту: у стартовій точці.
import { stores } from '../storage/index.js';
import { getSpawnPoint } from './world.js';

export function ensurePlaced(character) {
  if (Number.isFinite(character.x) && Number.isFinite(character.y)) return;
  Object.assign(character, getSpawnPoint());
  stores.characters.save();
}
