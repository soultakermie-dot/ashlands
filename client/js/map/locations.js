// Мітки локацій на карті (міста, підземелля) і картка, яка відкривається по кліку.
const TYPE_NAMES = { city: 'Місто', dungeon: 'Підземелля' };

export function renderLocations(layer, locations, { onSelect }) {
  layer.replaceChildren(...locations.map((loc) => {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = `location location--${loc.type}`;
    marker.dataset.locationId = loc.id;
    marker.style.left = `${loc.x}px`;
    marker.style.top = `${loc.y}px`;
    marker.title = `${TYPE_NAMES[loc.type] ?? ''}: ${loc.name}`;

    const icon = document.createElement('span');
    icon.className = 'location__icon';
    const label = document.createElement('span');
    label.className = 'location__label';
    label.textContent = loc.name;

    marker.append(icon, label);
    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelect(loc);
    });
    return marker;
  }));
}

// Картка локації (поки лише назва й тип; опис і дії з'являться на наступних етапах).
export function initLocationCard(root) {
  const type = root.querySelector('[data-location-type]');
  const name = root.querySelector('[data-location-name]');
  root.querySelector('[data-close]').addEventListener('click', () => hide());

  let selectedId = null;

  function show(loc) {
    selectedId = loc.id;
    type.textContent = TYPE_NAMES[loc.type] ?? '';
    name.textContent = loc.name;
    root.hidden = false;
    highlight();
  }

  function hide() {
    selectedId = null;
    root.hidden = true;
    highlight();
  }

  function highlight() {
    for (const el of document.querySelectorAll('[data-location-id]')) {
      el.classList.toggle('location--selected', el.dataset.locationId === selectedId);
    }
  }

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  return { show, hide };
}
