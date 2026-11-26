// Buildings ported from the mock (vanilla three objects). Each sect gets its own material set so it can glow on hover.
import * as THREE from 'three';
import { A2W, SITES, LAKE, WATER_Y, type SiteKey } from '../terrain/layout';

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
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(255,255,255,${rnd() * 0.06})`;
    g.fillRect(rnd() * 256, rnd() * 256, 4, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
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

let TEXS: Record<string, THREE.CanvasTexture> | null = null;
function textures() {
  if (!TEXS) {
    TEXS = {
      tile: tileTexture('#4a5058', '#2c3036'),
      tileGreen: tileTexture('#3f6b52', '#264434'),
      tileBlue: tileTexture('#2c4f7a', '#1a3050'),
      lattice: latticeTexture(),
      stone: stoneTexture(),
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
    marble: std({ color: '#e8e4dc', roughness: 0.7 }),
    bracket: std({ color: '#2f5a5c', roughness: 0.7 }),
    gold: std({ color: '#c8a04a', roughness: 0.35, metalness: 0.6 }),
    wood: std({ color: '#6b4a32', roughness: 0.85 }),
    lantern: std({ color: '#d0402c', emissive: '#a02010', emissiveIntensity: 0.6, roughness: 0.6 }),
  };
}
export type Mats = ReturnType<typeof createMats>;

const mesh = (g: THREE.BufferGeometry, m: THREE.Material | THREE.Material[]) => new THREE.Mesh(g, m);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, s: number) => new THREE.CylinderGeometry(rt, rb, h, s);

function builders(M: Mats) {
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
    });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const a = new THREE.Vector3((sx * ridgeLen) / 2, h, 0);
      const b = new THREE.Vector3((sx * w) / 2, lift * 0.95, (sz * d) / 2);
      const hip = mesh(cyl(0.035, 0.035, a.distanceTo(b), 5), M.tile);
      hip.position.copy(a).add(b).multiplyScalar(0.5);
      hip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      g.add(hip);
    });
    return g;
  }

  // polar roof (pagoda / round hall); corners > 0 gives an n-gon with upturned tips
  function polarRoof(r: number, h: number, mat: THREE.Material, corners = 0, lift = 0.25) {
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
    return m;
  }

  function podium(w: number, d: number, h: number, steps = true) {
    const g = new THREE.Group();
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
      }
    }
    const postsD = Math.round(d / 0.35);
    for (let i = 0; i <= postsD; i++) {
      for (const x of [-w / 2, w / 2]) {
        const b = mesh(post, M.marble);
        b.position.set(x, h + 0.08, -d / 2 + (i * d) / postsD);
        g.add(b);
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
        const c = mesh(col, M.red);
        c.position.set(-w / 2 + (i * w) / nx, h / 2, z);
        g.add(c);
      }
    }
    for (let i = 1; i < nz; i++) {
      for (const x of [-w / 2, w / 2]) {
        const c = mesh(col, M.red);
        c.position.set(x, h / 2, -d / 2 + (i * d) / nz);
        g.add(c);
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

  function banner(color: string) {
    const g = new THREE.Group();
    const pole = mesh(cyl(0.02, 0.02, 1.6, 5), M.wood);
    pole.position.y = 0.8;
    g.add(pole);
    const flag = mesh(
      new THREE.PlaneGeometry(0.32, 0.9, 1, 6),
      std({ color, side: THREE.DoubleSide, roughness: 0.8 }),
    );
    const p = flag.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getY(i) * 6) * 0.04);
    flag.position.set(0.17, 1.1, 0);
    flag.castShadow = true;
    g.add(flag);
    return g;
  }

  function lantern() {
    const g = new THREE.Group();
    const l = mesh(cyl(0.06, 0.06, 0.12, 8), M.lantern);
    l.position.y = 0.06;
    g.add(l);
    return g;
  }

  return { hipRoof, polarRoof, hall, pagoda, roundTemple, wallLoop, gate, banner, lantern, podium };
}

export type SectBuild = {
  group: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
};

// facing the camera: -45deg puts a hall's front (local +z) toward the viewer
const FACE = -45 + 180;

export function buildSects(heightAt: (x: number, z: number) => number, siteHeights: Record<SiteKey, number>) {
  const placeA = (group: THREE.Group, obj: THREE.Object3D, a: number, b: number, yOff = 0, rotDeg = 0) => {
    const w = A2W(a, b);
    obj.position.set(w.x, heightAt(w.x, w.z) + yOff, w.z);
    obj.rotation.y = (rotDeg * Math.PI) / 180;
    group.add(obj);
    return obj;
  };
  const collect = (group: THREE.Group, M: Mats): SectBuild => {
    const set = new Set<THREE.MeshStandardMaterial>(Object.values(M));
    group.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (!(o as THREE.Mesh).isMesh || !m) return;
      for (const x of [m].flat()) set.add(x as THREE.MeshStandardMaterial);
    });
    return { group, materials: [...set] };
  };

  // Sect I: Swift Wind Pagoda on the massif ledge (blue banners)
  const ledge = (() => {
    const M = createMats();
    const B = builders(M);
    const g = new THREE.Group();
    const base = SITES.ledge;
    placeA(g, B.pagoda(5, 0.8), base.a + 1.6, base.b + 0.6);
    placeA(g, B.hall({ w: 2.6, d: 1.5, h: 0.75 }), base.a - 1.5, base.b + 0.9, 0, FACE);
    placeA(g, B.hall({ w: 1.6, d: 1.1, h: 0.6 }), base.a - 2.2, base.b - 1.8, 0, FACE + 90);
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
    pav.add(mesh(box(1.2, 0.08, 1.2), M.wood));
    placeA(g, pav, base.a + 1.0, base.b - 3.4, 0.05, 0);
    [[base.a - 3.4, base.b - 0.2], [base.a + 3.2, base.b + 2.2], [base.a - 0.2, base.b - 3.6]].forEach(([a, b]) =>
      placeA(g, B.banner('#2f5f9a'), a, b),
    );
    [[base.a - 0.4, base.b - 0.6], [base.a + 0.6, base.b - 1.6]].forEach(([a, b]) => placeA(g, B.lantern(), a, b));
    return collect(g, M);
  })();

  // Sect II: Hundred Disciplines Hall on the valley floor (red banners)
  const valley = (() => {
    const M = createMats();
    const B = builders(M);
    const outer = new THREE.Group();
    const g = new THREE.Group();
    const base = SITES.valley;
    placeA(outer, g, base.a, base.b, 0, FACE);
    const main = B.hall({ w: 3.4, d: 1.9, h: 0.85, double: true, base: 0.45 });
    main.position.set(0, 0, -2.0);
    g.add(main);
    [[-2.4, 0.4], [2.4, 0.4]].forEach(([x, z]) => {
      const h = B.hall({ w: 2.0, d: 1.1, h: 0.6, base: 0.25 });
      h.position.set(x, 0, z);
      h.rotation.y = -Math.PI / 2;
      if (x < 0) {
        h.rotation.y = Math.PI / 2;
      }
      g.add(h);
    });
    const front = B.hall({ w: 2.2, d: 1.0, h: 0.55, base: 0.25 });
    front.position.set(0, 0, 3.1);
    g.add(front);
    const yard = mesh(box(4.0, 0.05, 4.6), M.stone);
    yard.position.set(0, 0.03, 0.4);
    yard.receiveShadow = true;
    g.add(yard);
    const incense = mesh(cyl(0.22, 0.28, 0.35, 12), M.gold);
    incense.position.set(0, 0.2, 0.2);
    g.add(incense);
    g.add(B.wallLoop([[-3.7, -3.6], [3.7, -3.6], [3.7, 4.0], [-3.7, 4.0]]));
    const gt = B.gate(2.2);
    gt.position.set(0, 0, 4.9);
    g.add(gt);
    [[-1.6, 1.6], [1.6, 1.6], [-1.6, -0.6], [1.6, -0.6]].forEach(([x, z]) => {
      const l = B.lantern();
      l.position.set(x, 0.05, z);
      g.add(l);
    });
    [[-3.9, 4.3], [3.9, 4.3], [-3.9, -3.9], [3.9, -3.9]].forEach(([x, z]) => {
      const bn = B.banner('#a3281e');
      bn.position.set(x, 0, z);
      g.add(bn);
    });
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    return collect(outer, M);
  })();

  // Sect III: Heavenly Balance Temple on the lake tier (gold banners), water pavilion, stair and zigzag bridge
  const lake = (() => {
    const M = createMats();
    const B = builders(M);
    const g = new THREE.Group();
    const base = SITES.lake;
    placeA(g, B.roundTemple(), base.a, base.b, 0, 0);
    placeA(g, B.hall({ w: 1.8, d: 1.0, h: 0.55, roofMat: M.tileGreen }), base.a + 2.6, base.b + 1.4, 0, FACE + 30);
    placeA(g, B.hall({ w: 1.5, d: 0.9, h: 0.5, roofMat: M.tileGreen }), base.a + 1.6, base.b + 3.0, 0, FACE + 60);
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
    const lw = A2W(LAKE.a + 1.5, LAKE.b + 0.5);
    pav.position.set(lw.x, WATER_Y, lw.z);
    g.add(pav);
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
    }
    [[base.a + 0.5, base.b - 3.2], [base.a + 3.4, base.b - 1.4], [base.a - 2.2, base.b + 2.6]].forEach(([a, b]) =>
      placeA(g, B.banner('#c8952e'), a, b),
    );
    return collect(g, M);
  })();

  // arched stone bridge where the path crosses the river
  const bridge = (() => {
    const M = createMats();
    const p = A2W(1.25, 10.9);
    const q = A2W(-0.9, 10.3);
    const len = Math.hypot(q.x - p.x, q.z - p.z) + 1.4;
    const shape = new THREE.Shape();
    shape.moveTo(-len / 2, 0);
    shape.quadraticCurveTo(0, 1.4, len / 2, 0);
    shape.lineTo(len / 2, -0.3);
    shape.lineTo(-len / 2, -0.3);
    const hole = new THREE.Path();
    hole.moveTo(-len * 0.32, -0.3);
    hole.quadraticCurveTo(0, 0.9, len * 0.32, -0.3);
    shape.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: false });
    geo.translate(0, 0, -0.35);
    const br = mesh(geo, M.stone);
    br.position.set((p.x + q.x) / 2, 0.15, (p.z + q.z) / 2);
    br.rotation.y = -Math.atan2(q.z - p.z, q.x - p.x);
    br.castShadow = true;
    return br;
  })();

  return { ledge, valley, lake, bridge };
}
