// Екран карти світу: збирає карту, мітки, жетони, кнопки зуму й картку локації.
import { MapView } from '../map/mapView.js';
import { initLocationCard, renderLocations } from '../map/locations.js';
import { TokenLayer } from '../map/tokens.js';
import { characters } from '../state/characters.js';
import { session } from '../state/session.js';
import { tokensState } from '../state/tokens.js';
import { worldState } from '../state/world.js';

export function initWorldMap(root) {
  const view = new MapView(root.querySelector('[data-map]'));
  const card = initLocationCard(root.querySelector('[data-location-card]'));
  const message = root.querySelector('[data-map-message]');

  root.querySelector('[data-zoom-in]').addEventListener('click', () => view.zoomIn());
  root.querySelector('[data-zoom-out]').addEventListener('click', () => view.zoomOut());
  root.querySelector('[data-zoom-fit]').addEventListener('click', () => view.fit());

  // Клік по порожній карті закриває картку.
  root.querySelector('[data-map]').addEventListener('click', () => card.hide());

  const tokens = new TokenLayer(root.querySelector('[data-map-tokens]'), view, {
    canDrag: () => session.user?.role === 'dm',
    isMine: (token) => token.characterId === characters.active?.id,
    onMove: async (token, x, y) => {
      const res = await tokensState.move(token.characterId, x, y);
      showMessage(res.ok ? '' : res.error);
      return res.ok;
    },
  });

  function showMessage(text) {
    message.textContent = text;
    message.hidden = !text;
  }

  worldState.onChange((world) => {
    view.setMap(world.map);
    renderLocations(view.layer, world.locations, { onSelect: (loc) => card.show(loc) });
    tokens.render(tokensState.list);
  });

  tokensState.onChange((list) => tokens.render(list));
  // «Мій» жетон підсвічується — перемальовуємо, коли гравець вибрав іншого персонажа.
  characters.onChange(() => tokens.render(tokensState.list));
}
