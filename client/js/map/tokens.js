// Жетони персонажів на карті: аватарка + ім'я. ДМ може перетягувати їх мишкою.
import { createAvatar } from '../ui/avatar.js';

const FAN_SPACING_X = 58;    // відстань між жетонами в ряду (екранні пікселі)
const FAN_SPACING_Y = 76;    // відстань між рядами
const PER_ROW = 5;
const SAME_SPOT_PX = 12;     // ближче за це (у пікселях карти) — вважаємо «в одній точці»
const DRAG_THRESHOLD_PX = 4;

export class TokenLayer {
  /**
   * @param layer   елемент-шар усередині світу карти
   * @param view    MapView (для перерахунку координат екрана в координати карти)
   * @param options { canDrag(token), onMove(token, x, y), isMine(token) }
   */
  constructor(layer, view, options) {
    this.layer = layer;
    this.view = view;
    this.options = options;
    this.elements = new Map(); // characterId → елемент
    this.dragging = null;
  }

  render(tokens) {
    const seen = new Set();
    const offsets = fanOffsets(tokens);

    for (const token of tokens) {
      seen.add(token.characterId);
      let el = this.elements.get(token.characterId);
      if (!el) {
        el = this.#create(token);
        this.elements.set(token.characterId, el);
        this.layer.append(el);
      }
      this.#update(el, token, offsets.get(token.characterId));
    }

    for (const [id, el] of this.elements) {
      if (seen.has(id)) continue;
      el.remove();
      this.elements.delete(id);
    }
  }

  #create(token) {
    const el = document.createElement('div');
    el.className = 'token';
    el.dataset.characterId = token.characterId;
    el.innerHTML = '<span class="token__avatar"></span><span class="token__label"></span>';
    this.#bindDrag(el);
    return el;
  }

  #update(el, token, [dx, dy] = [0, 0]) {
    // Під час перетягування не смикаємо жетон, який тримає ДМ.
    if (this.dragging?.el !== el) {
      el.style.left = `${token.x}px`;
      el.style.top = `${token.y}px`;
    }
    el.style.setProperty('--fan-x', `${dx}px`);
    el.style.setProperty('--fan-y', `${dy}px`);
    el.token = token;

    el.classList.toggle('token--mine', this.options.isMine(token));
    el.classList.toggle('token--offline', !token.online);
    el.classList.toggle('token--draggable', this.options.canDrag(token));
    el.title = token.ownerLogin ? `${token.name} (гравець: ${token.ownerLogin})` : token.name;

    const avatarKey = `${token.name}|${token.avatarUrl ?? ''}`;
    if (el.dataset.avatarKey !== avatarKey) {
      el.dataset.avatarKey = avatarKey;
      el.querySelector('.token__avatar').replaceChildren(createAvatar(token.name, token.avatarUrl, 'md'));
      el.querySelector('.token__label').textContent = token.name;
    }
  }

  #bindDrag(el) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !this.options.canDrag(el.token)) return;
      e.stopPropagation(); // карта не повинна рухатися разом із жетоном
      this.dragging = { el, id: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false };
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
      const d = this.dragging;
      if (!d || d.el !== el || d.id !== e.pointerId) return;
      if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD_PX) return;
      d.moved = true;
      el.classList.add('token--dragging');
      const { x, y } = this.view.screenToMap(e.clientX, e.clientY);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    });

    const end = async (e) => {
      const d = this.dragging;
      if (!d || d.el !== el || d.id !== e.pointerId) return;
      this.dragging = null;
      el.classList.remove('token--dragging');
      if (!d.moved) return;
      const { x, y } = this.view.clampToMap(this.view.screenToMap(e.clientX, e.clientY));
      const ok = await this.options.onMove(el.token, x, y);
      if (!ok) { // сервер не прийняв — повертаємо жетон на місце
        el.style.left = `${el.token.x}px`;
        el.style.top = `${el.token.y}px`;
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
}

// Жетони, що стоять в одній точці, ставимо в ряд над точкою (по 5 у ряду, далі — ряд вище),
// щоб усіх було видно і місто під ними не закривалось.
function fanOffsets(tokens) {
  const offsets = new Map();
  const groups = [];
  for (const t of tokens) {
    const group = groups.find((g) => Math.hypot(g[0].x - t.x, g[0].y - t.y) < SAME_SPOT_PX);
    if (group) group.push(t);
    else groups.push([t]);
  }
  for (const group of groups) {
    if (group.length === 1) {
      offsets.set(group[0].characterId, [0, 0]);
      continue;
    }
    group.forEach((t, i) => {
      const row = Math.floor(i / PER_ROW);
      const inRow = Math.min(PER_ROW, group.length - row * PER_ROW);
      const col = i % PER_ROW;
      offsets.set(t.characterId, [(col - (inRow - 1) / 2) * FAN_SPACING_X, -row * FAN_SPACING_Y]);
    });
  }
  return offsets;
}
