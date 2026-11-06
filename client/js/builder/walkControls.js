// Режим «🚶 Пішки»: ходити містом від першої особи. WASD / стрілки — ходьба, мишка — дивитись,
// Shift — бігти, пробіл — стрибок. Ноги стоять на рельєфі: схилом іде вгору й униз.
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const EYE_HEIGHT = 1.7;     // метри — очі людини
const WALK_SPEED = 4;       // м/с
const RUN_SPEED = 9;
const JUMP_SPEED = 5;
const GRAVITY = 18;
const MAX_STEP_UP = 0.6;    // наскільки різко можна піднятися за кадр (сходинка), вище — стіна схилу не заважає, просто йдемо

export class WalkControls {
  /**
   * @param camera        камера сцени
   * @param dom           полотно
   * @param groundHeight  (x, z) => висота землі
   */
  constructor(camera, dom, groundHeight) {
    this.camera = camera;
    this.groundHeight = groundHeight;
    this.lock = new PointerLockControls(camera, dom);
    this.keys = new Set();
    this.vy = 0;
    this.enabled = false;

    const onKey = (down) => (e) => {
      if (!this.enabled || e.target.matches?.('input, textarea, select')) return;
      const k = e.code;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space'].includes(k)) {
        if (down) this.keys.add(k); else this.keys.delete(k);
        if (k === 'Space' && down && this.onGround) this.vy = JUMP_SPEED;
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', onKey(true));
    document.addEventListener('keyup', onKey(false));
    dom.addEventListener('click', () => { if (this.enabled && !this.lock.isLocked) this.lock.lock(); });
    this.lock.addEventListener('unlock', () => this.keys.clear());
  }

  // Увімкнути: стаємо на землю в точці (x, z) і дивимось у бік look.
  enable(x, z, look) {
    this.enabled = true;
    this.camera.position.set(x, this.groundHeight(x, z) + EYE_HEIGHT, z);
    if (look) this.camera.lookAt(look.x, this.camera.position.y, look.z);
    this.vy = 0;
  }

  disable() {
    this.enabled = false;
    this.keys.clear();
    if (this.lock.isLocked) this.lock.unlock();
  }

  update(dt) {
    if (!this.enabled) return;
    const k = this.keys;
    const forward = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const right = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? RUN_SPEED : WALK_SPEED;
    if (forward || right) {
      const len = Math.hypot(forward, right);
      this.lock.moveForward((forward / len) * speed * dt);
      this.lock.moveRight((right / len) * speed * dt);
    }
    // Ноги на землі: йдемо за рельєфом (вгору — плавно, вниз — падаємо з гравітацією).
    const p = this.camera.position;
    const floor = this.groundHeight(p.x, p.z) + EYE_HEIGHT;
    this.vy -= GRAVITY * dt;
    p.y += this.vy * dt;
    if (p.y <= floor) {
      p.y = p.y < floor - MAX_STEP_UP ? floor : Math.max(p.y, floor);
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
  }

  get isLocked() { return this.lock.isLocked; }
}
