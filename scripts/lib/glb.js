// Запис 3D-моделі у файл .glb (glTF 2.0 Binary) — без сторонніх бібліотек.
// writeGlb(file, { materials, primitives })
//   materials:  [{ name, color: [r, g, b, a], roughness?, extras? }]  (color множиться на кольори вершин, якщо вони є)
//   primitives: [{ material, positions, normals, colors?, uvs?, indices? }]
//     positions / normals — масиви чисел x,y,z…; colors — Uint8Array RGBA (0–255) на кожну вершину;
//     uvs — u,v…; indices — номери вершин трикутників.
import fs from 'node:fs';
import path from 'node:path';

export function writeGlb(file, { materials, primitives, name = path.basename(file, '.glb'), generator = 'Ashlands' }) {
  const chunks = [];
  const bufferViews = [];
  const accessors = [];
  let offset = 0;

  const addView = (buf, target) => {
    const padded = buf.length % 4 ? Buffer.concat([buf, Buffer.alloc(4 - (buf.length % 4))]) : buf;
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, target });
    chunks.push(padded);
    offset += padded.length;
    return bufferViews.length - 1;
  };

  const floats = (arr, size, withMinMax) => {
    const f = arr instanceof Float32Array ? arr : Float32Array.from(arr);
    const acc = { bufferView: addView(Buffer.from(f.buffer, f.byteOffset, f.byteLength), 34962), componentType: 5126, count: f.length / size, type: `VEC${size}` };
    if (withMinMax) {
      const min = Array(size).fill(Infinity);
      const max = Array(size).fill(-Infinity);
      for (let i = 0; i < f.length; i++) { const k = i % size; if (f[i] < min[k]) min[k] = f[i]; if (f[i] > max[k]) max[k] = f[i]; }
      acc.min = min;
      acc.max = max;
    }
    accessors.push(acc);
    return accessors.length - 1;
  };

  const gltfPrimitives = primitives.map((p) => {
    const attributes = { POSITION: floats(p.positions, 3, true), NORMAL: floats(p.normals, 3, false) };
    if (p.uvs) attributes.TEXCOORD_0 = floats(p.uvs, 2, false);
    if (p.colors) {
      const c = p.colors;
      accessors.push({ bufferView: addView(Buffer.from(c.buffer, c.byteOffset, c.byteLength), 34962), componentType: 5121, normalized: true, count: c.length / 4, type: 'VEC4' });
      attributes.COLOR_0 = accessors.length - 1;
    }
    const prim = { attributes, material: p.material };
    if (p.indices) {
      // Якщо вершин менше 65 536 — номери по 2 байти (файл менший).
      const small = p.positions.length / 3 <= 65535;
      const idx = small ? Uint16Array.from(p.indices) : Uint32Array.from(p.indices);
      accessors.push({ bufferView: addView(Buffer.from(idx.buffer, idx.byteOffset, idx.byteLength), 34963), componentType: small ? 5123 : 5125, count: idx.length, type: 'SCALAR' });
      prim.indices = accessors.length - 1;
    }
    return prim;
  });

  const bin = Buffer.concat(chunks);
  const json = {
    asset: { version: '2.0', generator },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name }],
    meshes: [{ name, primitives: gltfPrimitives }],
    materials: materials.map((m) => ({
      name: m.name,
      pbrMetallicRoughness: { baseColorFactor: m.color ?? [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: m.roughness ?? 0.9 },
      ...(m.doubleSided ? { doubleSided: true } : {}),
      ...(m.extras ? { extras: m.extras } : {}),
    })),
    accessors,
    bufferViews,
    buffers: [{ byteLength: bin.length }],
  };

  const jsonRaw = Buffer.from(JSON.stringify(json));
  const jsonBuf = jsonRaw.length % 4 ? Buffer.concat([jsonRaw, Buffer.alloc(4 - (jsonRaw.length % 4), 0x20)]) : jsonRaw;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // 'glTF'
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + bin.length, 8);
  const chunkHeader = (len, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(len, 0); h.writeUInt32LE(type, 4); return h; };

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([header, chunkHeader(jsonBuf.length, 0x4e4f534a), jsonBuf, chunkHeader(bin.length, 0x004e4942), bin]));

  const triangles = primitives.reduce((n, p) => n + (p.indices ? p.indices.length : p.positions.length / 3) / 3, 0);
  return { triangles, bytes: fs.statSync(file).size };
}
