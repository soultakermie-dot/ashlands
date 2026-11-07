// Фото-текстури для рельєфів з генератора (scripts/make-terrains.js).
// Модель позначає свої матеріали (extras.ashlands): terrain, soil, rock, bark, foliage, water —
// тут замість простих кольорів ставимо справжні матеріали:
//   terrain — змішування трави / бруківки / землі / скелі за картою splat.png (скеля — «з трьох боків», без розтягування на урвищах);
//   soil, rock, bark — текстура «з трьох боків» (triplanar), бо в каменів і стовбурів нема розгортки;
//   foliage — листя й хвоя з прозорістю; water — вода з рябизною і відблиском неба.
import * as THREE from 'three';

const TEX = '/assets/textures/';
const loader = new THREE.TextureLoader();
const cache = new Map();
const materials = new Map();   // один матеріал на вид (і на карту splat) — для всіх моделей спільний

function texture(url, { srgb = false, repeat = true, flipY = true } = {}, anisotropy = 8) {
  const key = `${url}|${srgb}|${repeat}|${flipY}`;
  if (!cache.has(key)) {
    const t = loader.load(url);
    t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.flipY = flipY;
    t.anisotropy = anisotropy;
    cache.set(key, t);
  }
  return cache.get(key);
}

// ---------- Спільні шматки шейдера ----------

const VERT_COMMON = 'varying vec3 vAshPos;\nvarying vec3 vAshNrm;';
const VERT_WORLD = 'vAshPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvAshNrm = normalize(mat3(modelMatrix) * objectNormal);';
const FRAG_COMMON = `
varying vec3 vAshPos;
varying vec3 vAshNrm;
vec3 ashTriW(vec3 n) { vec3 w = pow(abs(n), vec3(4.0)); return w / (w.x + w.y + w.z); }
vec3 ashTri(sampler2D t, vec3 p, vec3 w, float s) {
  return texture2D(t, p.zy / s).rgb * w.x + texture2D(t, p.xz / s).rgb * w.y + texture2D(t, p.xy / s).rgb * w.z;
}
vec3 ashTriN(sampler2D t, vec3 p, vec3 n, vec3 w, float s, float k) {
  vec2 a = texture2D(t, p.zy / s).xy * 2.0 - 1.0;
  vec2 b = texture2D(t, p.xz / s).xy * 2.0 - 1.0;
  vec2 c = texture2D(t, p.xy / s).xy * 2.0 - 1.0;
  vec3 d = vec3(0.0, a.y, a.x) * w.x + vec3(b.x, 0.0, b.y) * w.y + vec3(c.x, c.y, 0.0) * w.z;
  return normalize(n + d * k);
}`;

// Підмішати свої шматки у стандартний матеріал Three.js.
function patch(material, uniforms, { map, normal }) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    const decl = Object.entries(uniforms).map(([name, u]) => `uniform ${u.value?.isTexture ? 'sampler2D' : u.value?.isVector4 ? 'vec4' : u.value?.isVector3 || u.value?.isColor ? 'vec3' : 'float'} ${name};`).join('\n');
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_COMMON}`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${VERT_WORLD}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_COMMON}\n${decl}`)
      .replace('#include <map_fragment>', map)
      .replace('#include <normal_fragment_maps>', normal);
  };
  material.customProgramCacheKey = () => `ash-${material.name}`;
  return material;
}

// ---------- Матеріали ----------

function terrainMaterial(splatUrl, bounds, aniso) {
  const t = (name, srgb) => texture(TEX + name, { srgb }, aniso);
  const m = new THREE.MeshStandardMaterial({ name: 'ash_terrain', vertexColors: true, roughness: 0.95, metalness: 0 });
  return patch(m, {
    uSplat: { value: texture(splatUrl, { repeat: false, flipY: false }, aniso) },
    uBounds: { value: new THREE.Vector4(...bounds) },
    uGrass: { value: t('grass_diff.jpg', true) }, uGrassN: { value: t('grass_nor.jpg') },
    uCobble: { value: t('cobble_diff.jpg', true) }, uCobbleN: { value: t('cobble_nor.jpg') },
    uDirt: { value: t('dirt_diff.jpg', true) }, uDirtN: { value: t('dirt_nor.jpg') },
    uCliff: { value: t('cliff_diff.jpg', true) }, uCliffN: { value: t('cliff_nor.jpg') },
    uGrassTint: { value: new THREE.Vector3(0.82, 0.95, 0.66) },
  }, {
    map: `
      vec2 sUv = (vAshPos.xz - uBounds.xy) / (uBounds.zw - uBounds.xy);
      vec3 sp = texture2D(uSplat, sUv).rgb;
      vec4 wts = vec4(sp, clamp(1.0 - sp.r - sp.g - sp.b, 0.0, 1.0));
      vec3 nW = normalize(vAshNrm);
      vec2 pp = vec2(vAshPos.x, -vAshPos.z);
      vec3 tw = ashTriW(nW);
      vec3 grassC = mix(texture2D(uGrass, pp / 4.0).rgb, texture2D(uGrass, pp / 13.7 + 0.37).rgb, 0.45) * uGrassTint;
      vec3 cobC = texture2D(uCobble, pp / 2.4).rgb;
      vec3 dirtC = mix(texture2D(uDirt, pp / 4.5).rgb, texture2D(uDirt, pp / 15.3 + 0.21).rgb, 0.4);
      vec3 cliffC = ashTri(uCliff, vAshPos, tw, 8.0);
      // Різкіша межа між текстурами (за «висотою» — яскравістю текстури).
      vec4 ashH = wts * vec4(0.6 + dot(grassC, vec3(0.5)), 0.4 + dot(cobC, vec3(0.9)), 0.6 + dot(dirtC, vec3(0.5)), 0.6 + dot(cliffC, vec3(0.5)));
      ashH = pow(ashH, vec4(3.0));
      ashH /= max(ashH.x + ashH.y + ashH.z + ashH.w, 1e-4);
      diffuseColor.rgb *= grassC * ashH.x + cobC * ashH.y + dirtC * ashH.z + cliffC * ashH.w;
    `,
    normal: `
      vec3 nG = texture2D(uGrassN, pp / 4.0).xyz * 2.0 - 1.0;
      vec3 nC = texture2D(uCobbleN, pp / 2.4).xyz * 2.0 - 1.0;
      vec3 nD = texture2D(uDirtN, pp / 4.5).xyz * 2.0 - 1.0;
      vec3 ts = nG * ashH.x + nC * ashH.y * 1.6 + nD * ashH.z;
      vec3 planar = normalize(nW + vec3(ts.x, 0.0, -ts.y));
      vec3 wN = normalize(mix(planar, ashTriN(uCliffN, vAshPos, nW, tw, 8.0, 1.0), ashH.w));
      normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
    `,
  });
}

