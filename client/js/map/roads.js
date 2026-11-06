// Дороги на карті (SVG-лінії між локаціями через точки згину).
// У творчому режимі ДМ вибирає дорогу кліком і тягне точки згину; «+» посередині — нова точка,
// подвійний клік по точці — прибрати її.
import { el } from '../lib/dom.js';
import { makeDraggable } from './draggable.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class RoadLayer {
  /**
   * @param svg       <svg> усередині світу карти
   * @param handles   шар для ручок редагування (HTML, однаковий розмір за будь-якого зуму)
   * @param view      MapView
   * @param options   { canEdit(), onSelect(road | null), onChange(road, points) }
   */
  constructor(svg, handles, view, options) {
    this.svg = svg;
    this.handles = handles;
    this.view = view;
    this.options = options;
    this.selectedId = null;
    this.roads = [];
    this.locations = new Map();
  }

  setSize(width, height) {
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }

  render(roads, locations) {
    this.roads = roads;
    this.locations = new Map(locations.map((l) => [l.id, l]));
    if (this.selectedId && !roads.some((r) => r.id === this.selectedId)) this.selectedId = null;

    const editable = this.options.canEdit();
    this.svg.classList.toggle('map__roads--editable', editable);
    this.svg.replaceChildren(...roads.map((road) => this.#line(road, editable)).filter(Boolean));
    this.#renderHandles();
  }

  select(roadId) {
    this.selectedId = roadId;
    for (const g of this.svg.querySelectorAll('[data-road-id]')) {
      g.classList.toggle('road--selected', g.dataset.roadId === roadId);
    }
    this.#renderHandles();
  }

  // Повний шлях дороги: від локації через точки згину до локації.
  path(road, points = road.points) {
    const a = this.locations.get(road.fromId);
    const b = this.locations.get(road.toId);
    if (!a || !b) return null;
    return [[a.x, a.y], ...points, [b.x, b.y]];
  }

  #line(road, editable) {
    const path = this.path(road);
    if (!path) return null;
    const pts = path.map((p) => p.join(',')).join(' ');
    const g = document.createElementNS(SVG_NS, 'g');
    g.dataset.roadId = road.id;
    g.setAttribute('class', `road${road.id === this.selectedId ? ' road--selected' : ''}`);

    const line = document.createElementNS(SVG_NS, 'polyline');
    line.setAttribute('points', pts);
    line.setAttribute('class', 'road__line');
    g.append(line);

    if (editable) {
      // Широка невидима лінія, щоб у дорогу легко було влучити мишкою.
      const hit = document.createElementNS(SVG_NS, 'polyline');
      hit.setAttribute('points', pts);
      hit.setAttribute('class', 'road__hit');
      hit.addEventListener('click', (e) => {
        e.stopPropagation();
        this.select(road.id);
        this.options.onSelect(road);
      });
      g.append(hit);
    }
    return g;
  }

  // Ручки вибраної дороги: точки згину й «+» посередині кожного відрізка.
  #renderHandles() {
    const road = this.roads.find((r) => r.id === this.selectedId);
    if (!road || !this.options.canEdit()) {
      this.handles.replaceChildren();
      return;
    }
    let points = road.points.map((p) => [...p]);
    const save = () => this.options.onChange(road, points);
    const redrawLine = () => {
      const path = this.path(road, points);
      for (const line of this.svg.querySelectorAll(`[data-road-id="${road.id}"] polyline`)) {
        line.setAttribute('points', path.map((p) => p.join(',')).join(' '));
      }
    };

    const nodes = [];
    points.forEach((p, i) => {
      const h = el('div', { class: 'road-handle', title: 'Тягни, щоб змінити дорогу. Подвійний клік — прибрати точку.' });
      place(h, p);
      makeDraggable(h, this.view, {
        onMove: (x, y) => { points[i] = [Math.round(x), Math.round(y)]; place(h, points[i]); redrawLine(); },
        onDrop: () => save(),
      });
      h.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        points = points.filter((_, j) => j !== i);
        save();
      });
      nodes.push(h);
    });

    // «+» посередині кожного відрізка — додати точку згину.
    const path = this.path(road, points);
    for (let i = 0; i < path.length - 1; i++) {
      const mid = [(path[i][0] + path[i + 1][0]) / 2, (path[i][1] + path[i + 1][1]) / 2];
      const plus = el('div', { class: 'road-handle road-handle--add', title: 'Додати точку згину' }, '+');
      place(plus, mid);
      makeDraggable(plus, this.view, {
        onClick: () => { points.splice(i, 0, mid.map(Math.round)); save(); },
        onMove: (x, y) => {
          if (!plus.dataset.inserted) { points.splice(i, 0, [x, y]); plus.dataset.inserted = '1'; }
          points[i] = [Math.round(x), Math.round(y)];
          place(plus, points[i]);
          redrawLine();
        },
        onDrop: () => save(),
      });
      nodes.push(plus);
    }
    this.handles.replaceChildren(...nodes);
  }
}

function place(node, [x, y]) {
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
}
