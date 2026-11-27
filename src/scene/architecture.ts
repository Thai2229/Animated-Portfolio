// Buildings ported from the mock (vanilla three objects). Each sect gets its own material set so it can glow on hover.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { A2W, BRIDGE, SITES, LAKE, WATER_Y, type SiteKey } from '../terrain/layout';

type V3 = [number, number, number];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rnd = (() => {
  let s = 20240;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
})();

function tileTexture(base: string, dark: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = dark;
  for (let x = 0; x < 256; x += 8) g.fillRect(x, 0, 2, 256);
  for (let y = 0; y < 256; y += 16) {
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.fillRect(0, y, 256, 2);
  }
  // rounded cover tiles in columns, each course overlapping the one below
  for (let x = 0; x < 256; x += 16) {
    const cg = g.createLinearGradient(x, 0, x + 16, 0);
    cg.addColorStop(0, 'rgba(0,0,0,.42)');
    cg.addColorStop(0.3, 'rgba(0,0,0,0)');
    cg.addColorStop(0.55, 'rgba(255,255,255,.14)');
    cg.addColorStop(0.8, 'rgba(0,0,0,0)');
    cg.addColorStop(1, 'rgba(0,0,0,.42)');
    g.fillStyle = cg;
    g.fillRect(x, 0, 16, 256);
  }
  for (let y = 0; y < 256; y += 32) {
    const rg = g.createLinearGradient(0, y, 0, y + 14);
    rg.addColorStop(0, 'rgba(0,0,0,.5)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.fillRect(0, y, 256, 14);
    g.fillStyle = 'rgba(255,255,255,.1)';
    g.fillRect(0, y + 14, 256, 2);
  }
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(255,255,255,${rnd() * 0.06})`;
    g.fillRect(rnd() * 256, rnd() * 256, 4, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function latticeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8c2a20';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#3a1410';
  g.lineWidth = 2;
  for (let i = 8; i < 128; i += 12) {
    g.beginPath(); g.moveTo(i, 10); g.lineTo(i, 118); g.stroke();
    g.beginPath(); g.moveTo(10, i); g.lineTo(118, i); g.stroke();
  }
  g.fillStyle = '#5a1a14';
  g.fillRect(0, 0, 128, 10);
  g.fillRect(0, 118, 128, 10);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
function stoneTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c9c3b6';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    for (let x = ((y / 32) % 2) * 24; x < 256; x += 48) {
      g.fillStyle = `rgba(${150 + rnd() * 40},${145 + rnd() * 35},${130 + rnd() * 30},1)`;
      g.fillRect(x + 1, y + 1, 46, 30);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// bridge masonry: coursed blocks with mortar, stains and a little lichen; tiles every 1.6 world units (see dress())
function bridgeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#6d6a60';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    let x = -((y / 32) % 2) * 30;
    while (x < 256) {
      const w = 44 + rnd() * 40;
      const k = rnd();
      g.fillStyle = `rgb(${150 + k * 38},${146 + k * 34},${134 + k * 30})`;
      g.fillRect(x + 2, y + 2, w - 4, 28);
      for (let i = 0; i < 5; i++) {
        g.fillStyle = `rgba(40,38,30,${0.05 + rnd() * 0.1})`;
        g.fillRect(x + rnd() * w, y + rnd() * 28, 2 + rnd() * 9, 2 + rnd() * 4);
      }
      if (rnd() < 0.3) {
        g.fillStyle = 'rgba(120,150,80,0.22)';
        g.fillRect(x + rnd() * w * 0.6, y + 4 + rnd() * 16, 8 + rnd() * 18, 4 + rnd() * 8);
      }
      x += w;
    }
  }
  for (let i = 0; i < 9; i++) {
    g.fillStyle = 'rgba(30,28,22,0.07)';
    g.fillRect(rnd() * 256, 0, 2 + rnd() * 4, 256);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

let TEXS: Record<string, THREE.CanvasTexture> | null = null;
function textures() {
  if (!TEXS) {
    TEXS = {
      tile: tileTexture('#4a5058', '#2c3036'),
      tileGreen: tileTexture('#3f6b52', '#264434'),
      tileBlue: tileTexture('#2c4f7a', '#1a3050'),
      lattice: latticeTexture(),
      stone: stoneTexture(),
      paving: stoneTexture(),
      bridge: bridgeTexture(),
    };
  }
  return TEXS;
}

const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
export function createMats() {
  const T = textures();
  return {
    tile: std({ map: T.tile, roughness: 0.6, side: THREE.DoubleSide }),
    tileGreen: std({ map: T.tileGreen, roughness: 0.45, side: THREE.DoubleSide }),
    tileBlue: std({ map: T.tileBlue, roughness: 0.4, side: THREE.DoubleSide }),
    red: std({ color: '#8f2a1f', roughness: 0.7 }),
    lattice: std({ map: T.lattice, roughness: 0.8 }),
    plaster: std({ color: '#e4dccb', roughness: 0.9 }),
    stone: std({ map: T.stone, roughness: 0.95 }),
    paving: std({ map: T.paving, roughness: 0.95 }),
    bridge: std({ map: T.bridge, roughness: 0.95, vertexColors: true }),
    marble: std({ color: '#e8e4dc', roughness: 0.7 }),
    bracket: std({ color: '#2f5a5c', roughness: 0.7 }),
    gold: std({ color: '#c8a04a', roughness: 0.35, metalness: 0.6 }),
    wood: std({ color: '#6b4a32', roughness: 0.85 }),
    lantern: std({ color: '#d0402c', emissive: '#a02010', emissiveIntensity: 0.6, roughness: 0.6 }),
    lanternGlow: std({ color: '#f2d9a0', emissive: '#ffae4a', emissiveIntensity: 0.75, roughness: 0.5 }),
    door: std({ color: '#5d1b13', roughness: 0.6 }),
    granite: std({ color: '#aaa598', roughness: 1 }),
    bronze: std({ color: '#6e5a36', roughness: 0.45, metalness: 0.7 }),
    leaf: std({ color: '#3f6d3a', roughness: 1, flatShading: true }),
    leafLight: std({ color: '#5f8c44', roughness: 1, flatShading: true }),
  };
}
export type Mats = ReturnType<typeof createMats>;

const mesh = (g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[]) => new THREE.Mesh(g, m);
// primitives are shared by key: every sect is baked into a few merged meshes, so the sources are only read
const prims = new Map<string, THREE.BufferGeometry>();
const prim = (key: string, make: () => THREE.BufferGeometry) => {
  let g = prims.get(key);
  if (!g) {
    g = make();
    prims.set(key, g);
  }
  return g;
};
const box = (w: number, h: number, d: number) => prim(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (rt: number, rb: number, h: number, s: number) => prim(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const cone = (r: number, h: number, s = 6) => prim(`n${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const sph = (r: number, ws = 8, hs = 6) => prim(`s${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
const plane = (w: number, h: number) => prim(`p${w},${h}`, () => new THREE.PlaneGeometry(w, h));
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// Bakes every single-material mesh under root into one mesh per material (and shadow flags): a sect is a handful
// of draw calls however much detail it carries. Multi-material meshes (hall walls) stay as they are.
export function mergeStatic(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const rel = new THREE.Matrix4();
  const buckets = new Map<string, { mat: THREE.Material; cast: boolean; recv: boolean; geos: THREE.BufferGeometry[] }>();
  const baked: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    const key = `${m.material.uuid}${m.castShadow}${m.receiveShadow}`;
    let b = buckets.get(key);
    if (!b) {
      b = { mat: m.material, cast: m.castShadow, recv: m.receiveShadow, geos: [] };
      buckets.set(key, b);
    }
    b.geos.push(m.geometry.clone().applyMatrix4(rel.multiplyMatrices(inv, m.matrixWorld)));
    baked.push(m);
  });
  baked.forEach((m) => m.removeFromParent());
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    b.geos.forEach((x) => x.dispose());
    if (!merged) throw new Error('sect detail: mismatched geometry attributes');
    const m = mesh(merged, b.mat);
    m.castShadow = b.cast;
    m.receiveShadow = b.recv;
    m.raycast = () => {}; // hover and click use the hit proxy, not thousands of triangles
    root.add(m);
  }
}

function builders(M: Mats, fine: boolean) {
  const put = (g: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, ry = 0) => {
    const m = mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    g.add(m);
    return m;
  };
  // thin square beam from a to b (t across, u deep)
  const strut = (g: THREE.Object3D, a: V3, b: V3, mat: THREE.Material, t = 0.04, u = t) => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const m = mesh(box(t, u, 1), mat);
    m.scale.z = va.distanceTo(vb);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(Z_AXIS, vb.sub(va).normalize());
    g.add(m);
  };
  // a cone or cylinder standing on `at`, its axis pointing along dir
  const aimed = (g: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, at: V3, dir: V3) => {
    const m = mesh(geo, mat);
    m.position.set(...at);
    m.quaternion.setFromUnitVectors(Y_AXIS, new THREE.Vector3(...dir).normalize());
    g.add(m);
  };
  // curved hip roof with upturned corners
  function hipRoof(w: number, d: number, h: number, mat: THREE.Material, lift = 0.35) {
    const g = new THREE.Group();
    const n = 26;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const half = (w - d) / 2;
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const u = (i / n) * 2 - 1;
        const v = (j / n) * 2 - 1;
        const x = (u * w) / 2;
        const z = (v * d) / 2;
        const mx = Math.max(0, (Math.abs(x) - half) / (d / 2));
        const m = Math.min(1, Math.max(mx, Math.abs(v)));
        const y = h * Math.pow(1 - m, 1.55) + lift * Math.pow(Math.abs(u) * Math.abs(v), 3) + lift * 0.35 * Math.pow(m, 6);
        pos.push(x, y, z);
        uv.push(x * 1.2, m * 3);
        if (i < n && j < n) {
          const k = j * (n + 1) + i;
          idx.push(k, k + n + 1, k + 1, k + 1, k + n + 1, k + n + 2);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const roof = mesh(geo, mat);
    roof.castShadow = roof.receiveShadow = true;
    g.add(roof);
    const ridgeLen = Math.max(0.2, w - d + 0.1);
    const ridge = mesh(box(ridgeLen, 0.09, 0.09), M.tile);
    ridge.position.y = h + 0.03;
    g.add(ridge);
    [-1, 1].forEach((s) => {
      const orn = mesh(new THREE.ConeGeometry(0.06, 0.24, 6), M.gold);
      orn.position.set((s * ridgeLen) / 2, h + 0.13, 0);
      orn.rotation.z = -s * 0.5;
      g.add(orn);
      // owl-tail ridge ends: a tile block topped by a curled horn
      put(g, box(0.08, 0.2, 0.11), M.tile, (s * (ridgeLen + 0.1)) / 2, h + 0.12, 0);
      aimed(g, cone(0.035, 0.2, 5), M.gold, [(s * (ridgeLen + 0.1)) / 2 - s * 0.03, h + 0.3, 0], [-s * 0.5, 1, 0]);
    });
    // eaves: red fascia board following the upturned edge, round end tiles, horns on the corners
    const edgeY = (u: number, v: number) => lift * Math.pow(Math.abs(u) * Math.abs(v), 3) + lift * 0.35;
    const step = 0.1 + (1 - Number(fine)) * 0.14;
    const nl = Math.max(4, Math.round(w / (step * 1.6)));
    const ns = Math.max(3, Math.round(d / (step * 1.6)));
    for (const sg of [-1, 1]) {
      let pl: V3 | null = null;
      let ps: V3 | null = null;
      for (let i = 0; i <= nl; i++) {
        const u = (i / nl) * 2 - 1;
        const p: V3 = [(u * w) / 2, edgeY(u, sg) - 0.02, (sg * d) / 2 + sg * 0.012];
        if (pl) strut(g, pl, p, M.red, 0.025, 0.07);
        pl = p;
        const tile = put(g, cyl(0.026, 0.026, 0.05, 6), M.gold, p[0], p[1], p[2] + sg * 0.02);
        tile.rotation.x = (sg * Math.PI) / 2;
      }
      for (let i = 0; i <= ns; i++) {
        const v = (i / ns) * 2 - 1;
        const p: V3 = [(sg * w) / 2 + sg * 0.012, edgeY(sg, v) - 0.02, (v * d) / 2];
        if (ps) strut(g, ps, p, M.red, 0.025, 0.07);
        ps = p;
        const tile = put(g, cyl(0.026, 0.026, 0.05, 6), M.gold, p[0] + sg * 0.02, p[1], p[2]);
        tile.rotation.z = (-sg * Math.PI) / 2;
      }
    }
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      aimed(g, cone(0.045, 0.22, 5), M.gold, [(sx * w) / 2, lift * 1.35 + 0.06, (sz * d) / 2], [sx * 0.7, 1, sz * 0.7]);
    });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const a = new THREE.Vector3((sx * ridgeLen) / 2, h, 0);
      const b = new THREE.Vector3((sx * w) / 2, lift * 0.95, (sz * d) / 2);
      const hip = mesh(cyl(0.035, 0.035, a.distanceTo(b), 5), M.tile);
      hip.position.copy(a).add(b).multiplyScalar(0.5);
      hip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      g.add(hip);
      [0.3, 0.5, 0.7].forEach((t) => {
        const q = a.clone().lerp(b, t);
        put(g, sph(0.03, 5, 4), M.gold, q.x, q.y + 0.045, q.z);
      });
    });
    return g;
  }

  // polar roof (pagoda / round hall); corners > 0 gives an n-gon with upturned tips
  function polarRoof(r: number, h: number, mat: THREE.Material, corners = 0, lift = 0.25) {
    const out = new THREE.Group();
    const n = 18;
    const segs = 48;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= segs; i++) {
        const rr = j / n;
        const th = (i / segs) * Math.PI * 2;
        let k = 1;
        let cornerLift = 0;
        if (corners) {
          k = 1 / Math.cos(((th + Math.PI / corners) % ((2 * Math.PI) / corners)) - Math.PI / corners);
          cornerLift = Math.pow(Math.abs(Math.cos((th * corners) / 2)), 10) * lift * Math.pow(rr, 4);
        }
        pos.push(Math.cos(th) * r * rr * k, h * Math.pow(1 - rr, 1.55) + cornerLift, Math.sin(th) * r * rr * k);
        uv.push((i / segs) * 8, rr * 3);
        if (j < n && i < segs) {
          const a = j * (segs + 1) + i;
          idx.push(a, a + 1, a + segs + 1, a + 1, a + segs + 2, a + segs + 1);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = mesh(geo, mat);
    m.castShadow = m.receiveShadow = true;
    out.add(m);
    // raised tile ridges running down the roof (one per hip, or every 22.5 degrees on a round roof)
    const nrib = corners || 16;
    const onRoof = (th: number, rr: number): V3 => {
      let k = 1;
      let up = 0;
      if (corners) {
        k = 1 / Math.cos(((th + Math.PI / corners) % ((2 * Math.PI) / corners)) - Math.PI / corners);
        up = Math.pow(Math.abs(Math.cos((th * corners) / 2)), 10) * lift * Math.pow(rr, 4);
      }
      return [Math.cos(th) * r * rr * k, h * Math.pow(1 - rr, 1.55) + up + 0.012, Math.sin(th) * r * rr * k];
    };
    for (let j = 0; j < nrib; j++) {
      const th = (j / nrib) * Math.PI * 2;
      for (let q = 0; q < 6; q++) strut(out, onRoof(th, 0.1 + q * 0.15), onRoof(th, 0.1 + (q + 1) * 0.15), mat, 0.03, 0.03);
      if (corners) {
        const tip = onRoof(th, 1);
        aimed(out, cone(0.04, 0.2, 5), M.gold, [tip[0] * 1.01, tip[1] + 0.07, tip[2] * 1.01], [Math.cos(th) * 0.7, 1, Math.sin(th) * 0.7]);
      }
    }
    // round end tiles along the rim
    const nt = corners * 5 || 40;
    for (let j = 0; j < nt && fine; j++) {
      const th = ((j + 0.5) / nt) * Math.PI * 2;
      const p = onRoof(th, 1);
      aimed(out, cyl(0.024, 0.024, 0.05, 6), M.gold, [p[0], p[1] - 0.01, p[2]], [Math.cos(th), 0.15, Math.sin(th)]);
    }
    return out;
  }

  // pillar plinth plus the bracket set (dougong) that carries the eave: block, arm across the bay, cantilever outward
  function pillar(g: THREE.Object3D, x: number, z: number, h: number, ox: number, oz: number) {
    put(g, cyl(0.075, 0.09, 0.06, 8), M.granite, x, 0.03, z);
    put(g, cyl(0.055, 0.055, 0.03, 8), M.bracket, x, h - 0.015, z);
    if (!fine) return;
    const turn = Math.abs(ox) * Math.PI / 2;
    put(g, box(0.15, 0.05, 0.15), M.bracket, x, h + 0.02, z);
    put(g, box(0.36, 0.035, 0.07), M.bracket, x, h + 0.07, z, turn);
    put(g, box(0.07, 0.04, 0.32), M.bracket, x + ox * 0.14, h + 0.03, z + oz * 0.14, turn);
    put(g, box(0.05, 0.03, 0.22), M.gold, x + ox * 0.26, h + 0.075, z + oz * 0.26, turn);
  }

  // flight of steps going down along local +z from the platform edge at (x, top, z0), with sloped side rails
  function stairs(g: THREE.Object3D, x: number, top: number, z0: number, w: number, n: number, rise: number, run: number) {
    for (let i = 0; i < n; i++) {
      const hh = top - (i + 1) * rise + 0.12;
      put(g, box(w, hh, run), M.marble, x, hh / 2 - 0.12 + 0.004, z0 + (i + 0.5) * run);
    }
    for (const sx of [-1, 1]) {
      const rx = x + sx * (w / 2 + 0.05);
      strut(g, [rx, top + 0.04, z0], [rx, 0.07, z0 + n * run], M.marble, 0.08, 0.07);
      put(g, sph(0.05, 6, 4), M.marble, rx, top + 0.1, z0 - 0.02);
    }
  }

  function bonsai(s = 1) {
    const g = new THREE.Group();
    put(g, cyl(0.1 * s, 0.075 * s, 0.1 * s, 8), M.bronze, 0, 0.05 * s, 0);
    strut(g, [0, 0.1 * s, 0], [0.04 * s, 0.26 * s, 0.02 * s], M.wood, 0.03 * s);
    for (const [x, y, z, r] of [[0.04, 0.3, 0.02, 0.1], [-0.07, 0.24, 0.0, 0.07], [0.12, 0.25, -0.03, 0.065]]) {
      const c = put(g, sph(r * s, 6, 4), M.leaf, x * s, y * s, z * s);
      c.scale.y = 0.7;
    }
    return g;
  }

  function pine(s = 1) {
    const g = new THREE.Group();
    put(g, cyl(0.03 * s, 0.045 * s, 0.4 * s, 5), M.wood, 0, 0.2 * s, 0);
    [[0.3, 0.3, 0.3], [0.2, 0.55, 0.3], [0.12, 0.8, 0.27]].forEach(([r, y, hh], i) => {
      put(g, cone(r * s, hh * s * 1.3, 7), M.leaf, 0, (y + 0.1) * s, 0, i);
    });
    return g;
  }

  function lion() {
    const g = new THREE.Group();
    put(g, box(0.22, 0.09, 0.3), M.granite, 0, 0.045, 0);
    put(g, box(0.12, 0.11, 0.2), M.granite, 0, 0.145, -0.02);
    put(g, sph(0.075, 7, 5), M.granite, 0, 0.2, 0.07);
    put(g, sph(0.062, 7, 5), M.granite, 0, 0.27, 0.09);
    put(g, sph(0.035, 6, 4), M.granite, 0.07, 0.115, 0.1);
    for (const sx of [-1, 1]) {
      aimed(g, cone(0.022, 0.05, 4), M.granite, [sx * 0.045, 0.335, 0.08], [sx * 0.3, 1, 0]);
      put(g, cyl(0.014, 0.014, 0.1, 4), M.granite, sx * 0.04, 0.1, 0.13);
    }
    aimed(g, cone(0.03, 0.12, 5), M.granite, [0, 0.2, -0.14], [0, 0.6, -1]);
    return g;
  }
  function lionPair(sep: number) {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) {
      const l = lion();
      l.position.x = sx * sep;
      g.add(l);
    }
    return g;
  }

  function incense() {
    const g = new THREE.Group();
    put(g, box(0.36, 0.06, 0.36), M.stone, 0, 0.03, 0);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      put(g, cyl(0.03, 0.025, 0.12, 5), M.bronze, Math.cos(a) * 0.11, 0.12, Math.sin(a) * 0.11);
    }
    put(g, cyl(0.15, 0.11, 0.16, 12), M.bronze, 0, 0.26, 0);
    const rim = put(g, new THREE.TorusGeometry(0.15, 0.015, 4, 12), M.gold, 0, 0.34, 0);
    rim.rotation.x = Math.PI / 2;
    for (const sx of [-1, 1]) {
      const h = put(g, new THREE.TorusGeometry(0.035, 0.01, 4, 8), M.bronze, sx * 0.16, 0.32, 0);
      h.rotation.y = Math.PI / 2;
    }
    put(g, cone(0.11, 0.1, 8), M.bronze, 0, 0.41, 0);
    put(g, sph(0.03, 6, 4), M.gold, 0, 0.48, 0);
    return g;
  }

  function well() {
    const g = new THREE.Group();
    put(g, cyl(0.27, 0.3, 0.26, 14), M.granite, 0, 0.13, 0);
    put(g, cyl(0.2, 0.2, 0.02, 14), M.bracket, 0, 0.255, 0);
    for (const sx of [-1, 1]) put(g, box(0.04, 0.5, 0.04), M.wood, sx * 0.3, 0.45, 0);
    put(g, box(0.7, 0.04, 0.05), M.wood, 0, 0.7, 0);
    put(g, cone(0.5, 0.2, 4), M.tile, 0, 0.82, 0, Math.PI / 4);
    put(g, cyl(0.04, 0.035, 0.07, 6), M.wood, 0.05, 0.5, 0);
    strut(g, [0.05, 0.69, 0], [0.05, 0.54, 0], M.wood, 0.01);
    return g;
  }

  function podium(w: number, d: number, h: number, steps = true) {
    const g = new THREE.Group();
    put(g, box(w + 0.36, 0.07, d + 0.4), M.stone, 0, 0.035, 0);
    const p = mesh(box(w, h, d), M.stone);
    p.position.y = h / 2;
    g.add(p);
    const cap = mesh(box(w + 0.06, 0.04, d + 0.06), M.marble);
    cap.position.y = h;
    g.add(cap);
    const post = box(0.05, 0.16, 0.05);
    const posts = Math.round(w / 0.35);
    for (let i = 0; i <= posts; i++) {
      for (const z of [-d / 2, d / 2]) {
        if (steps && z > 0 && Math.abs(i / posts - 0.5) < 0.18) continue;
        const b = mesh(post, M.marble);
        b.position.set(-w / 2 + (i * w) / posts, h + 0.08, z);
        g.add(b);
        put(g, sph(0.032, 6, 4), M.marble, -w / 2 + (i * w) / posts, h + 0.19, z);
      }
    }
    const postsD = Math.round(d / 0.35);
    for (let i = 0; i <= postsD; i++) {
      for (const x of [-w / 2, w / 2]) {
        const b = mesh(post, M.marble);
        b.position.set(x, h + 0.08, -d / 2 + (i * d) / postsD);
        g.add(b);
        put(g, sph(0.032, 6, 4), M.marble, x, h + 0.19, -d / 2 + (i * d) / postsD);
      }
    }
    [[w, -d / 2, 0], [w, d / 2, 0], [d, 0, -w / 2], [d, 0, w / 2]].forEach(([len, z, x], k) => {
      let railW = 0.04;
      let railD = len;
      if (k < 2) {
        railW = len;
        railD = 0.04;
      }
      const r = mesh(box(railW, 0.03, railD), M.marble);
      r.position.set(x, h + 0.16, z);
      g.add(r);
    });
    if (steps) {
      for (let s = 0; s < 5; s++) {
        const st = mesh(box(w * 0.3, h / 5, 0.14), M.marble);
        st.position.set(0, h / 10 + (s * h) / 5, d / 2 + 0.07 + (4 - s) * 0.14);
        g.add(st);
      }
      for (const sx of [-1, 1]) {
        const rx = sx * (w * 0.15 + 0.08);
        strut(g, [rx, 0.05, d / 2 + 0.8], [rx, h + 0.04, d / 2 + 0.02], M.marble, 0.09, 0.07);
        put(g, sph(0.055, 6, 4), M.marble, rx, h + 0.09, d / 2 - 0.01);
      }
    }
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
    });
    return g;
  }

  function hallBody(w: number, d: number, h: number) {
    const g = new THREE.Group();
    const latt = M.lattice.clone();
    latt.map = M.lattice.map!.clone();
    latt.map.repeat.set(Math.round(w / 0.5), 1);
    latt.map.needsUpdate = true;
    const wall = mesh(box(w - 0.2, h, d - 0.2), [M.plaster, M.plaster, M.red, M.red, latt, M.lattice]);
    wall.position.y = h / 2;
    g.add(wall);
    const nx = Math.max(2, Math.round(w / 0.55));
    const nz = Math.max(2, Math.round(d / 0.55));
    const col = cyl(0.045, 0.05, h, 8);
    for (let i = 0; i <= nx; i++) {
      for (const z of [-d / 2, d / 2]) {
        const x = -w / 2 + (i * w) / nx;
        if (z > 0 && Math.abs(x) < 0.2 && w >= 1.5) continue; // the door bay stays open
        const c = mesh(col, M.red);
        c.position.set(x, h / 2, z);
        g.add(c);
        pillar(g, x, z, h, 0, Math.sign(z));
      }
    }
    for (let i = 1; i < nz; i++) {
      for (const x of [-w / 2, w / 2]) {
        const c = mesh(col, M.red);
        c.position.set(x, h / 2, -d / 2 + (i * d) / nz);
        g.add(c);
        pillar(g, x, -d / 2 + (i * d) / nz, h, Math.sign(x), 0);
      }
    }
    // front: stone kick wall, transom rail, and a studded double door with a lintel plaque
    const z0 = d / 2 - 0.1 + 0.012;
    put(g, box(w - 0.2, h * 0.16, 0.03), M.granite, 0, h * 0.08, z0);
    put(g, box(w - 0.2, 0.035, 0.035), M.wood, 0, h * 0.6, z0 + 0.004);
    if (w >= 1.5) {
      for (const sx of [-1, 1]) {
        put(g, box(0.21, h * 0.62, 0.03), M.door, sx * 0.115, h * 0.31, z0 + 0.02);
        put(g, box(0.03, h * 0.66, 0.045), M.wood, sx * 0.25, h * 0.33, z0 + 0.02);
        for (const yy of [0.18, 0.34, 0.5]) {
          for (const dx of [0.06, 0.17]) put(g, sph(0.014, 5, 4), M.gold, sx * dx, h * (yy + 0.04), z0 + 0.04);
        }
      }
      put(g, box(0.56, 0.045, 0.05), M.wood, 0, h * 0.64 + 0.02, z0 + 0.02);
      put(g, box(0.28, 0.07, 0.03), M.gold, 0, h * 0.64 + 0.09, z0 + 0.02);
      put(g, box(0.7, 0.03, 0.18), M.marble, 0, 0.015, z0 + 0.1);
    }
    // side windows: lattice panes in wooden frames
    for (const sx of [-1, 1]) {
      for (const zz of [-d * 0.2, d * 0.2]) {
        const wx = (sx * (w - 0.2)) / 2 + sx * 0.012;
        put(g, plane(0.34, h * 0.42), M.lattice, wx, h * 0.55, zz, (sx * Math.PI) / 2);
        for (const yy of [-1, 1]) put(g, box(0.03, 0.03, 0.4), M.wood, wx, h * 0.55 + yy * h * 0.21, zz);
        for (const zo of [-1, 1]) put(g, box(0.03, h * 0.45, 0.03), M.wood, wx, h * 0.55, zz + zo * 0.185);
      }
    }
    if (fine) {
      // projecting rafter ends under the eave, and red paper lanterns at the front corners
      const rs = 0.13;
      for (let i = 0; i * rs <= w + 0.1; i++) {
        for (const z of [-1, 1]) put(g, box(0.035, 0.035, 0.3), M.wood, -w / 2 - 0.05 + i * rs, h + 0.17, z * (d / 2 + 0.27));
      }
      for (let i = 0; i * rs <= d + 0.1; i++) {
        for (const x of [-1, 1]) put(g, box(0.3, 0.035, 0.035), M.wood, x * (w / 2 + 0.27), h + 0.17, -d / 2 - 0.05 + i * rs);
      }
      for (const sx of [-1, 1]) {
        strut(g, [sx * (w / 2 + 0.05), h + 0.1, d / 2 + 0.25], [sx * (w / 2 + 0.05), h - 0.06, d / 2 + 0.25], M.wood, 0.008);
        const l = put(g, sph(0.065, 8, 6), M.lantern, sx * (w / 2 + 0.05), h - 0.14, d / 2 + 0.25);
        l.scale.y = 1.25;
        put(g, cyl(0.03, 0.03, 0.02, 6), M.gold, sx * (w / 2 + 0.05), h - 0.04, d / 2 + 0.25);
      }
    }
    const beam = mesh(box(w + 0.08, 0.12, d + 0.08), M.bracket);
    beam.position.y = h + 0.06;
    g.add(beam);
    const beam2 = mesh(box(w + 0.2, 0.06, d + 0.2), M.red);
    beam2.position.y = h + 0.15;
    g.add(beam2);
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
    });
    return g;
  }

  function hall({ w, d, h, roofMat = M.tile, double = false, base = 0.3 }: {
    w: number; d: number; h: number; roofMat?: THREE.Material; double?: boolean; base?: number;
  }) {
    const g = new THREE.Group();
    g.add(podium(w + 0.7, d + 0.8, base));
    const body = hallBody(w, d, h);
    body.position.y = base;
    g.add(body);
    let y = base + h + 0.18;
    if (double) {
      const skirt = hipRoof(w + 1.0, d + 1.0, 0.35, roofMat, 0.22);
      skirt.position.y = y;
      g.add(skirt);
      const up = hallBody(w * 0.72, d * 0.68, h * 0.55);
      up.position.y = y + 0.2;
      g.add(up);
      y += 0.2 + h * 0.55 + 0.18;
      const r = hipRoof(w * 0.72 + 1.0, d * 0.68 + 0.95, h * 0.62, roofMat, 0.3);
      r.position.y = y;
      g.add(r);
    } else {
      const r = hipRoof(w + 0.95, d + 0.9, h * 0.66, roofMat, 0.3);
      r.position.y = y;
      g.add(r);
    }
    return g;
  }

  function pagoda(levels: number, r: number) {
    const g = new THREE.Group();
    g.add(podium(r * 2.8, r * 2.8, 0.3));
    let y = 0.3;
    for (let i = 0; i < levels; i++) {
      const s = r * (1 - i * 0.09);
      let hh = 0.5;
      if (i === 0) hh = 0.75;
      const body = mesh(cyl(s * 0.82, s * 0.86, hh, 8), M.red);
      body.position.y = y + hh / 2;
      body.castShadow = true;
      g.add(body);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        const c = mesh(cyl(0.035, 0.035, hh, 6), M.red);
        c.position.set(Math.cos(a) * s * 0.9, y + hh / 2, Math.sin(a) * s * 0.9);
        g.add(c);
      }
      const br = mesh(cyl(s * 0.95, s * 0.95, 0.08, 8), M.bracket);
      br.position.y = y + hh + 0.04;
      g.add(br);
      // lattice windows (a door on the ground storey), a balcony with a lotus-capped rail, and a bracket at every pillar
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        const apo = s * 0.84 * Math.cos(Math.PI / 8) + 0.008;
        let pane = M.lattice;
        if (i === 0 && k === 5) pane = M.door;
        put(g, plane(s * 0.46, hh * 0.62), pane, Math.cos(a) * apo, y + hh * 0.52, Math.sin(a) * apo, Math.PI / 2 - a);
        const vx = Math.cos(a + Math.PI / 8) * s;
        const vz = Math.sin(a + Math.PI / 8) * s;
        put(g, cyl(0.05, 0.06, 0.05, 6), M.granite, Math.cos(a) * s * 0.9, y + 0.025, Math.sin(a) * s * 0.9);
        put(g, box(0.06, 0.05, 0.06), M.bracket, Math.cos(a) * s * 0.9, y + hh + 0.02, Math.sin(a) * s * 0.9);
        put(g, cyl(0.014, 0.014, 0.13, 4), M.red, vx * 1.06, y + 0.065, vz * 1.06);
        put(g, sph(0.025, 5, 4), M.gold, vx * 1.06, y + 0.14, vz * 1.06);
      }
      const bal = mesh(new THREE.TorusGeometry(s * 1.06, 0.012, 4, 8), M.marble);
      bal.rotation.x = Math.PI / 2;
      bal.position.y = y + 0.12;
      g.add(bal);
      const roof = polarRoof(s * 1.55, 0.42, M.tile, 8, 0.22);
      roof.position.y = y + hh + 0.06;
      g.add(roof);
      const bell = mesh(new THREE.SphereGeometry(0.035, 6, 4), M.gold);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const b2 = bell.clone();
        b2.position.set(Math.cos(a) * s * 1.6, y + hh + 0.1, Math.sin(a) * s * 1.6);
        g.add(b2);
      }
      y += hh + 0.32;
    }
    const spire = mesh(cyl(0.02, 0.05, 1.0, 6), M.gold);
    spire.position.y = y + 0.4;
    g.add(spire);
    // finial: lotus base, bowl, stacked wheels, water-flame; gilt chains run down to the eave tips
    put(g, cyl(0.16, 0.2, 0.08, 8), M.granite, 0, y + 0.04, 0);
    put(g, cyl(0.1, 0.14, 0.1, 8), M.gold, 0, y + 0.12, 0);
    const bowl = put(g, sph(0.1, 8, 5), M.gold, 0, y + 0.18, 0);
    bowl.scale.y = 0.6;
    put(g, cone(0.045, 0.2, 6), M.gold, 0, y + 1.0, 0);
    put(g, sph(0.035, 6, 4), M.gold, 0, y + 1.17, 0);
    const topR = r * (1 - (levels - 1) * 0.09) * 1.55;
    for (let k = 0; k < 8 && fine; k++) {
      const a = (k / 8) * Math.PI * 2;
      strut(g, [0, y + 0.85, 0], [Math.cos(a) * topR, y - 0.32 + 0.18 + 0.2, Math.sin(a) * topR], M.gold, 0.008);
    }
    for (let k = 0; k < 5; k++) {
      const ring = mesh(new THREE.TorusGeometry(0.07 - k * 0.008, 0.015, 5, 12), M.gold);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y + 0.12 + k * 0.14;
      g.add(ring);
    }
    return g;
  }

  function roundTemple() {
    const g = new THREE.Group();
    let y = 0;
    for (let i = 0; i < 3; i++) {
      const R = 2.4 - i * 0.45;
      const t = mesh(cyl(R, R + 0.05, 0.22, 48), M.marble);
      t.position.y = y + 0.11;
      t.castShadow = t.receiveShadow = true;
      g.add(t);
      const posts = Math.round(R * 14);
      const pg = box(0.05, 0.15, 0.05);
      for (let k = 0; k < posts; k++) {
        const a = (k / posts) * Math.PI * 2;
        const p = mesh(pg, M.marble);
        p.position.set(Math.cos(a) * (R - 0.04), y + 0.3, Math.sin(a) * (R - 0.04));
        g.add(p);
        if (k % 2 === 0) put(g, sph(0.03, 5, 4), M.marble, Math.cos(a) * (R - 0.04), y + 0.4, Math.sin(a) * (R - 0.04));
      }
      const rail = mesh(new THREE.TorusGeometry(R - 0.04, 0.02, 4, 64), M.marble);
      rail.rotation.x = Math.PI / 2;
      rail.position.y = y + 0.38;
      g.add(rail);
      y += 0.22;
    }
    const body = mesh(cyl(0.85, 0.85, 0.7, 32), M.lattice);
    body.position.y = y + 0.35;
    body.castShadow = true;
    g.add(body);
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const c = mesh(cyl(0.04, 0.04, 0.7, 6), M.red);
      c.position.set(Math.cos(a) * 0.95, y + 0.35, Math.sin(a) * 0.95);
      g.add(c);
      put(g, cyl(0.06, 0.07, 0.05, 8), M.granite, Math.cos(a) * 0.95, y + 0.025, Math.sin(a) * 0.95);
      put(g, box(0.11, 0.05, 0.11), M.bracket, Math.cos(a) * 0.95, y + 0.72, Math.sin(a) * 0.95, Math.PI / 2 - a);
      if (fine) {
        put(g, box(0.05, 0.04, 0.2), M.bracket, Math.cos(a) * 1.05, y + 0.73, Math.sin(a) * 1.05, Math.PI / 2 - a);
        put(g, box(0.04, 0.03, 0.12), M.gold, Math.cos(a) * 1.17, y + 0.77, Math.sin(a) * 1.17, Math.PI / 2 - a);
      }
      // latticed doors on the four axes
      if (k % 4 === 0) {
        const d = put(g, plane(0.34, 0.5), M.door, Math.cos(a) * 0.86, y + 0.3, Math.sin(a) * 0.86, Math.PI / 2 - a);
        d.scale.x = 1;
        put(g, box(0.42, 0.05, 0.05), M.gold, Math.cos(a) * 0.87, y + 0.58, Math.sin(a) * 0.87, Math.PI / 2 - a);
      }
    }
    // four stairs climbing the three tiers, and paper lanterns round the lower eave
    for (let k = 0; k < 4; k++) {
      const f = new THREE.Group();
      f.rotation.y = (k * Math.PI) / 2;
      stairs(f, 0, 0.66, 1.5, 0.8, 6, 0.11, 0.3);
      g.add(f);
    }
    for (let k = 0; fine && k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + 0.13;
      const lx = Math.cos(a) * 1.45;
      const lz = Math.sin(a) * 1.45;
      strut(g, [lx, y + 0.2, lz], [lx, y + 0.08, lz], M.wood, 0.008);
      const l = put(g, sph(0.06, 8, 6), M.lantern, lx, y + 0.02, lz);
      l.scale.y = 1.25;
    }
    y += 0.7;
    const sizes = [1.55, 1.15, 0.78];
    sizes.forEach((s, i) => {
      const br = mesh(cyl(s * 0.66, s * 0.66, 0.12, 32), M.bracket);
      br.position.y = y + 0.06;
      g.add(br);
      const r = polarRoof(s, 0.36, M.tileBlue);
      r.position.y = y + 0.12;
      g.add(r);
      if (i < 2) {
        const drum = mesh(cyl(sizes[i + 1] * 0.62, sizes[i + 1] * 0.62, 0.32, 32), M.red);
        drum.position.y = y + 0.3;
        g.add(drum);
      }
      y += 0.42;
    });
    const fin = mesh(new THREE.SphereGeometry(0.12, 16, 12), M.gold);
    fin.position.y = y + 0.08;
    g.add(fin);
    put(g, cyl(0.06, 0.12, 0.06, 12), M.granite, 0, y - 0.01, 0);
    put(g, cone(0.04, 0.24, 8), M.gold, 0, y + 0.3, 0);
    for (let k = 0; k < 3; k++) put(g, cyl(0.1 - k * 0.025, 0.1 - k * 0.025, 0.012, 12), M.gold, 0, y + 0.19 + k * 0.03, 0);
    return g;
  }

  function wallLoop(pts: number[][], h = 0.45) {
    const g = new THREE.Group();
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const mx = (a[0] + b[0]) / 2;
      const mz = (a[1] + b[1]) / 2;
      const w = mesh(box(len, h, 0.14), M.plaster);
      w.position.set(mx, h / 2, mz);
      w.rotation.y = -ang;
      w.castShadow = w.receiveShadow = true;
      g.add(w);
      const c = mesh(box(len + 0.1, 0.07, 0.3), M.tile);
      c.position.set(mx, h + 0.03, mz);
      c.rotation.y = -ang;
      g.add(c);
      const base = mesh(box(len, 0.1, 0.18), M.red);
      base.position.set(mx, h * 0.85, mz);
      base.rotation.y = -ang;
      g.add(base);
      put(g, box(len, 0.1, 0.2), M.granite, mx, 0.05, mz, -ang);
      // red pilasters every ~1.2 units, a lattice vent between each pair
      const np = Math.max(1, Math.round(len / 1.2));
      for (let q = 0; q <= np; q++) {
        const t = q / np - 0.5;
        put(g, box(0.1, h + 0.06, 0.18), M.red, mx + Math.cos(ang) * len * t, (h + 0.06) / 2, mz + Math.sin(ang) * len * t, -ang);
        if (q < np && fine) {
          const t2 = (q + 0.5) / np - 0.5;
          put(g, plane(0.5, 0.2), M.lattice, mx + Math.cos(ang) * len * t2 - Math.sin(ang) * 0.075, h * 0.5, mz + Math.sin(ang) * len * t2 + Math.cos(ang) * 0.075, -ang);
        }
      }
    }
    return g;
  }

  function gate(w = 2.2) {
    const g = new THREE.Group();
    [-1, -0.35, 0.35, 1].forEach((s) => {
      const p = mesh(cyl(0.07, 0.08, 1.4, 8), M.red);
      p.position.set((s * w) / 2, 0.7, 0);
      p.castShadow = true;
      g.add(p);
    });
    const beam = mesh(box(w + 0.3, 0.14, 0.14), M.bracket);
    beam.position.y = 1.3;
    g.add(beam);
    const plaque = mesh(box(0.6, 0.22, 0.04), M.gold);
    plaque.position.set(0, 1.12, 0.08);
    g.add(plaque);
    // double door between the inner posts, plinths under every post, hanging lanterns
    for (const sx of [-1, 1]) {
      put(g, box(0.36, 0.95, 0.04), M.door, sx * 0.18, 0.5, 0);
      for (const yy of [0.25, 0.5, 0.75]) put(g, sph(0.018, 5, 4), M.gold, sx * 0.1, yy, 0.03);
      put(g, cyl(0.1, 0.12, 0.08, 8), M.granite, (sx * w) / 2, 0.04, 0);
      put(g, cyl(0.1, 0.12, 0.08, 8), M.granite, sx * 0.35 * w / 2, 0.04, 0);
      const l = put(g, sph(0.07, 8, 6), M.lantern, sx * w * 0.3, 1.0, 0.12);
      l.scale.y = 1.25;
      strut(g, [sx * w * 0.3, 1.23, 0.12], [sx * w * 0.3, 1.08, 0.12], M.wood, 0.008);
    }
    put(g, box(0.9, 0.03, 0.2), M.marble, 0, 0.015, 0.06);
    stairs(g, 0, 0.12, 0.14, 0.9, 2, 0.06, 0.16);
    const r1 = hipRoof(w * 0.75, 0.55, 0.28, M.tile, 0.16);
    r1.position.y = 1.4;
    g.add(r1);
    [-1, 1].forEach((s) => {
      const r = hipRoof(w * 0.42, 0.45, 0.22, M.tile, 0.12);
      r.position.set(s * w * 0.62, 1.18, 0);
      g.add(r);
    });
    return g;
  }

  const flagMats = new Map<string, THREE.MeshStandardMaterial>();
  function banner(color: string) {
    const g = new THREE.Group();
    const pole = mesh(cyl(0.02, 0.02, 1.6, 5), M.wood);
    pole.position.y = 0.8;
    g.add(pole);
    put(g, cyl(0.07, 0.09, 0.08, 6), M.granite, 0, 0.04, 0);
    put(g, sph(0.035, 6, 4), M.gold, 0, 1.62, 0);
    put(g, box(0.4, 0.02, 0.02), M.wood, 0.17, 1.56, 0);
    let fm = flagMats.get(color);
    if (!fm) {
      fm = std({ color, side: THREE.DoubleSide, roughness: 0.8 });
      flagMats.set(color, fm);
    }
    const flag = mesh(
      new THREE.PlaneGeometry(0.32, 0.9, 1, 6),
      fm,
    );
    const p = flag.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getY(i) * 6) * 0.04);
    flag.position.set(0.17, 1.1, 0);
    flag.castShadow = true;
    g.add(flag);
    return g;
  }

  // stone lantern with a softly lit window (emissive material, no real light)
  function lantern() {
    const g = new THREE.Group();
    put(g, box(0.16, 0.05, 0.16), M.granite, 0, 0.025, 0);
    put(g, cyl(0.03, 0.04, 0.2, 6), M.granite, 0, 0.15, 0);
    put(g, box(0.14, 0.03, 0.14), M.granite, 0, 0.265, 0);
    put(g, box(0.1, 0.1, 0.1), M.lanternGlow, 0, 0.33, 0);
    put(g, cone(0.13, 0.09, 4), M.granite, 0, 0.43, 0, Math.PI / 4);
    put(g, sph(0.025, 6, 4), M.granite, 0, 0.49, 0);
    g.scale.setScalar(0.85);
    return g;
  }

  // railing along a polyline: posts with lotus caps and two rails
  function railing(g: THREE.Object3D, pts: V3[], h = 0.3) {
    pts.forEach((p, i) => {
      put(g, box(0.045, h, 0.045), M.marble, p[0], p[1] + h / 2, p[2]);
      put(g, sph(0.032, 6, 4), M.marble, p[0], p[1] + h + 0.02, p[2]);
      if (i > 0) {
        const q = pts[i - 1];
        strut(g, [q[0], q[1] + h * 0.9, q[2]], [p[0], p[1] + h * 0.9, p[2]], M.marble, 0.03);
        strut(g, [q[0], q[1] + h * 0.45, q[2]], [p[0], p[1] + h * 0.45, p[2]], M.marble, 0.02);
      }
    });
  }

  return { hipRoof, polarRoof, hall, pagoda, roundTemple, wallLoop, gate, banner, lantern, podium, bonsai, pine, lionPair, incense, well, stairs, railing, put, strut, aimed };
}

// Invisible cylinder over a sect (tall enough for the pagoda) in world space: the merged detail meshes are not
// raycastable, so hover and click land on this. The group may itself sit at the origin or at the site.
export function makeHitProxy(group: THREE.Object3D, site: { a: number; b: number; r: number }, groundY: number) {
  const height = 7;
  const hit = new THREE.Mesh(
    new THREE.CylinderGeometry(site.r * 1.1, site.r * 1.1, height, 16),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  const w = A2W(site.a, site.b);
  group.updateMatrixWorld(true);
  hit.position.copy(group.worldToLocal(new THREE.Vector3(w.x, groundY + height / 2 - 0.2, w.z)));
  group.add(hit);
  return hit;
}

// convex hull (world XZ) of one building, eaves included; the merged meshes lose this, so it is taken before baking
export type Footprint = { name: string; hull: [number, number][] };
export type SectBuild = {
  group: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  footprints: Footprint[];
};

export function footprintOf(name: string, ...objs: THREE.Object3D[]): Footprint {
  const seen = new Map<string, [number, number]>();
  const v = new THREE.Vector3();
  for (const obj of objs) obj.updateWorldMatrix(true, true);
  const visit = (o: THREE.Object3D) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      seen.set(`${Math.round(v.x * 100)}_${Math.round(v.z * 100)}`, [v.x, v.z]);
    }
  };
  for (const obj of objs) obj.traverse(visit);
  const pts = [...seen.values()].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: [number, number][]) => {
    const h: [number, number][] = [];
    for (const p of list) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return { name, hull: half(pts).concat(half(pts.slice().reverse())) };
}

type P2 = [number, number];
const turn = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const inHull = (p: P2, h: P2[]) => h.every((q, i) => turn(q, h[(i + 1) % h.length], p) >= 0);
function edgeDist(p: P2, a: P2, b: P2) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}
// distance from a point to a convex counter-clockwise hull; 0 inside
export function pointHullDist(p: P2, h: P2[]) {
  if (inHull(p, h)) return 0;
  return Math.min(...h.map((q, i) => edgeDist(p, q, h[(i + 1) % h.length])));
}
// distance between two convex hulls; 0 when they touch or overlap
export function hullGap(a: P2[], b: P2[]) {
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      const [p1, p2, q1, q2] = [a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length]];
      if (turn(p1, p2, q1) * turn(p1, p2, q2) < 0 && turn(q1, q2, p1) * turn(q1, q2, p2) < 0) return 0;
    }
  }
  return Math.min(...a.map((p) => pointHullDist(p, b)), ...b.map((p) => pointHullDist(p, a)));
}

// facing the camera: -45deg puts a hall's front (local +z) toward the viewer
const FACE = -45 + 180;
// halls are drawn a little smaller so neighbouring roofs and eaves keep a clear gap
const HALL_K = 0.85;

export function buildSects(heightAt: (x: number, z: number) => number, siteHeights: Record<SiteKey, number>, fine = true) {
  const placeA = (group: THREE.Group, obj: THREE.Object3D, a: number, b: number, yOff = 0, rotDeg = 0) => {
    const w = A2W(a, b);
    obj.position.set(w.x, heightAt(w.x, w.z) + yOff, w.z);
    obj.rotation.y = (rotDeg * Math.PI) / 180;
    group.add(obj);
    return obj;
  };
  type Props = ReturnType<typeof builders>;
  // a lion pair and two bonsai at the foot of a hall's steps, in the hall's own frame
  const frontProps = (g: THREE.Group, B: Props, a: number, b: number, rot: number, w: number, d: number) => {
    const f = new THREE.Group();
    const lions = B.lionPair(w * 0.22 + 0.2);
    lions.position.z = d / 2 + 1.35;
    f.add(lions);
    if (fine) {
      for (const sx of [-1, 1]) {
        const t = B.bonsai(1.1);
        t.position.set(sx * (w * 0.5 + 0.55), 0, d / 2 + 0.6);
        f.add(t);
      }
    }
    return placeA(g, f, a, b, 0, rot);
  };
  const collect = (group: THREE.Group, M: Mats, footprints: Footprint[]): SectBuild => {
    mergeStatic(group);
    const set = new Set<THREE.MeshStandardMaterial>(Object.values(M));
    group.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (!(o as THREE.Mesh).isMesh || !m) return;
      for (const x of [m].flat()) set.add(x as THREE.MeshStandardMaterial);
    });
    return { group, materials: [...set], footprints };
  };

  // Sect I: Swift Wind Pagoda on the massif ledge (blue banners)
  const ledge = (() => {
    const M = createMats();
    const B = builders(M, fine);
    const g = new THREE.Group();
    const base = SITES.ledge;
    const fp: Footprint[] = [];
    // flagstone terrace with a rim, so the ledge reads as built ground
    M.paving.map!.repeat.set(5, 5);
    M.paving.color.set('#a9a498');
    placeA(g, mesh(cyl(3.5, 3.6, 0.05, 48), M.paving), base.a, base.b, 0.025);
    placeA(g, mesh(cyl(3.68, 3.68, 0.09, 48), M.granite), base.a, base.b, 0.0);
    fp.push(footprintOf('pagoda', placeA(g, B.pagoda(5, 0.8), base.a + 1.85, base.b + 0.6)));
    const hallObj = placeA(g, B.hall({ w: 2.6, d: 1.5, h: 0.75 }), base.a - 1.85, base.b + 1.6, 0, FACE);
    fp.push(footprintOf('side hall', placeA(g, B.hall({ w: 1.6, d: 1.1, h: 0.6 }), base.a - 2.2, base.b - 2.1, 0, FACE + 90)));
    fp.push(footprintOf('hall', hallObj, frontProps(g, B, base.a - 1.85, base.b + 1.6, FACE, 2.6, 1.5)));
    placeA(g, B.incense(), base.a - 0.4, base.b - 1.6, 0.05);
    placeA(g, B.pine(1.5), base.a - 0.2, base.b + 3.5, 0);
    placeA(g, B.pine(1.2), base.a + 4.1, base.b - 0.9, 0);
    placeA(g, B.pine(1.0), base.a + 2.4, base.b + 3.3, 0);
    const pav = new THREE.Group();
    [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].forEach(([x, z]) => {
      const c = mesh(cyl(0.04, 0.04, 0.8, 6), M.red);
      c.position.set(x, 0.4, z);
      pav.add(c);
    });
    const pr = B.polarRoof(1.0, 0.45, M.tile, 4, 0.2);
    pr.rotation.y = Math.PI / 4;
    pr.position.y = 0.82;
    pav.add(pr);
    // the wood floor stands 3 cm proud of the granite pad: equal top heights z-fight and the floor and its shadow flicker
    const floor = mesh(box(1.2, 0.08, 1.2), M.wood);
    floor.position.y = 0.03;
    pav.add(floor);
    B.put(pav, box(1.5, 0.06, 1.5), M.granite, 0, 0.01, 0);
    B.put(pav, sph(0.07, 6, 4), M.gold, 0, 1.3, 0);
    B.put(pav, cone(0.04, 0.2, 6), M.gold, 0, 1.43, 0);
    [-0.5, 0.5].forEach((q) => {
      B.put(pav, box(1.0, 0.03, 0.03), M.red, 0, 0.3, q);
      B.put(pav, box(0.03, 0.03, 1.0), M.red, q, 0.3, 0);
      B.put(pav, box(1.0, 0.03, 0.03), M.red, 0, 0.62, q);
      B.put(pav, box(0.03, 0.03, 1.0), M.red, q, 0.62, 0);
    });
    placeA(g, pav, base.a + 1.0, base.b - 3.4, 0.05, 0);
    fp.push(footprintOf('pavilion', pav));
    // low railing along the cliff-side edge of the terrace, broken wherever it would run into a building
    let rail: V3[] = [];
    for (let t = Math.PI * 0.92; t <= Math.PI * 2.08; t += 0.09) {
      const w = A2W(base.a + Math.cos(t) * 3.45, base.b + Math.sin(t) * 3.45);
      if (fp.some((f) => pointHullDist([w.x, w.z], f.hull) < 0.4)) {
        if (rail.length > 1) B.railing(g, rail, 0.3);
        rail = [];
        continue;
      }
      rail.push([w.x, siteHeights.ledge + 0.05, w.z]);
    }
    if (rail.length > 1) B.railing(g, rail, 0.3);
    [[base.a - 4.3, base.b - 0.7], [base.a + 4.1, base.b + 1.5], [base.a - 0.5, base.b - 3.4]].forEach(([a, b]) =>
      placeA(g, B.banner('#2f5f9a'), a, b),
    );
    [[base.a - 0.3, base.b - 0.8], [base.a + 0.7, base.b - 1.7]].forEach(([a, b]) => placeA(g, B.lantern(), a, b));
    return collect(g, M, fp);
  })();

  // Sect II: Hundred Disciplines Hall on the valley floor (red banners)
  const valley = (() => {
    const M = createMats();
    const B = builders(M, fine);
    const outer = new THREE.Group();
    const g = new THREE.Group();
    const base = SITES.valley;
    const fp: Footprint[] = [];
    placeA(outer, g, base.a, base.b, 0, FACE);
    const main = B.hall({ w: 3.4, d: 1.9, h: 0.85, double: true, base: 0.45 });
    main.position.set(0, 0, -1.98);
    main.scale.setScalar(HALL_K);
    g.add(main);
    fp.push(footprintOf('main hall', main));
    [[-3.39, 1.75], [3.39, 1.75]].forEach(([x, z]) => {
      const h = B.hall({ w: 2.0, d: 1.1, h: 0.6, base: 0.25 });
      h.position.set(x, 0, z);
      h.scale.setScalar(HALL_K);
      h.rotation.y = -Math.PI / 2;
      if (x < 0) {
        h.rotation.y = Math.PI / 2;
      }
      g.add(h);
      fp.push(footprintOf('side hall', h));
    });
    const front = B.hall({ w: 2.2, d: 1.0, h: 0.55, base: 0.25 });
    front.position.set(0, 0, 1.4);
    front.scale.setScalar(HALL_K);
    g.add(front);
    fp.push(footprintOf('front hall', front));
    const yard = mesh(box(4.0, 0.05, 4.6), M.stone);
    yard.position.set(0, 0.03, 0.4);
    yard.receiveShadow = true;
    g.add(yard);
    const incense = B.incense();
    incense.position.set(0, 0.05, 3.4);
    g.add(incense);
    g.add(B.wallLoop([[-4.7, -3.6], [4.7, -3.6], [4.7, 4.4], [-4.7, 4.4]]));
    const gt = B.gate(2.2);
    gt.position.set(0, 0, 5.3);
    g.add(gt);
    // courtyard life: a well, bonsai, old pines against the back wall, and stone lions guarding the gate
    const wl = B.well();
    wl.position.set(-3.3, 0.05, 3.7);
    g.add(wl);
    [[3.3, 3.7, 1.2], [-2.1, 3.6, 0.9], [2.1, 3.6, 0.9]].forEach(([x, z, k]) => {
      const t = B.bonsai(k);
      t.position.set(x, 0.05, z);
      g.add(t);
    });
    [[-3.5, -2.9, 1.5], [3.5, -2.9, 1.4]].forEach(([x, z, k]) => {
      const t = B.pine(k);
      t.position.set(x, 0, z);
      g.add(t);
    });
    const gl = B.lionPair(1.1);
    gl.position.set(0, 0, 6.0);
    g.add(gl);
    [3.65, 4.35].forEach((z) => {
      const slab = mesh(box(0.7, 0.04, 0.45), M.marble);
      slab.position.set(0, 0.06, z + 0.55);
      g.add(slab);
    });
    [[-1.3, 3.4], [1.3, 3.4], [-1.3, 4.05], [1.3, 4.05]].forEach(([x, z]) => {
      const l = B.lantern();
      l.position.set(x, 0.05, z);
      g.add(l);
    });
    [[-4.85, 4.6], [4.85, 4.6], [-4.85, -3.9], [4.85, -3.9]].forEach(([x, z]) => {
      const bn = B.banner('#a3281e');
      bn.position.set(x, 0, z);
      g.add(bn);
    });
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    return collect(outer, M, fp);
  })();

  // Sect III: Heavenly Balance Temple on the lake tier (gold banners), water pavilion, stair and zigzag bridge
  const lake = (() => {
    const M = createMats();
    const B = builders(M, fine);
    const g = new THREE.Group();
    const base = SITES.lake;
    const fp: Footprint[] = [];
    // turned 45 degrees so one of its four stairs faces the viewer; lions and a pair of pines flank that stair
    // the temple and its halls are scaled down so the roofs and eaves clear each other on the tier
    const TEMPLE_K = 0.85;
    const temple = placeA(g, B.roundTemple(), base.a, base.b, 0, 45);
    temple.scale.setScalar(TEMPLE_K);
    const lions = new THREE.Group();
    const pair = B.lionPair(0.75);
    pair.position.z = 3.75 * TEMPLE_K;
    lions.add(pair);
    placeA(g, lions, base.a, base.b, 0, 225);
    fp.push(footprintOf('temple', temple, lions));
    placeA(g, B.pine(1.2), base.a - 4.3, base.b + 1.3, 0);
    placeA(g, B.pine(1.1), base.a + 3.7, base.b - 1.2, 0);
    placeA(g, B.bonsai(1.3), base.a - 0.05, base.b + 3.6, 0);
    [[-3.3, -1.5], [-3.3, 0.3]].forEach(([da, db]) => placeA(g, B.lantern(), base.a + da, base.b + db));
    const hall1 = placeA(g, B.hall({ w: 1.8, d: 1.0, h: 0.55, roofMat: M.tileGreen }), base.a - 2.5, base.b + 3.35, 0, FACE + 30);
    hall1.scale.setScalar(HALL_K);
    fp.push(footprintOf('hall', hall1));
    const hall2 = placeA(g, B.hall({ w: 1.5, d: 0.9, h: 0.5, roofMat: M.tileGreen }), base.a + 2.4, base.b + 3.75, 0, FACE + 60);
    hall2.scale.setScalar(HALL_K);
    fp.push(footprintOf('hall 2', hall2));
    const pav = new THREE.Group();
    const plat = mesh(cyl(1.0, 1.0, 0.16, 6), M.marble);
    plat.position.y = 0.08;
    pav.add(plat);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const c = mesh(cyl(0.04, 0.04, 0.75, 6), M.red);
      c.position.set(Math.cos(a) * 0.8, 0.5, Math.sin(a) * 0.8);
      pav.add(c);
    }
    const pr = B.polarRoof(1.35, 0.6, M.tileGreen, 6, 0.25);
    pr.position.y = 0.88;
    pav.add(pr);
    // rails between the pavilion pillars, and a gilt finial
    const pillarsAt: V3[] = [];
    for (let k = 0; k <= 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      pillarsAt.push([Math.cos(a) * 0.8, 0.16, Math.sin(a) * 0.8]);
    }
    B.railing(pav, pillarsAt.slice(0, 4), 0.35);
    B.railing(pav, pillarsAt.slice(4), 0.35);
    B.put(pav, sph(0.07, 6, 4), M.gold, 0, 1.52, 0);
    B.put(pav, cone(0.04, 0.22, 6), M.gold, 0, 1.68, 0);
    const lw = A2W(LAKE.a + 1.5, LAKE.b + 0.5);
    pav.position.set(lw.x, WATER_Y, lw.z);
    g.add(pav);
    fp.push(footprintOf('water pavilion', pav));
    // stone stair from the tier top down to the water
    {
      const s0 = A2W(base.a - 3.2, base.b - 0.6);
      const s1 = A2W(base.a - 6.0, base.b - 1.4);
      const n = 16;
      const stepGeo = box(0.42, 0.28, 0.75);
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1);
        const st = mesh(stepGeo, M.stone);
        st.position.set(lerp(s0.x, s1.x, t), lerp(siteHeights.lake, WATER_Y + 0.3, t), lerp(s0.z, s1.z, t));
        st.rotation.y = -Math.atan2(s1.z - s0.z, s1.x - s0.x);
        st.castShadow = true;
        g.add(st);
      }
    }
    // rails down both sides of the stair
    {
      const s0 = A2W(base.a - 3.2, base.b - 0.6);
      const s1 = A2W(base.a - 6.0, base.b - 1.4);
      const len = Math.hypot(s1.x - s0.x, s1.z - s0.z);
      const px = -(s1.z - s0.z) / len;
      const pz = (s1.x - s0.x) / len;
      for (const side of [-1, 1]) {
        const pts: V3[] = [];
        for (let k = 0; k <= 5; k++) {
          const t = k / 5;
          pts.push([lerp(s0.x, s1.x, t) + px * side * 0.5, lerp(siteHeights.lake, WATER_Y + 0.3, t) + 0.12, lerp(s0.z, s1.z, t) + pz * side * 0.5]);
        }
        B.railing(g, pts, 0.32);
      }
    }
    const zig = [[base.a - 6.0, base.b - 1.4], [base.a - 6.8, base.b - 2.4], [base.a - 7.6, base.b - 1.4], [LAKE.a + 2.4, LAKE.b + 0.6]];
    for (let i = 0; i < zig.length - 1; i++) {
      const p = A2W(zig[i][0], zig[i][1]);
      const q = A2W(zig[i + 1][0], zig[i + 1][1]);
      const len = Math.hypot(q.x - p.x, q.z - p.z);
      const deck = mesh(box(len + 0.25, 0.08, 0.45), M.marble);
      deck.position.set((p.x + q.x) / 2, WATER_Y + 0.28, (p.z + q.z) / 2);
      deck.rotation.y = -Math.atan2(q.z - p.z, q.x - p.x);
      deck.castShadow = true;
      g.add(deck);
      for (const t of [0.2, 0.5, 0.8]) {
        const pil = mesh(cyl(0.05, 0.05, 0.5, 6), M.stone);
        pil.position.set(lerp(p.x, q.x, t), WATER_Y, lerp(p.z, q.z, t));
        g.add(pil);
      }
      const nx = -(q.z - p.z) / len;
      const nz = (q.x - p.x) / len;
      for (const side of [-1, 1]) {
        const pts: V3[] = [];
        for (let k = 0; k <= 3; k++) {
          const t = k / 3;
          pts.push([lerp(p.x, q.x, t) + nx * side * 0.2, WATER_Y + 0.32, lerp(p.z, q.z, t) + nz * side * 0.2]);
        }
        B.railing(g, pts, 0.28);
      }
    }
    [[base.a - 1.8, base.b - 3.2], [base.a + 3.3, base.b - 2.0], [base.a + 3.6, base.b + 0.1]].forEach(([a, b]) =>
      placeA(g, B.banner('#c8952e'), a, b),
    );
    return collect(g, M, fp);
  })();

  // hump-backed stone arch bridge where the path crosses the river below the fall. It is built in a frame along the
  // path (x along the deck, west to east; z across; y world height); both ends are buried in the banks
  const bridge = (() => {
    const M = createMats();
    const B = builders(M, fine);
    const g = new THREE.Group();
    const c = A2W(BRIDGE.a, BRIDGE.b);
    const e = A2W(BRIDGE.a + BRIDGE.dirA, BRIDGE.b + BRIDGE.dirB);
    const th = Math.atan2(-(e.z - c.z), e.x - c.x);
    const ct = Math.cos(th);
    const sn = Math.sin(th);
    const gh = (x: number, z: number) => heightAt(c.x + x * ct + z * sn, c.z - x * sn + z * ct);
    const END = BRIDGE.half;
    const SPAN = 1.8; // half the arch opening
    const ABUT = 2.7; // abutments and the hump end here, steps run on to END
    const HW = 1.0; // half the masonry width
    // overlapping blocks get slightly different widths so their side faces are never coplanar (that z-fights)
    const W_ABUT = 2 * (HW - 0.03);
    const W_FILL = 2 * (HW - 0.06);
    const W_DECK = 2 * (HW + 0.03);
    const PZ = 0.88; // balustrade posts
    const Y_END = 2.1;
    const Y_CROWN = 2.45;
    const gEnd = { w: gh(-END, 0), e: gh(END, 0) };
    // top of the deck (and of the stair ramp the balustrade follows)
    const top = (x: number) => {
      const ax = Math.abs(x);
      if (ax <= ABUT) return Y_END + (Y_CROWN - Y_END) * (1 - (ax / ABUT) ** 2);
      let ground = gEnd.e;
      if (x < 0) ground = gEnd.w;
      return Y_END + ((ground - Y_END) * (ax - ABUT)) / (END - ABUT);
    };

    // stone geometry with world-scale UVs (one texture tile per 1.6 units) and moss tinting the vertex colours near the waterline
    const q = new THREE.Quaternion();
    const eu = new THREE.Euler();
    const mt = new THREE.Matrix4();
    const one = new THREE.Vector3(1, 1, 1);
    const MOSS = new THREE.Color('#6f8f45');
    const tint = new THREE.Color();
    const dress = (geo: THREE.BufferGeometry, px: number, py: number, pz: number, rz = 0, ry = 0) => {
      mt.compose(new THREE.Vector3(px, py, pz), q.setFromEuler(eu.set(0, ry, rz)), one);
      let src = geo.clone();
      if (geo.index) src = geo.toNonIndexed();
      const o = src.applyMatrix4(mt);
      const pos = o.attributes.position;
      const nor = o.attributes.normal;
      const uv = new Float32Array(pos.count * 2);
      const col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const nx = Math.abs(nor.getX(i));
        const ny = Math.abs(nor.getY(i));
        const nz = Math.abs(nor.getZ(i));
        let u = pos.getX(i);
        let v = pos.getY(i);
        if (nx > nz && nx >= ny) u = pos.getZ(i);
        if (ny > nx && ny > nz) v = pos.getZ(i);
        uv[i * 2] = u * 0.625;
        uv[i * 2 + 1] = v * 0.625;
        const k = Math.min(1, Math.max(0, (0.9 - pos.getY(i)) / 1.3)) * 0.75;
        tint.setRGB(1, 1, 1).lerp(MOSS, k);
        col.set([tint.r, tint.g, tint.b], i * 3);
      }
      o.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      o.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.add(mesh(o, M.bridge));
    };
    const bx = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d, 1, Math.max(1, Math.ceil(h / 0.35)), 1);
    const redBar = (len: number, x: number, y: number, z: number, rz: number) => {
      const m = mesh(box(len, 0.03, 0.07), M.red);
      m.position.set(x, y, z);
      m.rotation.z = rz;
      g.add(m);
    };

    // the arch: wedge-shaped voussoirs round a circle through both springings
    const Ri = 1.83;
    const Ro = Ri + 0.35;
    const yc = -0.03;
    const phi0 = Math.atan2(Math.sqrt(Ri * Ri - SPAN * SPAN), SPAN);
    const N = 15;
    for (let i = 0; i < N; i++) {
      const t1 = phi0 + ((Math.PI - 2 * phi0) * i) / N + 0.002;
      const t2 = phi0 + ((Math.PI - 2 * phi0) * (i + 1)) / N - 0.002;
      const sh = new THREE.Shape();
      sh.moveTo(Ri * Math.cos(t1), yc + Ri * Math.sin(t1));
      sh.lineTo(Ro * Math.cos(t1), yc + Ro * Math.sin(t1));
      sh.lineTo(Ro * Math.cos(t2), yc + Ro * Math.sin(t2));
      sh.lineTo(Ri * Math.cos(t2), yc + Ri * Math.sin(t2));
      sh.closePath();
      dress(new THREE.ExtrudeGeometry(sh, { depth: 2 * HW, bevelEnabled: false }), 0, 0, -HW);
    }
    // abutments, sunk well below the river bed
    for (const sg of [-1, 1]) {
      const bottom = -1.5;
      dress(bx(ABUT - SPAN + 0.05, 1.8 - bottom, W_ABUT), (sg * (ABUT + SPAN - 0.05)) / 2, (1.8 + bottom) / 2, 0);
    }
    // spandrel fill between the arch and the deck, then the deck slab following the hump
    for (let x = -ABUT + 0.075; x < ABUT; x += 0.15) {
      let low = 1.75;
      if (Math.abs(x) <= SPAN) low = yc + Math.sqrt(Ro * Ro - x * x) - 0.03;
      const high = top(x) - 0.28;
      if (high - low > 0.02) dress(bx(0.17, high - low, W_FILL), x, (high + low) / 2, 0);
    }
    for (let x = -ABUT + 0.15; x < ABUT; x += 0.3) {
      const slope = (top(x + 0.15) - top(x - 0.15)) / 0.3;
      dress(bx(0.3 * Math.sqrt(1 + slope * slope) + 0.04, 0.3, W_DECK), x, top(x) - 0.15, 0, Math.atan(slope));
    }
    // steps down (or up) to each bank, then a paved landing; every block reaches below the ground under it
    for (const sg of [-1, 1]) {
      let ground = gEnd.e;
      if (sg < 0) ground = gEnd.w;
      const n = Math.max(1, Math.ceil(Math.abs(ground - Y_END) / 0.2));
      const tread = (END - ABUT) / n;
      const block = (x0: number, x1: number, topY: number) => {
        const low = Math.min(gh(sg * x0, HW), gh(sg * x0, -HW), gh(sg * x1, HW), gh(sg * x1, -HW), gh(sg * (x0 + x1) / 2, 0));
        const bottom = Math.min(topY, low) - 0.45;
        dress(bx(x1 - x0, topY - bottom, W_DECK), (sg * (x0 + x1)) / 2, (topY + bottom) / 2, 0);
      };
      for (let k = 1; k <= n; k++) block(ABUT + (k - 1) * tread, ABUT + k * tread, Y_END + ((ground - Y_END) * k) / n);
      block(END, END + 0.9, ground + 0.03);
    }

    // balustrade: square posts with lotus finials, framed carved panels, a coping with a red lacquered line
    const posts = [-END, -3.4, -ABUT, -SPAN, -0.9, 0, 0.9, SPAN, ABUT, 3.4, END];
    for (const z of [-PZ, PZ]) {
      posts.forEach((x, i) => {
        const y = top(x);
        dress(bx(0.26, 0.14, 0.26), x, y + 0.07, z);
        dress(bx(0.18, 0.78, 0.18), x, y + 0.5, z);
        dress(new THREE.CylinderGeometry(0.12, 0.1, 0.06, 8), x, y + 0.92, z);
        if (x === 0) {
          const lamp = B.lantern();
          lamp.scale.setScalar(0.6);
          lamp.position.set(x, y + 0.95, z);
          g.add(lamp);
        }
        if (x !== 0) {
          dress(new THREE.SphereGeometry(0.09, 8, 6), x, y + 1.02, z);
          dress(new THREE.ConeGeometry(0.04, 0.16, 6), x, y + 1.16, z);
        }
        if (i === posts.length - 1) return;
        const x1 = posts[i + 1];
        const dy = top(x1) - y;
        const len = Math.hypot(x1 - x, dy);
        const rz = Math.atan2(dy, x1 - x);
        const xm = (x + x1) / 2;
        const ym = (y + top(x1)) / 2;
        dress(bx(len, 0.14, 0.2), xm, ym + 0.07, z, rz);
        dress(bx(len - 0.14, 0.4, 0.09), xm, ym + 0.34, z, rz);
        dress(bx(len, 0.1, 0.24), xm, ym + 0.65, z, rz);
        redBar(len - 0.2, xm, ym + 0.715, z, rz);
        if (fine) {
          dress(bx(len - 0.2, 0.04, 0.12), xm, ym + 0.17, z, rz);
          dress(bx(len - 0.2, 0.04, 0.12), xm, ym + 0.5, z, rz);
          dress(bx(0.2, 0.2, 0.05), xm, ym + 0.34, z, rz + Math.PI / 4);
        }
      });
    }
    // stone lions guarding each end
    if (fine) {
      for (const sg of [-1, 1]) {
        const lions = B.lionPair(PZ);
        const x = sg * (END + 1.0);
        lions.position.set(x, gh(x, 0), 0);
        lions.rotation.y = (sg * Math.PI) / 2;
        g.add(lions);
      }
    }
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    g.position.set(c.x, 0, c.z);
    g.rotation.y = th;
    mergeStatic(g);
    return g;
  })();

  return { ledge, valley, lake, bridge };
}
