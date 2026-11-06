// Світ: карта й локації (міста, підземелля).
// Поки що тестові дані тут, у коді. На етапі 2 (творчий режим) локації переїдуть у базу
// й редагуватимуться ДМ прямо на карті.

// Картинка карти та її розмір у пікселях. Координати локацій — у цих самих пікселях.
const WORLD_MAP = {
  image: '/assets/images/world-map-placeholder.svg',
  width: 4000,
  height: 3000,
};

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

export function getWorld() {
  return { map: WORLD_MAP, locations: TEST_LOCATIONS };
}
