// Мітки локацій на карті (міста, підземелля), стартова точка (для ДМ) і картка локації.
import { el } from '../lib/dom.js';
import { makeDraggable } from './draggable.js';

export const TYPE_NAMES = { city: 'Місто', dungeon: 'Підземелля' };

export class LocationLayer {
  /**
   * @param layer    шар міток усередині світу карти
   * @param view     MapView
   * @param options  { onClick(loc), canDrag(), onMove(loc, x, y), onSpawnMove(x, y), canDragSpawn() }
   */
  constructor(layer, view, options) {
    this.layer = layer;
    this.view = view;
    this.options = options;
    this.selectedId = null;
    this.highlightIds = new Set();
  }

  render(locations, spawn) {
    const markers = locations.map((loc) => this.#marker(loc));
    if (spawn) markers.push(this.#spawnMarker(spawn));
    this.layer.replaceChildren(...markers);
  }

  // Підсвітити вибрану локацію (картка / редагування) і, за потреби, ще кілька (наприклад, початок дороги).
  select(id, extra = []) {
    this.selectedId = id;
    this.highlightIds = new Set(extra);
    for (const m of this.layer.querySelectorAll('[data-location-id]')) {
      m.classList.toggle('location--selected', m.dataset.locationId === id);
      m.classList.toggle('location--picked', this.highlightIds.has(m.dataset.locationId));
    }
  }

  #marker(loc) {
    const marker = el('div', {
      class: `location location--${loc.type}${loc.id === this.selectedId ? ' location--selected' : ''}${this.highlightIds.has(loc.id) ? ' location--picked' : ''}`,
      title: `${TYPE_NAMES[loc.type] ?? ''}: ${loc.name}`,
      tabIndex: 0,
    }, el('span', { class: 'location__icon' }), el('span', { class: 'location__label' }, loc.name));
    marker.dataset.locationId = loc.id;
    marker.style.left = `${loc.x}px`;
    marker.style.top = `${loc.y}px`;

    makeDraggable(marker, this.view, {
      canDrag: () => this.options.canDrag(loc),
      onMove: (x, y) => { marker.style.left = `${x}px`; marker.style.top = `${y}px`; this.options.onDragging?.(loc, x, y); },
      onDrop: (x, y) => this.options.onMove(loc, x, y),
      onClick: () => this.options.onClick(loc),
    });
    marker.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.options.onClick(loc); });
    return marker;
  }

  #spawnMarker(spawn) {
    const marker = el('div', { class: 'spawn-marker', title: 'Стартова точка: тут з\'являються нові персонажі' }, '🚩');
    marker.style.left = `${spawn.x}px`;
    marker.style.top = `${spawn.y}px`;
    makeDraggable(marker, this.view, {
      canDrag: () => this.options.canDragSpawn(),
      onMove: (x, y) => { marker.style.left = `${x}px`; marker.style.top = `${y}px`; },
      onDrop: (x, y) => this.options.onSpawnMove(x, y),
    });
    return marker;
  }
}

// Картка локації для гравців (і ДМ в ігровому режимі): назва, тип, опис; ДМ — кнопки керування.
export function initLocationCard(root, { dmActions }) {
  const type = root.querySelector('[data-location-type]');
  const name = root.querySelector('[data-location-name]');
  const description = root.querySelector('[data-location-description]');
  const actions = root.querySelector('[data-location-actions]');
  root.querySelector('[data-close]').addEventListener('click', () => hide());

  let onHide = null;

  function show(loc, hideCallback) {
    onHide = hideCallback;
    type.textContent = TYPE_NAMES[loc.type] ?? '';
    name.textContent = loc.name;
    description.textContent = loc.description || '';
    description.hidden = !loc.description;
    actions.replaceChildren(...dmActions(loc));
    actions.hidden = !actions.children.length;
    root.hidden = false;
  }

  function hide() {
    if (root.hidden) return;
    root.hidden = true;
    onHide?.();
  }

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  return { show, hide, get open() { return !root.hidden; } };
}
