// Перетягування елемента по карті мишкою. Координати — у пікселях карти.
// Короткий клік без руху — це клік (onClick), а не перетягування.
const DRAG_THRESHOLD_PX = 4;

/**
 * @param el       елемент на карті
 * @param view     MapView (перерахунок екран → карта)
 * @param handlers { canDrag(), onMove(x, y) — під час руху, onDrop(x, y) — відпустили, onClick(e) }
 */
export function makeDraggable(el, view, { canDrag = () => true, onMove, onDrop, onClick }) {
  let drag = null;

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.stopPropagation(); // карта не повинна рухатися разом з елементом
    drag = { id: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, allowed: canDrag() };
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId || !drag.allowed) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD_PX) return;
    drag.moved = true;
    el.classList.add('is-dragging');
    const p = view.clampToMap(view.screenToMap(e.clientX, e.clientY));
    onMove?.(p.x, p.y);
  });

  const end = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const { moved } = drag;
    drag = null;
    el.classList.remove('is-dragging');
    if (moved) {
      const p = view.clampToMap(view.screenToMap(e.clientX, e.clientY));
      onDrop?.(p.x, p.y);
    } else if (e.type === 'pointerup') {
      onClick?.(e);
    }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  // Клік обробляємо самі (у pointerup), щоб карта під елементом його не отримала.
  el.addEventListener('click', (e) => e.stopPropagation());
}
