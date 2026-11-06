// Камера карти: де ми дивимось (зсув x, y) і наскільки наближено (scale).
// Чиста математика без DOM — легко перевіряти й змінювати.
const MAX_SCALE = 3;
const EDGE_SLACK = 0.35; // наскільки край карти може зайти всередину вікна (частка розміру вікна)

// Карта завжди лишається на екрані, але її край може трохи зайти всередину вікна —
// так зум тримає точку під курсором навіть тоді, коли карта майже вміщається в екран.
function clampAxis(offset, size, view) {
  const slack = view * EDGE_SLACK;
  const lo = Math.min(0, view - size) - slack;
  const hi = Math.max(0, view - size) + slack;
  return Math.min(hi, Math.max(lo, offset));
}

export class Camera {
  constructor(mapWidth, mapHeight) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.viewWidth = 1;
    this.viewHeight = 1;
    this.x = 0;
    this.y = 0;
    this.scale = 1;
  }

  // Найменше наближення: уся карта вміщається у вікно.
  get minScale() {
    return Math.min(this.viewWidth / this.mapWidth, this.viewHeight / this.mapHeight);
  }

  get maxScale() {
    return Math.max(MAX_SCALE, this.minScale);
  }

  setViewport(width, height) {
    this.viewWidth = Math.max(1, width);
    this.viewHeight = Math.max(1, height);
    this.clamp();
  }

  // Показати всю карту по центру.
  fit() {
    this.scale = this.minScale;
    this.x = (this.viewWidth - this.mapWidth * this.scale) / 2;
    this.y = (this.viewHeight - this.mapHeight * this.scale) / 2;
    this.clamp();
  }

  // Наблизити / віддалити так, щоб точка під курсором (px, py) лишилась на місці.
  zoomAt(px, py, factor) {
    const next = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));
    const k = next / this.scale;
    this.x = px - (px - this.x) * k;
    this.y = py - (py - this.y) * k;
    this.scale = next;
    this.clamp();
  }

  panBy(dx, dy) {
    this.x += dx;
    this.y += dy;
    this.clamp();
  }

  // Карта не може «втекти» з екрана (див. clampAxis).
  clamp() {
    this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale));
    this.x = clampAxis(this.x, this.mapWidth * this.scale, this.viewWidth);
    this.y = clampAxis(this.y, this.mapHeight * this.scale, this.viewHeight);
  }

  // Збереження / відновлення положення (центр екрана в координатах карти + наближення).
  toJSON() {
    return {
      cx: (this.viewWidth / 2 - this.x) / this.scale,
      cy: (this.viewHeight / 2 - this.y) / this.scale,
      scale: this.scale,
    };
  }

  restore({ cx, cy, scale }) {
    if (![cx, cy, scale].every(Number.isFinite)) return false;
    this.scale = scale;
    this.x = this.viewWidth / 2 - cx * scale;
    this.y = this.viewHeight / 2 - cy * scale;
    this.clamp();
    return true;
  }
}
