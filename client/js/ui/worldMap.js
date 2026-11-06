// Екран карти світу: збирає карту, мітки, кнопки зуму й картку локації.
import { MapView } from '../map/mapView.js';
import { initLocationCard, renderLocations } from '../map/locations.js';
import { worldState } from '../state/world.js';

export function initWorldMap(root) {
  const view = new MapView(root.querySelector('[data-map]'));
  const card = initLocationCard(root.querySelector('[data-location-card]'));

  root.querySelector('[data-zoom-in]').addEventListener('click', () => view.zoomIn());
  root.querySelector('[data-zoom-out]').addEventListener('click', () => view.zoomOut());
  root.querySelector('[data-zoom-fit]').addEventListener('click', () => view.fit());

  // Клік по порожній карті закриває картку.
  root.querySelector('[data-map]').addEventListener('click', () => card.hide());

  worldState.onChange((world) => {
    view.setMap(world.map);
    renderLocations(view.layer, world.locations, { onSelect: (loc) => card.show(loc) });
  });
}