function triplanarMaterial(name, diff, nor, scale, aniso, tint = [1, 1, 1], roughness = 0.9) {
  const m = new THREE.MeshStandardMaterial({ name, vertexColors: true, roughness, metalness: 0 });
  return patch(m, {
    uMap: { value: texture(TEX + diff, { srgb: true }, aniso) },
    uNor: { value: texture(TEX + nor, {}, aniso) },
    uScale: { value: scale },
    uTint: { value: new THREE.Vector3(...tint) },
  }, {
    map: `
      vec3 nW = normalize(vAshNrm);
      vec3 tw = ashTriW(nW);
      diffuseColor.rgb *= ashTri(uMap, vAshPos, tw, uScale) * uTint;
    `,
    normal: `
      vec3 wN = ashTriN(uNor, vAshPos, nW, tw, uScale, 1.0);
      normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
    `,
  });
}

function foliageMaterial(aniso) {
  const m = new THREE.MeshStandardMaterial({
    name: 'ash_foliage',
    map: texture(TEX + 'foliage.png', { srgb: true, repeat: false, flipY: false }, aniso),
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    vertexColors: true,
    roughness: 0.85,
    metalness: 0,
  });
  // Листя освітлюється однаково з обох боків картки (без «темного зворотного боку»).
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  };
  m.customProgramCacheKey = () => 'ash-foliage';
  return m;
}

function waterMaterial(aniso) {
  const nor = texture(TEX + 'water_nor.jpg', {}, aniso);
  return new THREE.MeshStandardMaterial({
    name: 'ash_water',
    color: 0x1b2627,
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.9,
    normalMap: nor,
    normalScale: new THREE.Vector2(0.35, 0.35),
  });
}

/**
 * Поставити справжні матеріали на завантажений рельєф.
 * @returns {{ ground: THREE.Mesh[], water: THREE.Mesh[], waterMaterials: THREE.Material[] }}
 *   ground — по чому можна ходити (земля, каміння, міст); water — вода (окремо: туди не зайти).
 */
export function applyTerrainMaterials(root, glbUrl, renderer) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const base = glbUrl.replace(/[^/]+$/, '');
  const result = { ground: [], water: [], waterMaterials: [] };
  root.traverse((o) => {
    if (!o.isMesh) return;
    const extras = o.material?.userData ?? {};
    const kind = extras.ashlands;
    const key = kind === 'terrain' ? `terrain|${base}${extras.splat}` : kind;
    if (kind && !materials.has(key)) {
      let m = null;
      if (kind === 'terrain') m = terrainMaterial(base + extras.splat, extras.bounds, aniso);
      else if (kind === 'soil') m = triplanarMaterial('ash_soil', 'dirt_diff.jpg', 'dirt_nor.jpg', 5, aniso, [0.75, 0.65, 0.55]);
      else if (kind === 'rock') m = triplanarMaterial('ash_rock', 'rock_diff.jpg', 'rock_nor.jpg', 2.2, aniso, [0.85, 0.85, 0.82]);
      else if (kind === 'bark') m = triplanarMaterial('ash_bark', 'bark_diff.jpg', 'bark_nor.jpg', 1.6, aniso, [0.8, 0.75, 0.7], 0.95);
      else if (kind === 'foliage') m = foliageMaterial(aniso);
      else if (kind === 'water') m = waterMaterial(aniso);
      materials.set(key, m);
    }
    const m = kind ? materials.get(key) : null;
    if (m) o.material = m;
    o.receiveShadow = true;
    o.castShadow = kind !== 'water';
    if (kind === 'water') { result.water.push(o); if (!result.waterMaterials.includes(m)) result.waterMaterials.push(m); }
    else if (kind !== 'foliage' && kind !== 'bark') result.ground.push(o);
  });
  return result;
}
