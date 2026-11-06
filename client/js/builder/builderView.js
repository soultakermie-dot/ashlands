// Режим «🏗 Будівельник»: вікно 3D-міста на весь екран + панель (бібліотека моделей, інструменти, збереження).
// Кожна зміна одразу зберігається на сервері (у базу).
import { socket } from '../net/socket.js';
import { request } from '../net/request.js';
import { button, el, messageLine } from '../lib/dom.js';
import { CityScene3D } from './scene3d.js';

const MODES = [
  { id: 'translate', label: '✥ Рух', key: 'w' },
  { id: 'rotate', label: '⟳ Поворот', key: 'e' },
  { id: 'scale', label: '⤢ Розмір', key: 'r' },
];

export function initBuilderView(root, { onClose }) {
  const viewport = root.querySelector('[data-builder-viewport]');
  const panel = root.querySelector('[data-builder-panel]');
  const message = messageLine();

  let scene3d = null;
  let city = null;          // дані сцени з сервера
  let selectedId = null;
  let placingModel = null;  // шлях моделі, яку ставимо кліком

  const urlOf = (modelPath) => `/assets/models/${modelPath}`;

  function ensure3D() {
    if (scene3d) return scene3d;
    scene3d = new CityScene3D(viewport, {
      onPlace: (p) => place(p),
      onSelect: (id) => select(id),
      onTransformEnd: async (id, t) => {
        const r = await save('build:update', { objectId: id, ...t });
        if (r.ok) Object.assign(city.objects.find((o) => o.id === id) ?? {}, r.object);
        render();
      },
    });
    return scene3d;
  }

  async function save(event, payload) {
    const r = await request(event, { locationId: city.locationId, ...payload });
    message.show(r.ok ? '' : r.error);
    return r;
  }

  // ---------- Відкрити / закрити ----------

  async function open(location) {
    root.hidden = false;
    document.body.classList.add('is-building');
    ensure3D().start();
    await load(location.id, true);
  }

  function close() {
    root.hidden = true;
    document.body.classList.remove('is-building');
    scene3d?.stop();
    city = null;
    selectedId = null;
    placingModel = null;
    onClose?.();
  }

  async function load(locationId, resetTerrain) {
    const r = await request('build:scene', { locationId });
    if (!r.ok) { message.show(r.error); return; }
    const terrainChanged = resetTerrain || r.scene.terrainUrl !== city?.terrainUrl;
    city = r.scene;
    if (terrainChanged) await scene3d.setTerrain(city.terrainUrl);
    await scene3d.setObjects(city.objects, urlOf);
    if (selectedId && !city.objects.some((o) => o.id === selectedId)) selectedId = null;
    scene3d.select(selectedId);
    render();
  }

  // ---------- Дії ----------

  async function place(p) {
    if (!placingModel) return;
    const r = await save('build:add', { model: placingModel, x: p.x, y: p.y, z: p.z, rotY: 0, scale: 1 });
    if (r.ok) {
      city.objects.push(r.object);
      await scene3d.setObjects(city.objects, urlOf);
      render();
    }
  }

  function select(id) {
    selectedId = id;
    scene3d.select(id);
    render();
  }

  async function removeSelected() {
    if (!selectedId) return;
    const r = await save('build:delete', { objectId: selectedId });
    if (!r.ok) return;
    city.objects = city.objects.filter((o) => o.id !== selectedId);
    selectedId = null;
    scene3d.select(null);
    await scene3d.setObjects(city.objects, urlOf);
    render();
  }

  function startPlacing(modelPath) {
    if (scene3d.cameraMode === 'walk') { scene3d.setCameraMode('orbit'); }
    placingModel = placingModel === modelPath ? null : modelPath;
    if (placingModel) select(null);
    scene3d.setPlacing(!!placingModel);
    render();
  }

  // ---------- Панель ----------

  function render() {
    if (!city) return;
    const selected = city.objects.find((o) => o.id === selectedId);
    const modelName = (p) => city.models.find((m) => m.path === p)?.name ?? p;

    const folder = el('select', { class: 'inv-input' },
      el('option', { value: '' }, '— лише спільні моделі —'),
      city.folders.map((f) => el('option', { value: f, selected: f === city.folder }, f)));
    folder.addEventListener('change', async () => {
      const r = await save('build:setFolder', { folder: folder.value || null });
      if (r.ok) await load(city.locationId, true);
    });

    // Бібліотека: за категоріями.
    const groups = new Map();
    for (const m of city.models) {
      if (!groups.has(m.categoryName)) groups.set(m.categoryName, []);
      groups.get(m.categoryName).push(m);
    }

    panel.replaceChildren(...[
      el('div', { class: 'builder-panel__head' },
        el('strong', {}, `🏗 ${city.cityName}`),
        button('← До карти', 'btn--ghost', close)),
      el('div', { class: 'builder-modes builder-modes--2' },
        el('button', { type: 'button', class: `tool-btn${scene3d.cameraMode === 'orbit' ? ' tool-btn--active' : ''}`, onclick: () => { scene3d.setCameraMode('orbit'); render(); } }, '🛸 Огляд'),
        el('button', { type: 'button', class: `tool-btn${scene3d.cameraMode === 'walk' ? ' tool-btn--active' : ''}`, onclick: () => { selectedId = null; placingModel = null; scene3d.setCameraMode('walk'); render(); } }, '🚶 Пішки')),
      scene3d.cameraMode === 'walk' ? el('p', { class: 'builder-hint' }, '🚶 Клікни в місто, щоб «стати» в нього. WASD — йти, мишка — дивитись, Shift — бігти, пробіл — стрибок. Esc — відпустити мишку.') : null,
      el('label', { class: 'field' }, el('span', {}, 'Папка моделей міста'), folder),
      city.folder && !city.terrainUrl ? el('p', { class: 'hint' }, `У папці «${city.folder}» нема terrain.glb — поки рівна земля.`) : null,

      el('h3', { class: 'sheet__title' }, 'Моделі'),
      city.models.length
        ? el('div', { class: 'builder-library' }, [...groups].map(([name, models]) => el('div', {},
          el('p', { class: 'builder-library__group' }, name),
          models.map((m) => el('button', {
            type: 'button',
            class: `builder-model${placingModel === m.path ? ' builder-model--active' : ''}`,
            onclick: () => startPlacing(m.path),
          }, m.name)))))
        : el('p', { class: 'hint' }, 'Моделей ще нема. Покладіть .glb у client/assets/models/ (див. BUILDING.md).'),
      placingModel ? el('p', { class: 'builder-hint' }, `🖱 Клікай по землі, щоб ставити «${modelName(placingModel)}». Esc — досить.`) : null,

      el('h3', { class: 'sheet__title' }, 'Вибраний об\'єкт'),
      selected
        ? el('div', { class: 'builder-selected' },
          el('p', {}, modelName(selected.model)),
          el('div', { class: 'builder-modes' }, MODES.map((m) => el('button', {
            type: 'button',
            class: `tool-btn${scene3d.mode === m.id ? ' tool-btn--active' : ''}`,
            title: `Клавіша ${m.key.toUpperCase()}`,
            onclick: () => { scene3d.setMode(m.id); render(); },
          }, m.label))),
          sizeControls(selected),
          el('div', { class: 'builder-row' },
            button('⬇ На землю', 'btn--ghost', () => applyAndSave(scene3d.dropToGround(selected.id)), 'Поставити на поверхню під ним'),
            button('🗑 Видалити', 'btn--bad', removeSelected, 'Клавіша Delete')))
        : el('p', { class: 'hint' }, 'Клікни по моделі в місті, щоб її рухати, повертати чи змінити розмір.'),

      message,
      el('p', { class: 'hint builder-help' }, 'Камера: ліва кнопка — обертати, права — зсунути, колесико — наблизити. Усе зберігається само.'),
      el('p', { class: 'hint' }, `Об'єктів у місті: ${city.objects.length}`),
    ].filter(Boolean));
  }

  // Розмір: повзунок (0.05–20, «логарифмічний», щоб і дрібно, і великим кроком) + кнопки − / +.
  function sizeControls(obj) {
    const toSlider = (s) => Math.round(Math.log(s / 0.05) / Math.log(400) * 1000);
    const fromSlider = (v) => Math.round(0.05 * 400 ** (v / 1000) * 100) / 100;
    const value = el('span', { class: 'builder-size__value' }, `×${obj.scale.toFixed(2)}`);
    const slider = el('input', { type: 'range', min: 0, max: 1000, value: toSlider(obj.scale), class: 'builder-size__slider' });
    const set = (s, commit) => {
      const t = scene3d.applyTransform(obj.id, { scale: s });
      value.textContent = `×${t.scale.toFixed(2)}`;
      if (commit) applyAndSave(t);
    };
    slider.addEventListener('input', () => set(fromSlider(Number(slider.value)), false));
    slider.addEventListener('change', () => set(fromSlider(Number(slider.value)), true));
    return el('div', { class: 'builder-size' },
      el('span', {}, 'Розмір'),
      button('−', 'btn--ghost', () => set(obj.scale / 1.1, true), 'Менше на 10%'),
      slider,
      button('+', 'btn--ghost', () => set(obj.scale * 1.1, true), 'Більше на 10%'),
      value);
  }

  // Зберегти змінене положення вибраного об'єкта.
  async function applyAndSave(t) {
    if (!t || !selectedId) return;
    const r = await save('build:update', { objectId: selectedId, ...t });
    if (r.ok) Object.assign(city.objects.find((o) => o.id === selectedId) ?? {}, r.object);
    render();
  }

  // Клавіші: W/E/R — режим, Delete — видалити, Esc — зняти вибір / перестати ставити.
  document.addEventListener('keydown', (e) => {
    if (root.hidden || e.target.matches('input, textarea, select')) return;
    if (scene3d.cameraMode === 'walk') return;
    const mode = MODES.find((m) => m.key === e.key.toLowerCase());
    if (mode && selectedId) { scene3d.setMode(mode.id); render(); }
    if (e.key === 'Delete') removeSelected();
    if (scene3d.cameraMode === 'walk') return; // у режимі «пішки» клавіші — для ходьби
    if (e.key === 'Escape') {
      if (placingModel) startPlacing(placingModel);
      else select(null);
    }
  });

  // Інший ДМ змінив це саме місто — перезавантажуємо.
  socket.on('build:changed', ({ locationId }) => {
    if (city && locationId === city.locationId) load(locationId, false);
  });

  return { open, close, get isOpen() { return !root.hidden; } };
}
