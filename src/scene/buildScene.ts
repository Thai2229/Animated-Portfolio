// Static scene content (terrain, water, waterfall, forest, clouds) ported from the mock as plain three objects.
import * as THREE from 'three';
import { createNoise } from '../terrain/noise';
import { makeHeightAt } from '../terrain/heightfield';
import { A2W, WATER_Y, FALL_TOP, FALL_BASE, PATH_MAIN, PATH_BRANCH } from '../terrain/layout';
import type { WorldData } from '../terrain/world';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function makeRnd(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function terrainTexture(world: WorldData) {
  const { tex: TEX, worldSize } = world;
  const c = document.createElement('canvas');
  c.width = c.height = TEX;
  const g = c.getContext('2d')!;
  g.putImageData(new ImageData(world.albedo as Uint8ClampedArray<ArrayBuffer>, TEX, TEX), 0, 0);
  g.strokeStyle = 'rgba(214,200,172,0.9)';
  g.lineWidth = 3.2 * (TEX / 2048);
  g.lineJoin = g.lineCap = 'round';
  for (const P of [PATH_MAIN, PATH_BRANCH]) {
    g.beginPath();
    P.forEach(([a, b], k) => {
      const w = A2W(a, b);
      const sx = (w.x / worldSize + 0.5) * (TEX - 1);
      const sy = (w.z / worldSize + 0.5) * (TEX - 1);
      if (k) g.lineTo(sx, sy);
      else g.moveTo(sx, sy);
    });
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function fallTexture(rnd: () => number) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 260; i++) {
    const x = rnd() * 256;
    const w = 1 + rnd() * 4;
    const a = 0.15 + rnd() * 0.5;
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, `rgba(255,255,255,${a})`);
    gr.addColorStop(rnd() * 0.6 + 0.3, `rgba(230,240,245,${a * 0.7})`);
    gr.addColorStop(1, `rgba(255,255,255,${a})`);
    g.fillStyle = gr;
    g.fillRect(x, 0, w, 512);
  }
  const edge = g.createLinearGradient(0, 0, 256, 0);
  edge.addColorStop(0, 'rgba(0,0,0,1)');
  edge.addColorStop(0.12, 'rgba(0,0,0,0)');
  edge.addColorStop(0.88, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = edge;
  g.fillRect(0, 0, 256, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function radialTexture(size: number, stops: [number, string][]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

export type ValleyScene = {
  group: THREE.Group;
  heightAt: (x: number, z: number) => number;
  update: (time: number) => void;
};

export function createValley(world: WorldData): ValleyScene {
  const { n, worldSize: SIZE } = world;
  const heightAt = makeHeightAt(world.heights, n, SIZE);
  const rnd = makeRnd(4242);
  const group = new THREE.Group();
  const { simplex2: simplex } = createNoise(7331);

  // terrain: baked albedo (lighting included), plus a shadow catcher for realtime shadows
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, n - 1, n - 1).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < n * n; i++) pos.setY(i, world.heights[i]);
  geo.deleteAttribute('normal');
  group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: terrainTexture(world), toneMapped: false })));
  const catcher = new THREE.Mesh(geo, new THREE.ShadowMaterial({ opacity: 0.34 }));
  catcher.receiveShadow = true;
  catcher.position.y = 0.01;
  group.add(catcher);

  // water
  const nc = document.createElement('canvas');
  nc.width = nc.height = 256;
  const ng = nc.getContext('2d')!;
  const im = ng.createImageData(256, 256);
  const e = 0.06;
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const n0 = simplex(x * e, y * e * 2.2);
      const nX = simplex((x + 1) * e, y * e * 2.2);
      const nY = simplex(x * e, (y + 1) * e * 2.2);
      const o = (y * 256 + x) * 4;
      im.data[o] = 128 + (n0 - nX) * 300;
      im.data[o + 1] = 128 + (n0 - nY) * 300;
      im.data[o + 2] = 255;
      im.data[o + 3] = 255;
    }
  }
  ng.putImageData(im, 0, 0);
  const nt = new THREE.CanvasTexture(nc);
  nt.wrapS = nt.wrapT = THREE.RepeatWrapping;
  nt.repeat.set(26, 26);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(SIZE, SIZE).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: '#2d5c63', roughness: 0.12, metalness: 0.15, normalMap: nt,
      normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.9, envMapIntensity: 1.4,
    }),
  );
  water.position.y = WATER_Y;
  water.receiveShadow = true;
  group.add(water);

  // waterfall: three translucent ribbons
  const ft = fallTexture(rnd);
  const top = A2W(FALL_TOP.a, FALL_TOP.b);
  const base = A2W(FALL_BASE.a, FALL_BASE.b);
  const dir = new THREE.Vector3(base.x - top.x, 0, base.z - top.z).normalize();
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const ribbons: THREE.Texture[] = [];
  for (const [w, off, op] of [[2.6, 0.0, 0.95], [1.8, 0.25, 0.75], [3.2, -0.2, 0.45]]) {
    const pts: THREE.Vector3[] = [];
    const m = 40;
    for (let i = 0; i <= m; i++) {
      const t = i / m;
      const fall = Math.pow(t, 1.6);
      const horiz = Math.min(1, t * 1.4) * 0.9 + off * 0.2;
      pts.push(new THREE.Vector3(
        top.x + dir.x * horiz * 1.6,
        lerp(FALL_TOP.h + 0.3, FALL_BASE.h + 0.2, fall),
        top.z + dir.z * horiz * 1.6,
      ));
    }
    const rg = new THREE.BufferGeometry();
    const p: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    pts.forEach((pt, i) => {
      const ww = w * (1 + (i / m) * 0.35);
      p.push(pt.x - (side.x * ww) / 2, pt.y, pt.z - (side.z * ww) / 2, pt.x + (side.x * ww) / 2, pt.y, pt.z + (side.z * ww) / 2);
      uv.push(0, 1 - (i / m) * 2.5, 1, 1 - (i / m) * 2.5);
      if (i < m) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    });
    rg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    rg.setIndex(idx);
    const tex = ft.clone();
    tex.needsUpdate = true;
    tex.wrapT = THREE.RepeatWrapping;
    tex.offset.y = off;
    ribbons.push(tex);
    group.add(new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false })));
  }

  // mist at the base of the fall
  const mt = radialTexture(128, [[0, 'rgba(255,255,255,.75)'], [1, 'rgba(255,255,255,0)']]);
  const mist: { s: THREE.Sprite; x: number; y: number; z: number; ph: number }[] = [];
  for (let i = 0; i < 70; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mt, transparent: true, opacity: 0.18 + rnd() * 0.22, depthWrite: false }));
    const r = rnd() * 3.5;
    const ang = rnd() * Math.PI * 2;
    const y = 0.4 + rnd() * (3 + (3.5 - r));
    s.position.set(base.x + Math.cos(ang) * r, y, base.z + Math.sin(ang) * r);
    const sc = 1.5 + rnd() * 3.5;
    s.scale.set(sc, sc, 1);
    group.add(s);
    mist.push({ s, x: s.position.x, y, z: s.position.z, ph: rnd() * 6.28 });
  }

  // instanced pines
  const crownProfile = [[0, 0], [0.55, 0.05], [0.2, 0.32], [0.45, 0.36], [0.14, 0.62], [0.32, 0.66], [0.06, 0.92], [0, 1]].map(([r, y]) => new THREE.Vector2(r, y));
  const crown = new THREE.LatheGeometry(crownProfile, 7);
  crown.translate(0, 0.35, 0);
  const trunk = new THREE.CylinderGeometry(0.035, 0.05, 0.5, 5);
  trunk.translate(0, 0.25, 0);
  const cm = new THREE.InstancedMesh(crown, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true }), world.treeCount);
  const tm = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: '#4a3a2c', roughness: 1 }), world.treeCount);
  cm.instanceMatrix.array.set(world.treeMatrices.subarray(0, world.treeCount * 16));
  tm.instanceMatrix.array.set(world.treeMatrices.subarray(0, world.treeCount * 16));
  const col = new THREE.Color();
  for (let i = 0; i < world.treeCount; i++) {
    col.setHSL(world.treeHsl[i * 3], world.treeHsl[i * 3 + 1], world.treeHsl[i * 3 + 2]);
    cm.setColorAt(i, col);
  }
  for (const m of [cm, tm]) {
    m.castShadow = true;
    m.frustumCulled = false;
    group.add(m);
  }

  // soft clouds
  const cc = document.createElement('canvas');
  cc.width = 512;
  cc.height = 256;
  const cg = cc.getContext('2d')!;
  for (let i = 0; i < 46; i++) {
    const x = 50 + rnd() * 412;
    const y = 90 + rnd() * 80;
    const r = 20 + rnd() * 70;
    const gr = cg.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,.32)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    cg.fillStyle = gr;
    cg.fillRect(0, 0, 512, 256);
  }
  const ct = new THREE.CanvasTexture(cc);
  const clouds: { s: THREE.Sprite; x: number; z: number; ph: number }[] = [];
  [[20, 34, 22, 26], [30, 40, 21, 22], [-10, 44, 18, 30], [8, 40, 24, 18], [-24, 22, 9, 22], [36, 10, 14, 22], [24, 22, 16, 16]].forEach(([a, b, y, s], i) => {
    const w = A2W(a, b);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, opacity: 0.6, depthWrite: false }));
    sp.position.set(w.x, y, w.z);
    sp.scale.set(s, s * 0.38, 1);
    group.add(sp);
    clouds.push({ s: sp, x: w.x, z: w.z, ph: i * 1.7 });
  });

  const update = (t: number) => {
    nt.offset.set(t * 0.004, t * 0.0025);
    ribbons.forEach((r, i) => {
      r.offset.y = -t * (0.35 + i * 0.08);
    });
    for (const m of mist) {
      m.s.position.set(m.x + Math.sin(t * 0.25 + m.ph) * 0.35, m.y + Math.sin(t * 0.4 + m.ph) * 0.15, m.z + Math.cos(t * 0.22 + m.ph) * 0.35);
    }
    for (const c of clouds) {
      c.s.position.x = c.x + Math.sin(t * 0.03 + c.ph) * 3;
      c.s.position.z = c.z + Math.cos(t * 0.025 + c.ph) * 2;
    }
  };
  return { group, heightAt, update };
}
