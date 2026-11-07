// 3D-сцена міста для будівельника (Three.js): рельєф, освітлення, камера, моделі, вибір і «ручки» (рух / поворот / розмір).
// Нічого не знає про сервер — лише показує й повідомляє про дії через колбеки.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { WalkControls } from './walkControls.js';
import { PointTerrain } from './terrainMesh.js';
import { applyTerrainMaterials } from './terrainMaterials.js';

const SKY = 0x8b969c;               // похмуре сіро-блакитне небо (і туман)

const DEFAULT_GROUND_SIZE = 200;   // метрів, якщо в міста ще нема свого рельєфу
const loader = new GLTFLoader();
const modelCache = new Map();      // url → Promise<gltf.scene>

function loadModel(url) {
  if (!modelCache.has(url)) {
    modelCache.set(url, loader.loadAsync(url).then((g) => g.scene));
  }
  return modelCache.get(url).then((scene) => scene.clone(true));
}

export class CityScene3D {
  /**
   * @param container  елемент, куди вставити 3D
   * @param handlers   { onPlace(point), onSelect(id|null), onTransformEnd(id, { x, y, z, rotY, scale }),
   *                    onTerrainClick(point, shift), onPointsMoved(indices, heights) }
   */
  constructor(container, handlers) {
    this.container = container;
    this.handlers = handlers;
    this.objects = new Map();      // id → THREE.Object3D (обгортка з userData.objectId)
    this.groundMeshes = [];        // по чому ходимо й ставимо моделі
    this.waterMeshes = [];         // вода (туди не зайти)
    this.waterMaterials = [];
    this.running = false;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.append(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 140, 560);
    this.scene.environment = skyEnvironment(this.renderer);
    this.scene.environmentIntensity = 0.55;

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
    this.camera.position.set(40, 35, 55);

    this.scene.add(new THREE.HemisphereLight(0xbcc6cc, 0x3b382e, 0.6));
    const sun = new THREE.DirectionalLight(0xffeedd, 2.0);   // приглушене сонце крізь хмари
    sun.position.set(-90, 120, 70);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    Object.assign(sun.shadow.camera, { left: -180, right: 180, top: 180, bottom: -180, far: 500 });
    this.scene.add(sun);

    this.world = new THREE.Group();   // рельєф
    this.placed = new THREE.Group();  // розставлені моделі
    this.scene.add(this.world, this.placed);

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.maxPolarAngle = Math.PI * 0.49;   // не пірнати під землю
    this.orbit.target.set(0, 0, 0);

    this.gizmo = new TransformControls(this.camera, this.renderer.domElement);
    this.gizmo.setSize(0.9);
    this.scene.add(this.gizmo.getHelper());
    this.gizmo.addEventListener('dragging-changed', (e) => {
      this.orbit.enabled = !e.value;
      if (this.gizmo.object === this.pointHandle) {
        if (e.value) this.#startPointDrag(); else this.#finishPointDrag();
        return;
      }
      if (!e.value) this.#finishTransform();
    });
    this.gizmo.addEventListener('objectChange', () => {
      if (this.gizmo.object === this.pointHandle) this.#movePoints();
      else this.#keepUniformScale();
    });
    this.pointHandle = new THREE.Object3D();   // невидима «ручка» для вибраних точок землі
    this.scene.add(this.pointHandle);
    this.terrainTool = null;                    // null | 'select' | 'add'
    this.pointTerrain = null;
    this.setMode('translate');

    this.raycaster = new THREE.Raycaster();
    this.walk = new WalkControls(this.camera, this.renderer.domElement, (x, z) => this.walkHeight(x, z));
    this.cameraMode = 'orbit';
    this.clock = new THREE.Clock();
    this.#bindPointer();
    new ResizeObserver(() => this.#resize()).observe(container);
  }

  // ---------- Рельєф ----------

  // url — terrain.glb з папки міста; points — земля з точок (дані з сервера). Без обох — рівна площина.
  async setTerrain(url, points = null) {
    this.world.clear();
    this.groundMeshes = [];
    this.waterMeshes = [];
    this.waterMaterials = [];
    this.pointTerrain = null;
    if (this.gizmo.object === this.pointHandle) this.gizmo.detach();
    if (points && !url) {
      this.pointTerrain = new PointTerrain();
      this.pointTerrain.setData(points);
      this.pointTerrain.showDots(!!this.terrainTool);
      this.world.add(this.pointTerrain.group);
      this.groundMeshes.push(this.pointTerrain.mesh);
    } else if (url) {
      const terrain = await loadModel(url);
      const parts = applyTerrainMaterials(terrain, url, this.renderer);
      this.groundMeshes.push(...parts.ground);
      this.waterMeshes = parts.water;
      this.waterMaterials = parts.waterMaterials;
      this.world.add(terrain);
    } else {
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(DEFAULT_GROUND_SIZE, DEFAULT_GROUND_SIZE),
        new THREE.MeshStandardMaterial({ color: 0x5f7a45, roughness: 1 }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      const grid = new THREE.GridHelper(DEFAULT_GROUND_SIZE, DEFAULT_GROUND_SIZE / 10, 0x3d4f2c, 0x4d6338);
      grid.position.y = 0.02;
      this.world.add(ground, grid);
      this.groundMeshes.push(ground);
    }
  }

  // ---------- Моделі ----------

  // Показати всі об'єкти міста (те, чого вже нема, — прибрати).
  async setObjects(list, urlOf) {
    const keep = new Set(list.map((o) => o.id));
    for (const [id, node] of this.objects) {
      if (!keep.has(id)) { if (this.gizmo.object === node) this.gizmo.detach(); this.placed.remove(node); this.objects.delete(id); }
    }
    await Promise.all(list.map(async (o) => {
      let node = this.objects.get(o.id);
      if (!node || node.userData.model !== o.model) {
        if (node) this.placed.remove(node);
        node = new THREE.Group();
        node.userData = { objectId: o.id, model: o.model };
        const model = await loadModel(urlOf(o.model));
        applyTerrainMaterials(model, urlOf(o.model), this.renderer);   // фото-матеріали (кора, листя…) + тіні
        node.add(model);
        this.placed.add(node);
        this.objects.set(o.id, node);
      }
      // Поки ДМ тягне саме цей об'єкт — не перебиваємо.
      if (this.gizmo.dragging && this.gizmo.object === node) return;
      node.position.set(o.x, o.y, o.z);
      node.rotation.set(0, o.rotY, 0);
      node.scale.setScalar(o.scale);
    }));
  }

  select(id) {
    const node = id ? this.objects.get(id) : null;
    if (node) this.gizmo.attach(node);
    else this.gizmo.detach();
  }

  // translate — рух у всі боки й у висоту, rotate — поворот навколо вертикалі, scale — розмір.
  setMode(mode) {
    this.mode = mode;
    this.gizmo.setMode(mode);
    this.gizmo.showX = mode !== 'rotate';
    this.gizmo.showZ = mode !== 'rotate';
    this.gizmo.showY = true;
  }

  // Поточне положення об'єкта (для збереження).
  transformOf(id) {
    const node = this.objects.get(id);
    return node && { x: node.position.x, y: node.position.y, z: node.position.z, rotY: node.rotation.y, scale: node.scale.x };
  }

  // Змінити об'єкт напряму (кнопки «на землю», повзунок розміру).
  applyTransform(id, patch) {
    const node = this.objects.get(id);
    if (!node) return null;
    if (patch.y !== undefined) node.position.y = patch.y;
    if (patch.scale !== undefined) node.scale.setScalar(Math.min(20, Math.max(0.05, patch.scale)));
    if (patch.rotY !== undefined) node.rotation.y = patch.rotY;
    return this.transformOf(id);
  }

  // Поставити об'єкт на землю під ним.
  dropToGround(id) {
    const node = this.objects.get(id);
    return node ? this.applyTransform(id, { y: this.groundHeight(node.position.x, node.position.z) }) : null;
  }

  // Модель, яку зараз ставимо кліком (прицільний курсор).
  setPlacing(on) {
    this.placing = on;
    this.renderer.domElement.style.cursor = on ? 'crosshair' : '';
  }

  // Висота рельєфу в точці (x, z) — щоб модель стояла на землі.
  groundHeight(x, z) {
    if (this.pointTerrain) return this.pointTerrain.heightAt(x, z) ?? 0;
    this.raycaster.set(new THREE.Vector3(x, 1000, z), new THREE.Vector3(0, -1, 0));
    const hit = this.raycaster.intersectObjects(this.groundMeshes, false)[0];
    return hit ? hit.point.y : 0;
  }

  // Куди можна ступити пішки: висота землі, або null — за краєм ділянки чи в глибокій воді.
  walkHeight(x, z) {
    if (this.pointTerrain) return this.pointTerrain.heightAt(x, z);
    this.raycaster.set(this.#rayFrom.set(x, 1000, z), DOWN);
    const hit = this.raycaster.intersectObjects(this.groundMeshes, false)[0];
    if (!hit) return null;
    if (this.waterMeshes.length) {
      const water = this.raycaster.intersectObjects(this.waterMeshes, false)[0];
      if (water && water.point.y - hit.point.y > 0.7) return null;
    }
    return hit.point.y;
  }

  #rayFrom = new THREE.Vector3();

  // ---------- Редагування землі з точок ----------

  // Інструмент землі: 'select' — вибирати й тягнути точки, 'add' — додавати точки кліком, null — вимкнено.
  setTerrainTool(tool) {
    this.terrainTool = tool;
    this.pointTerrain?.showDots(!!tool);
    if (tool) { this.select(null); this.setPlacing(false); }
    if (!tool) this.selectPoints([]);
    this.renderer.domElement.style.cursor = tool === 'add' ? 'copy' : '';
  }

  // Вибрати точки (індекси) — над ними з'являється стрілка вгору-вниз.
  selectPoints(list) {
    const t = this.pointTerrain;
    if (!t) return;
    t.setSelected(list);
    if (!t.selected.length) {
      if (this.gizmo.object === this.pointHandle) this.gizmo.detach();
      return;
    }
    this.#placePointHandle();
    this.gizmo.attach(this.pointHandle);
    this.gizmo.setMode('translate');
    this.gizmo.showX = false;
    this.gizmo.showZ = false;
    this.gizmo.showY = true;
  }

  // Висоти змінились ззовні (поле «висота», кнопки ▲▼) — перемалювати.
  refreshTerrain() {
    if (!this.pointTerrain) return;
    this.pointTerrain.refreshHeights();
    if (this.pointTerrain.selected.length) this.#placePointHandle();
  }

  #placePointHandle() {
    const t = this.pointTerrain;
    const c = new THREE.Vector3();
    for (const i of t.selected) c.add(new THREE.Vector3(t.pos[i * 3], t.pos[i * 3 + 1], t.pos[i * 3 + 2]));
    c.divideScalar(t.selected.length);
    this.pointHandle.position.copy(c);
  }

  #startPointDrag() {
    const t = this.pointTerrain;
    this.pointDrag = { y0: this.pointHandle.position.y, heights: t.selected.map((i) => t.heightOf(i)) };
  }

  #movePoints() {
    const t = this.pointTerrain;
    if (!t || !this.pointDrag) return;
    const dy = this.pointHandle.position.y - this.pointDrag.y0;
    t.selected.forEach((i, j) => t.setHeight(i, this.pointDrag.heights[j] + dy));
    t.refreshHeights();
  }

