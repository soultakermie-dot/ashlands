// Карта на екрані: картинка + шар міток, керування мишкою (колесико — зум, перетягування — рух).
import { Camera } from './camera.js';

const WHEEL_SPEED = 0.0015;
const BUTTON_ZOOM = 1.5;
const DRAG_THRESHOLD_PX = 4;  // менше — це клік, а не перетягування
const STORAGE_KEY = 'ashlands.camera';

export class MapView {
  constructor(root) {
    this.root = root;
    this.world = root.querySelector('[data-map-world]');
    this.image = root.querySelector('[data-map-image]');
    this.layer = root.querySelector('[data-map-layer]');
    this.camera = null;
    this.drag = null;
    this.frame = 0;

    this.#bindInput();
    new ResizeObserver(() => this.#onResize()).observe(root);
  }

  // Завантажити карту (картинка й розмір приходять із сервера).
  setMap({ image, width, height }) {
    const firstTime = !this.camera;
    this.camera = new Camera(width, height);
    this.world.style.width = `${width}px`;
    this.world.style.height = `${height}px`;
    if (this.image.getAttribute('src') !== image) this.image.src = image;
    this.restoreOnShow = firstTime;
    this.#applyInitialView();
  }

  // Початковий вигляд ставимо, лише коли карта вже має розмір на екрані
  // (якщо екран ще прихований, це зробить #onResize, щойно він з'явиться).
  #applyInitialView() {
    if (!this.root.clientWidth || !this.root.clientHeight) {
      this.needsInitialView = true;
      return;
    }
    this.needsInitialView = false;
    this.camera.setViewport(this.root.clientWidth, this.root.clientHeight);
    if (!(this.restoreOnShow && this.#restoreCamera())) this.camera.fit();
    this.restoreOnShow = false;
    this.render();
  }

  zoomBy(factor) {
    if (!this.camera) return;
    this.camera.zoomAt(this.root.clientWidth / 2, this.root.clientHeight / 2, factor);
    this.render();
  }

  // Точка екрана (clientX, clientY) → координати на карті.
  screenToMap(clientX, clientY) {
    const rect = this.root.getBoundingClientRect();
    const { x, y, scale } = this.camera;
    return { x: (clientX - rect.left - x) / scale, y: (clientY - rect.top - y) / scale };
  }

  // Обмежити точку межами карти.
  clampToMap({ x, y }) {
    const { mapWidth, mapHeight } = this.camera;
    return { x: Math.min(mapWidth, Math.max(0, x)), y: Math.min(mapHeight, Math.max(0, y)) };
  }

  zoomIn() { this.zoomBy(BUTTON_ZOOM); }
  zoomOut() { this.zoomBy(1 / BUTTON_ZOOM); }

  fit() {
    this.camera?.fit();
    this.render();
  }

  // Перемалювати не частіше, ніж раз на кадр екрана.
  render() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const { x, y, scale } = this.camera;
      this.world.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      // Мітки лишаються однакового розміру на екрані за будь-якого наближення.
      this.world.style.setProperty('--inv-scale', String(1 / scale));
      this.#saveCamera();
    });
  }

  #onResize() {
    if (!this.camera) return;
    if (this.needsInitialView) return this.#applyInitialView();
    this.camera.setViewport(this.root.clientWidth, this.root.clientHeight);
    this.render();
  }

  #bindInput() {
    this.root.addEventListener('wheel', (e) => {
      if (!this.camera) return;
      e.preventDefault();
      const rect = this.root.getBoundingClientRect();
      this.camera.zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * WHEEL_SPEED));
      this.render();
    }, { passive: false });

    this.root.addEventListener('pointerdown', (e) => {
      if (!this.camera || e.button !== 0) return;
      this.drag = { id: e.pointerId, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false };
    });

    this.root.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD_PX) return;
      if (!d.moved) {
        d.moved = true;
        this.root.setPointerCapture(e.pointerId);
        this.root.classList.add('map--dragging');
      }
      this.camera.panBy(e.clientX - d.lastX, e.clientY - d.lastY);
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      this.render();
    });

    // Якщо карту щойно перетягували — клік, що йде одразу за цим, гасимо (щоб випадково не відкрити місто).
    // Прапорець живе лише до кінця поточної події, тож наступний справжній клік не постраждає.
    this.root.addEventListener('click', (e) => {
      if (this.justDragged) e.stopPropagation();
    }, { capture: true });

    const endDrag = (e) => {
      if (!this.drag || this.drag.id !== e.pointerId) return;
      if (this.drag.moved) {
        this.justDragged = true;
        setTimeout(() => { this.justDragged = false; });
      }
      this.drag = null;
      this.root.classList.remove('map--dragging');
    };
    this.root.addEventListener('pointerup', endDrag);
    this.root.addEventListener('pointercancel', endDrag);

    this.root.addEventListener('dblclick', (e) => {
      if (!this.camera || e.target.closest('[data-location-id]')) return;
      const rect = this.root.getBoundingClientRect();
      this.camera.zoomAt(e.clientX - rect.left, e.clientY - rect.top, BUTTON_ZOOM);
      this.render();
    });
  }

  #saveCamera() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.camera)); } catch { /* не критично */ }
  }

  #restoreCamera() {
    try { return this.camera.restore(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { return false; }
  }
}
