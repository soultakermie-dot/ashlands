// Екран карти світу: карта, дороги, мітки, жетони, кнопки зуму, картка локації
// і дії ДМ (творчий режим — міста, дороги, старт; ігровий — підземелля).
import { button } from '../lib/dom.js';
import { MapView } from '../map/mapView.js';
import { LocationLayer, initLocationCard } from '../map/locations.js';
import { RoadLayer } from '../map/roads.js';
import { TokenLayer } from '../map/tokens.js';
import { characters } from '../state/characters.js';
import { editor } from '../state/editorMode.js';
import { session } from '../state/session.js';
import { tokensState } from '../state/tokens.js';
import { worldState } from '../state/world.js';
import { openLocationEditor } from './locationEditor.js';
import { initTokenCard } from './tokenCard.js';
import { travelState } from '../state/travel.js';
import { dungeonsState } from '../state/dungeons.js';
import { openDungeonEnter } from './dungeonsDmPanel.js';

export function initWorldMap(root, { onBuildCity } = {}) {
  const mapEl = root.querySelector('[data-map]');
  const view = new MapView(mapEl);
  const message = root.querySelector('[data-map-message]');
  const roadCard = root.querySelector('[data-road-card]');

  const isDm = () => session.user?.role === 'dm';
  const creative = () => editor.isCreative;

  let roadStartId = null;   // інструмент «Дорога»: перша вибрана локація
  let messageTimer = 0;

  function showMessage(text, kind = 'error') {
    clearTimeout(messageTimer);
    message.textContent = text;
    message.hidden = !text;
    message.classList.toggle('map-message--info', kind === 'info');
    if (text) messageTimer = setTimeout(() => { message.hidden = true; }, 4000);
  }

  async function act(promise, okText) {
    const res = await promise;
    if (!res.ok) showMessage(res.error);
    else if (okText) showMessage(okText, 'info');
    return res;
  }

  root.querySelector('[data-zoom-in]').addEventListener('click', () => view.zoomIn());
  root.querySelector('[data-zoom-out]').addEventListener('click', () => view.zoomOut());
  root.querySelector('[data-zoom-fit]').addEventListener('click', () => view.fit());

  // ---------- Картка локації (ігровий режим) ----------
  const card = initLocationCard(root.querySelector('[data-location-card]'), {
    dmActions: (loc) => (isDm()
      ? [
        button('✏ Змінити', 'btn--ghost', () => openLocationEditor(loc.id)),
        loc.type === 'dungeon' ? button('🕯 Завести в підземелля', 'btn--ok', () => openDungeonEnter(loc)) : null,
        loc.type === 'dungeon'
          ? button('💀 Прибрати', 'btn--bad', async () => {
            if (!window.confirm(`Прибрати підземелля «${loc.name}» з карти?`)) return;
            const r = await act(worldState.deleteLocation(loc.id));
            if (r.ok) card.hide();
          })
          : null,
      ].filter(Boolean)
      : travelButtons(loc)),
  });

  // Гравець: піти до локації (або попросити ДМ, якщо рух лише з дозволом).
  function travelButtons(loc) {
    if (!characters.active || characters.active.status !== 'approved') {
      return [button('🚶 Йти сюди', 'btn--ghost', () => showMessage('Спершу виберіть персонажа в «🧙 Персонажі»'))];
    }
    const label = travelState.approvalRequired ? '🙋 Попросити дозволу йти сюди' : '🚶 Йти сюди';
    return [button(label, 'btn--ok', async () => {
      const r = await act(travelState.go(loc.id));
      if (r.ok) card.hide();
    })];
  }

  // ---------- Шари ----------
  const roads = new RoadLayer(root.querySelector('[data-map-roads]'), root.querySelector('[data-map-handles]'), view, {
    canEdit: () => creative() && editor.tool === 'select',
    onSelect: (road) => showRoadCard(road),
    onChange: (road, points) => act(worldState.updateRoad(road.id, points)),
  });

  const locations = new LocationLayer(view.layer, view, {
    canDrag: () => creative() && editor.tool === 'select',
    canDragSpawn: () => creative() && editor.tool === 'select',
    onDragging: (loc, x, y) => {
      // Дороги тягнуться за містом під час перетягування.
      const world = worldState.current;
      roads.render(world.roads, world.locations.map((l) => (l.id === loc.id ? { ...l, x, y } : l)));
    },
    onMove: (loc, x, y) => act(worldState.updateLocation(loc.id, { x, y })),
    onSpawnMove: (x, y) => act(worldState.setSpawn(x, y), 'Стартову точку перенесено'),
    onClick: (loc) => onLocationClick(loc),
  });

  const tokenCard = initTokenCard(root.querySelector('[data-token-card]'), { onMessage: (text, kind) => showMessage(text, kind) });

  const tokens = new TokenLayer(root.querySelector('[data-map-tokens]'), root.querySelector('[data-map-routes]'), view, {
    canDrag: () => isDm() && !creative(),
    isMine: (token) => token.characterId === characters.active?.id,
    showRoute: (token) => isDm() || token.characterId === characters.active?.id,
    onClick: (token) => { card.hide(); tokenCard.show(token); },
    onMove: async (token, x, y) => (await act(tokensState.move(token.characterId, x, y))).ok,
  });

  // ---------- Кліки ----------
  function onLocationClick(loc) {
    if (isDm() && editor.isBuilder) {
      if (loc.type === 'city') onBuildCity?.(loc);
      else showMessage('Будувати можна лише міста');
      return;
    }
    // Інструмент «Старт» + клік по місту — старт ставиться біля цього міста.
    if (creative() && editor.tool === 'spawn') {
      act(worldState.setSpawn(loc.x, Math.min(worldState.current.map.height, loc.y + 60)), `Стартова точка — біля «${loc.name}»`);
      return;
    }
    // Нове місто / підземелля не можна поставити просто на іншу локацію.
    if ((creative() && editor.tool === 'city') || (!creative() && editor.tool === 'dungeon')) {
      showMessage('Тут уже є локація — клікни на вільному місці карти');
      return;
    }
    if (creative() && editor.tool === 'road') {
      if (!roadStartId) {
        roadStartId = loc.id;
        locations.select(null, [loc.id]);
        showMessage(`Початок дороги: «${loc.name}». Тепер клікни по іншій локації.`, 'info');
        return;
      }
      const fromId = roadStartId;
      roadStartId = null;
      locations.select(null);
      if (fromId !== loc.id) act(worldState.createRoad(fromId, loc.id), 'Дорогу додано');
      return;
    }
    if (creative()) {
      openLocationEditor(loc.id);
      return;
    }
    tokenCard.hide();
    locations.select(loc.id);
    card.show(loc, () => locations.select(null));
  }

  mapEl.addEventListener('click', async (e) => {
    const { x, y } = view.clampToMap(view.screenToMap(e.clientX, e.clientY));
    const tool = editor.tool;
    if (isDm() && creative() && tool === 'city') {
      const r = await act(worldState.createCity(x, y));
      if (r.ok) openLocationEditor(r.location.id);
      return;
    }
    if (isDm() && creative() && tool === 'spawn') {
      act(worldState.setSpawn(x, y), 'Стартову точку встановлено');
      return;
    }
    if (isDm() && tool === 'exitPoint') {
      const r = await act(dungeonsState.finishPicking(Math.round(x), Math.round(y)), 'Точку виходу з катакомб вибрано');
      return;
    }
    if (isDm() && !creative() && tool === 'dungeon') {
      editor.setTool('select');
      const r = await act(worldState.placeDungeon(x, y), 'Підземелля з\'явилося на карті');
      if (r.ok) openLocationEditor(r.location.id);
      return;
    }
    // Порожнє місце: закрити картки, зняти вибір.
    roadStartId = null;
    locations.select(null);
    card.hide();
    tokenCard.hide();
    roads.select(null);
    roadCard.hidden = true;
  });

  // ---------- Картка дороги (творчий режим) ----------
  function showRoadCard(road) {
    const a = worldState.location(road.fromId);
    const b = worldState.location(road.toId);
    roadCard.querySelector('[data-road-title]').textContent = `〰 ${a?.name ?? '?'} — ${b?.name ?? '?'}`;
    roadCard.querySelector('[data-road-actions]').replaceChildren(
      button('🗑 Видалити дорогу', 'btn--bad', async () => {
        if (!window.confirm('Видалити цю дорогу?')) return;
        const r = await act(worldState.deleteRoad(road.id));
        if (r.ok) { roads.select(null); roadCard.hidden = true; }
      }));
    roadCard.hidden = false;
  }

  // ---------- Малювання ----------
  function renderWorld() {
    const world = worldState.current;
    if (!world) return;
    const showSpawn = isDm() && creative() && world.spawn;
    locations.render(world.locations, showSpawn ? world.spawn : null);
    roads.render(world.roads, world.locations);
    if (roads.selectedId && !creative()) { roads.select(null); roadCard.hidden = true; }
    mapEl.classList.toggle('map--placing', ['city', 'spawn', 'dungeon', 'exitPoint'].includes(editor.tool) && isDm());
  }

  worldState.onChange((world) => {
    view.setMap(world.map);
    roads.setSize(world.map.width, world.map.height);
    tokens.setSize(world.map.width, world.map.height);
    renderWorld();
    tokens.render(tokensState.list);
    // Відкрита картка локації оновлюється (або закривається, якщо локацію прибрали).
    const shown = card.open && locations.selectedId && worldState.location(locations.selectedId);
    if (card.open) {
      if (shown) card.show(shown, () => locations.select(null));
      else card.hide();
    }
  });

  editor.onChange(() => {
    roadStartId = null;
    card.hide();
    if (!creative()) roadCard.hidden = true;
    renderWorld();
  });

  tokensState.onChange((list) => tokens.render(list));
  travelState.onChange(() => {
    const loc = card.open && locations.selectedId && worldState.location(locations.selectedId);
    if (loc) card.show(loc, () => locations.select(null));
  });
  characters.onChange(() => tokens.render(tokensState.list));
}