  #finishPointDrag() {
    const t = this.pointTerrain;
    if (!t || !this.pointDrag) return;
    this.pointDrag = null;
    this.handlers.onPointsMoved?.([...t.selected], t.selected.map((i) => t.heightOf(i)));
  }

  // ---------- Цикл малювання ----------

  // Камера: 'orbit' — огляд згори (обертати, зсувати, наближати), 'walk' — пішки від першої особи.
  setCameraMode(mode) {
    if (mode === this.cameraMode) return;
    this.cameraMode = mode;
    if (mode === 'walk') {
      this.select(null);
      this.setTerrainTool(null);
      this.setPlacing(false);
      this.orbit.enabled = false;
      const t = this.orbit.target;
      this.walk.enable(t.x, t.z + 8, t);
    } else {
      this.walk.disable();
      this.orbit.enabled = true;
      const p = this.camera.position;
      this.orbit.target.set(p.x, this.groundHeight(p.x, p.z), p.z);
      this.camera.position.set(p.x + 25, p.y + 25, p.z + 25);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.#resize();
    this.clock.getDelta();
    const loop = () => {
      if (!this.running) return;
      const dt = Math.min(0.1, this.clock.getDelta());
      if (this.cameraMode === 'walk') this.walk.update(dt);
      else this.orbit.update();
      this.waterTime = (this.waterTime ?? 0) + dt;
      for (const m of this.waterMaterials) m.normalMap.offset.set(this.waterTime * 0.012, this.waterTime * 0.02);
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    loop();
  }

  stop() {
    this.running = false;
  }

  // ---------- Внутрішнє ----------

  #resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  #pointerRay(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
  }

  #bindPointer() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', (e) => {
      if (this.cameraMode === 'walk') return;
      // Клік (а не обертання камери) і не по «ручках».
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4 || this.gizmo.dragging || this.gizmo.axis) { down = null; return; }
      down = null;
      this.#pointerRay(e);
      if (this.terrainTool) {
        const hit = this.raycaster.intersectObjects(this.groundMeshes, false)[0];
        if (hit) this.handlers.onTerrainClick?.({ x: hit.point.x, y: hit.point.y, z: hit.point.z }, e.shiftKey);
        return;
      }
      if (this.placing) {
        const hit = this.raycaster.intersectObjects(this.groundMeshes, false)[0];
        if (hit) this.handlers.onPlace({ x: hit.point.x, y: hit.point.y, z: hit.point.z });
        return;
      }
      const hit = this.raycaster.intersectObjects([...this.objects.values()], true)[0];
      let node = hit?.object;
      while (node && !node.userData.objectId) node = node.parent;
      this.handlers.onSelect(node?.userData.objectId ?? null);
    });
  }

  // Розмір — однаковий по всіх осях (щоб будинок не сплющувався).
  #keepUniformScale() {
    const node = this.gizmo.object;
    if (!node || this.mode !== 'scale') return;
    const s = Math.min(20, Math.max(0.05, (node.scale.x + node.scale.y + node.scale.z) / 3));
    node.scale.setScalar(s);
  }

  // Відпустили «ручку» — повідомляємо, щоб зберегти.
  #finishTransform() {
    const node = this.gizmo.object;
    if (!node) return;
    this.handlers.onTransformEnd(node.userData.objectId, {
      x: node.position.x,
      y: node.position.y,
      z: node.position.z,
      rotY: node.rotation.y,
      scale: node.scale.x,
    });
  }
}


const DOWN = new THREE.Vector3(0, -1, 0);

// Відблиски неба: маленька «небесна сфера» (згори світліше, донизу — темна земля) → карта оточення.
function skyEnvironment(renderer) {
  const sky = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { top: { value: new THREE.Color(0x9aa6ae) }, horizon: { value: new THREE.Color(0xc2c5c2) }, bottom: { value: new THREE.Color(0x34322b) } },
    vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vP; void main() { float h = normalize(vP).y; vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.6)) : mix(horizon, bottom, pow(-h, 0.4)); gl_FragColor = vec4(c, 1.0); }',
  });
  sky.add(new THREE.Mesh(geo, mat));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(sky, 0.02).texture;
  pmrem.dispose();
  geo.dispose();
  mat.dispose();
  return env;
}
