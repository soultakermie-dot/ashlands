// Світ: карта й локації (міста, підземелля).
// Поки що тестові дані тут, у коді. На етапі 2 (творчий режим) локації переїдуть у базу
// й редагуватимуться ДМ прямо на карті.

// Картинка карти та її розмір у пікселях. Координати локацій — у цих самих пікселях.
const WORLD_MAP = {
  image: '/assets/images/world-map-placeholder.svg',
  width: 4000,
  height: 3000,
  // Масштаб: скільки метрів в одному пікселі карти. Для справжньої карти — підставити її масштаб.
  metersPerPixel: 10,
};

// Передавати предмети й золото можна персонажу, що стоїть не далі за це.
export const TRANSFER_RADIUS_M = 100;

export const LOCATION_TYPES = { CITY: 'city', DUNGEON: 'dungeon' };

const TEST_LOCATIONS = [
  { id: 'test-city-1', type: 'city', name: 'Попелград', x: 1180, y: 1000 },
  { id: 'test-city-2', type: 'city', name: 'Чорний Брід', x: 1690, y: 1480 },
  { id: 'test-city-3', type: 'city', name: 'Вороняче Гніздо', x: 2560, y: 900 },
  { id: 'test-city-4', type: 'city', name: 'Сірий Порт', x: 900, y: 2050 },
  { id: 'test-city-5', type: 'city', name: 'Морок-на-Скелі', x: 3120, y: 1560 },
  { id: 'test-city-6', type: 'city', name: 'Тліюча Застава', x: 2300, y: 2250 },
  { id: 'test-dungeon-1', type: 'dungeon', name: 'Катакомби Забутих', x: 1420, y: 1250 },
  { id: 'test-dungeon-2', type: 'dungeon', name: 'Склеп Попелу', x: 2420, y: 1560 },
];

// Де з'являється новий персонаж (поки — біля першого тестового міста; на етапі 2 вибиратиме ДМ).
const SPAWN = { x: 1180, y: 1060 };

export function getWorld() {
  return { map: WORLD_MAP, locations: TEST_LOCATIONS };
}

export function getSpawnPoint() {
  return { ...SPAWN };
}

// Відстань між двома персонажами на карті в метрах (null — хтось не на карті).
export function distanceMeters(a, b) {
  if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return null;
  return Math.hypot(a.x - b.x, a.y - b.y) * WORLD_MAP.metersPerPixel;
}

// Чи точка в межах карти.
export function isInsideMap(x, y) {
  return Number.isFinite(x) && Number.isFinite(y)
    && x >= 0 && y >= 0 && x <= WORLD_MAP.width && y <= WORLD_MAP.height;
}
