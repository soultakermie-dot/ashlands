// Жетони персонажів на карті: аватарка + ім'я. ДМ може перетягувати їх мишкою.
// Мандрівники рухаються плавно (позиція рахується щокадру за часом подорожі),
// а їхній маршрут показується пунктиром (свій — гравцю, усі — ДМ).
import { createAvatar } from '../ui/avatar.js';
import { remainingPath } from '../lib/path.js';
import { tokensState } from '../state/tokens.js';

const FAN_SPACING_X = 58;    // відстань між жетонами в ряду (екранні пікселі)
const FAN_SPACING_Y = 76;    // відстань між рядами
const PER_ROW = 5;
const SAME_SPOT_PX = 12;     // ближче за це (у пікселях карти) — вважаємо «в одній точці»
const DRAG_THRESHOLD_PX = 4;
const SVG_NS = 'http://www.w3.org/2000/svg';

export class TokenLayer {
  /**
   * @param layer   елемент-шар усередині світу карти
   * @param routes  <svg> для ліній маршрутів
   * @param view    MapView (для перерахунку координат екрана в координати карти)
   * @param options { canDrag(token), onMove(token, x, y), isMine(token), showRoute(token), onClick(token) }
   */
  constructor(layer, routes, view, options) {
    this.layer = layer;
    this.routes = routes;
    this.view = view;
    this.options = options;
    this.elements = new Map(); // characterId → елемент
    this.dragging = null;
    this.tokens = [];
    this.frame = 0;
  }

  setSize(width, height) {
    this.routes.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }

  render(tokens) {
    this.tokens = tokens;
    const seen = new Set();
    const offsets = fanOffsets(tokens.filter((t) => !t.travel?.running));

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
    this.#animate();
  }

  // Плавний рух мандрівників і перемальовування маршрутів — щокадру, поки хтось у дорозі.
  #animate() {
    cancelAnimationFrame(this.frame);
    const step = () => {
      let moving = false;
      const lines = [];
      for (const token of this.tokens) {
        if (!token.travel) continue;
        const el = this.elements.get(token.characterId);
        const pos = tokensState.positionOf(token);
        if (el && this.dragging?.el !== el) {
          el.style.left = `${pos.x}px`;
          el.style.top = `${pos.y}px`;
        }
        if (token.travel.running && pos.progress < 1) moving = true;
        if (this.options.showRoute(token)) {
          lines.push(this.#routeLine(token, remainingPath(token.travel.path, pos.distance)));
        }
      }
      this.routes.replaceChildren(...lines);
      if (moving) this.frame = requestAnimationFrame(step);
    };
    step();
  }

  #routeLine(token, path) {
    const line = document.createElementNS(SVG_NS, 'polyline');
    line.setAttribute('points', path.map((p) => p.join(',')).join(' '));
    line.setAttribute('class', `route${this.options.isMine(token) ? ' route--mine' : ''}${token.travel.running ? '' : ' route--paused'}`);
    return line;
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
    // Під час перетягування не смикаємо жетон, який тримає ДМ. Мандрівників рухає #animate.
    if (this.dragging?.el !== el && !token.travel) {
      el.style.left = `${token.x}px`;
      el.style.top = `${token.y}px`;
    }
    el.style.setProperty('--fan-x', `${dx}px`);
    el.style.setProperty('--fan-y', `${dy}px`);
    el.token = token;

    el.classList.toggle('token--mine', this.options.isMine(token));
    el.classList.toggle('token--offline', !token.online);
    el.classList.toggle('token--traveling', !!token.travel);
    el.classList.toggle('token--paused', !!token.travel && !token.travel.running);
    el.classList.toggle('token--leader', !!token.isLeader);
    el.classList.toggle('token--grouped', !!token.groupId);
    el.classList.toggle('token--draggable', this.options.canDrag(token));
    const where = token.travel ? ` → ${token.travel.destinationName}${token.travel.running ? '' : ' (зупинений)'}` : '';
    el.title = (token.ownerLogin ? `${token.name} (гравець: ${token.ownerLogin})` : token.name) + where;

    const avatarKey = `${token.name}|${token.avatarUrl ?? ''}`;
    if (el.dataset.avatarKey !== avatarKey) {
      el.dataset.avatarKey = avatarKey;
      el.querySelector('.token__avatar').replaceChildren(createAvatar(token.name, token.avatarUrl, 'md'));
      el.querySelector('.token__label').textContent = token.name;
    }
  }

  #bindDrag(el) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation(); // карта не повинна рухатися разом із жетоном
      this.dragging = { el, id: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, allowed: this.options.canDrag(el.token) };
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
      const d = this.dragging;
      if (!d || d.el !== el || d.id !== e.pointerId || !d.allowed) return;
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
      if (!d.moved) {
        if (e.type === 'pointerup') this.options.onClick?.(el.token);
        return;
      }
      const { x, y } = this.view.clampToMap(this.view.screenToMap(e.clientX, e.clientY));
      const ok = await this.options.onMove(el.token, x, y);
      if (!ok) { // сервер не прийняв — повертаємо жетон на місце
        const pos = tokensState.positionOf(el.token);
        el.style.left = `${pos.x}px`;
        el.style.top = `${pos.y}px`;
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('click', (e) => e.stopPropagation());
  }
}

// Жетони, що стоять в одній точці, ставимо в ряд над точкою (по 5 у ряду, далі — ряд вище),
// щоб усіх було видно і місто під ними не закривалось.
function fanOffsets(tokens) {
  const offsets = new Map();
  const groups = [];
  for (const t of tokens) {
    const p = tokensState.positionOf(t);
    const group = groups.find((g) => Math.hypot(g.x - p.x, g.y - p.y) < SAME_SPOT_PX);
    if (group) group.items.push(t);
    else groups.push({ x: p.x, y: p.y, items: [t] });
  }
  for (const { items } of groups) {
    if (items.length === 1) {
      offsets.set(items[0].characterId, [0, 0]);
      continue;
    }
    items.forEach((t, i) => {
      const row = Math.floor(i / PER_ROW);
      const inRow = Math.min(PER_ROW, items.length - row * PER_ROW);
      const col = i % PER_ROW;
      offsets.set(t.characterId, [(col - (inRow - 1) / 2) * FAN_SPACING_X, -row * FAN_SPACING_Y]);
    });
  }
  return offsets;
}
