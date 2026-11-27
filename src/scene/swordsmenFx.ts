// three.js side of the flying swordsmen: a handful of character types built once as merged vertex-coloured geometry
// (a static body plus a cloth mesh whose hair, sleeves, skirt panels and ribbons sway in a vertex shader), a soft
// additive qi trail per sword, and one rig per flyer that shares them. Local frame: +z is the heading, +y up, +x left,
// feet on the blade at y = 0, a person about 1.8 tall.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Flyer, FlyerPose } from './swordsmen';

const TAU = Math.PI * 2;
const SKIN = '#e8c4a0';

type Glow = 'gold' | 'cyan' | 'crimson';
type Look = {
  outer: string; inner: string; sash: string; trim: string; hair: string; ribbon: string; boot: string; cape?: string;
  glow: Glow; knot: 'topknot' | 'halfup' | 'loose' | 'hat';
  hairLen: number; sleeve: number; // sleeve width scale
  extras: ('backSword' | 'gourd' | 'fan' | 'jade' | 'scarf' | 'cape')[];
  scale: number;
};

// reds and golds (pagoda), grey and green (hall), blue and white (temple), black and crimson (villains)
const LOOKS: Look[] = [
  { outer: '#a3281e', inner: '#f0e2c0', sash: '#d8a640', trim: '#e0b36a', hair: '#15131a', ribbon: '#e0b36a', boot: '#2a1a14', glow: 'gold', knot: 'topknot', hairLen: 1.7, sleeve: 1.1, extras: ['jade', 'fan'], scale: 0.9 },
  { outer: '#b9442a', inner: '#e9d6a8', sash: '#8a1d17', trim: '#d8a640', hair: '#1a141a', ribbon: '#a3281e', boot: '#2a1a14', glow: 'gold', knot: 'halfup', hairLen: 2.1, sleeve: 1.4, extras: ['gourd', 'jade', 'scarf'], scale: 0.86 },
  { outer: '#68736a', inner: '#d3d9c8', sash: '#3e6b4b', trim: '#9fb08f', hair: '#16171b', ribbon: '#3e6b4b', boot: '#26241f', glow: 'cyan', knot: 'topknot', hairLen: 1.5, sleeve: 1.0, extras: ['backSword', 'jade'], scale: 0.92 },
  { outer: '#34563f', inner: '#bfc7bd', sash: '#7d8a78', trim: '#c9d3be', hair: '#13161a', ribbon: '#9fb08f', boot: '#22231f', cape: '#3f5f49', glow: 'cyan', knot: 'halfup', hairLen: 2.0, sleeve: 1.25, extras: ['cape', 'gourd'], scale: 0.88 },
  { outer: '#eaeff6', inner: '#4a6fa5', sash: '#37588f', trim: '#a9c3e8', hair: '#12141c', ribbon: '#a9c3e8', boot: '#2b3140', glow: 'cyan', knot: 'halfup', hairLen: 2.3, sleeve: 1.5, extras: ['fan', 'jade', 'scarf'], scale: 0.84 },
  { outer: '#2f4f86', inner: '#e8edf5', sash: '#d7e0ef', trim: '#c9d6ec', hair: '#14151c', ribbon: '#e8edf5', boot: '#262c3c', glow: 'cyan', knot: 'hat', hairLen: 1.6, sleeve: 1.2, extras: ['jade', 'backSword'], scale: 0.9 },
  { outer: '#17141a', inner: '#8e1523', sash: '#b3202f', trim: '#c4283a', hair: '#0f0d12', ribbon: '#b3202f', boot: '#100e12', cape: '#1d1519', glow: 'crimson', knot: 'loose', hairLen: 2.4, sleeve: 1.3, extras: ['backSword', 'cape'], scale: 0.93 },
  { outer: '#221a22', inner: '#a01a2c', sash: '#5a1020', trim: '#d03348', hair: '#14101a', ribbon: '#d03348', boot: '#100e12', glow: 'crimson', knot: 'hat', hairLen: 1.8, sleeve: 1.45, extras: ['gourd', 'scarf'], scale: 0.9 },
];
// first flyers show a spread of sects, a villain early; the order also gives the low flyers distinct looks
const ORDER = [0, 4, 6, 2, 1, 5, 3, 7];
const GLOW_RGB: Record<Glow, string> = { gold: '#ffc861', cyan: '#6fe9ff', crimson: '#ff3a4e' };

type V = [number, number, number];
const v3 = (a: V) => new THREE.Vector3(a[0], a[1], a[2]);
const UP = new THREE.Vector3(0, 1, 0);

class Builder {
  body: THREE.BufferGeometry[] = [];
  cloth: THREE.BufferGeometry[] = [];
  // transform applied to everything added after it is set (the twisted upper body)
  tx = new THREE.Matrix4();
  private put(list: THREE.BufferGeometry[], g: THREE.BufferGeometry, color: string | THREE.Color[]) {
    g.deleteAttribute('uv');
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      if (Array.isArray(color)) c.copy(color[Math.min(i, color.length - 1)]);
      if (!Array.isArray(color)) c.set(color);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.applyMatrix4(this.tx);
    list.push(g);
  }
  // a tapered cylinder from a to b
  bone(a: V, b: V, r0: number, r1: number, color: string, seg = 6) {
    const pa = v3(a);
    const pb = v3(b);
    const len = pa.distanceTo(pb);
    const g = new THREE.CylinderGeometry(r1, r0, len, seg);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, pb.clone().sub(pa).normalize()));
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    this.put(this.body, g, color);
  }
  blob(p: V, sx: number, sy: number, sz: number, color: string, ws = 8, hs = 6) {
    const g = new THREE.SphereGeometry(1, ws, hs);
    g.scale(sx, sy, sz);
    g.translate(p[0], p[1], p[2]);
    this.put(this.body, g, color);
  }
  box(p: V, s: V, color: string, rot: V = [0, 0, 0]) {
    const g = new THREE.BoxGeometry(s[0], s[1], s[2]);
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YXZ')));
    g.translate(p[0], p[1], p[2]);
    this.put(this.body, g, color);
  }
  geo(g: THREE.BufferGeometry, color: string, cloth = false) {
    if (cloth) {
      this.put(this.cloth, g, color);
      this.flow(g, 0, 0);
      return;
    }
    this.put(this.body, g, color);
  }
  // swaying ribbon along pts (side is the cross direction, w the width per point); flow rises from f0 at the root to 1
  strip(pts: V[], w: number[], side: V, colors: string[], f0 = 0, ph = 0) {
    const n = pts.length;
    const pos = new Float32Array(n * 2 * 3);
    const cols: THREE.Color[] = [];
    const sd = v3(side).normalize();
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 2; k++) {
        const s = (k - 0.5) * w[i];
        pos[(i * 2 + k) * 3] = pts[i][0] + sd.x * s;
        pos[(i * 2 + k) * 3 + 1] = pts[i][1] + sd.y * s;
        pos[(i * 2 + k) * 3 + 2] = pts[i][2] + sd.z * s;
        cols.push(new THREE.Color(colors[Math.min(i, colors.length - 1)]));
      }
    }
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    this.put(this.cloth, g, cols);
    const fl = new Float32Array(n * 2);
    for (let i = 0; i < n * 2; i++) fl[i] = f0 + (1 - f0) * Math.pow(Math.floor(i / 2) / (n - 1), 1.3);
    g.setAttribute('aFlow', new THREE.BufferAttribute(fl, 1));
    g.setAttribute('aPh', new THREE.BufferAttribute(new Float32Array(n * 2).fill(ph), 1));
  }
  // flat cloth shapes (the fan) carry fixed flow values
  private flow(g: THREE.BufferGeometry, f: number, ph: number) {
    const n = g.attributes.position.count;
    g.setAttribute('aFlow', new THREE.BufferAttribute(new Float32Array(n).fill(f), 1));
    g.setAttribute('aPh', new THREE.BufferAttribute(new Float32Array(n).fill(ph), 1));
  }
  merged() {
    const body = mergeGeometries(this.body, false);
    const cloth = mergeGeometries(this.cloth, false);
    if (!body || !cloth) throw new Error('swordsmen: mismatched geometry attributes');
    this.body.forEach((g) => g.dispose());
    this.cloth.forEach((g) => g.dispose());
    return { body, cloth };
  }
}

// the jian under the feet: steel blade with a tapered tip, gold guard, wrapped hilt, tassel
function sword(B: Builder, L: Look) {
  B.box([0, -0.014, 0.32], [0.11, 0.026, 2.2], '#d7e0e8');
  B.box([0, -0.0, 0.32], [0.03, 0.03, 2.2], '#8f9ba6');
  const tip = new THREE.ConeGeometry(0.055, 0.34, 4);
  tip.scale(1, 1, 0.25);
  tip.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  tip.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI / 4));
  tip.translate(0, -0.014, 1.59);
  B.geo(tip, '#d7e0e8');
  B.box([0, -0.014, -0.8], [0.3, 0.035, 0.06], L.trim);
  B.bone([0, -0.014, -0.84], [0, -0.014, -1.2], 0.02, 0.022, L.boot);
  B.blob([0, -0.014, -1.22], 0.035, 0.035, 0.035, L.trim);
  B.strip([[0, -0.02, -1.24], [0, -0.17, -1.5], [0.02, -0.3, -1.95]], [0.07, 0.08, 0.05], [1, 0, 0], [L.sash, L.sash, L.trim], 0.2, 1);
}

function character(L: Look, ph: number) {
  const B = new Builder();
  sword(B, L);
  const wrap = L.trim;
  const dark = L.boot;
  // legs: front foot forward, knees bent
  const legs: { hip: V; knee: V; ankle: V }[] = [
    { hip: [-0.1, 0.84, 0.0], knee: [-0.12, 0.5, 0.3], ankle: [-0.09, 0.1, 0.4] },
    { hip: [0.1, 0.84, -0.02], knee: [0.14, 0.48, -0.2], ankle: [0.1, 0.1, -0.3] },
  ];
  for (const l of legs) {
    B.bone(l.hip, l.knee, 0.1, 0.075, L.inner);
    B.bone(l.knee, l.ankle, 0.078, 0.06, dark);
    // calf wraps
    for (const t of [0.35, 0.6]) {
      const p: V = [l.knee[0] + (l.ankle[0] - l.knee[0]) * t, l.knee[1] + (l.ankle[1] - l.knee[1]) * t, l.knee[2] + (l.ankle[2] - l.knee[2]) * t];
      const q: V = [p[0], p[1] - 0.04, p[2] + 0.01];
      B.bone(p, q, 0.082 - 0.02 * t, 0.082 - 0.02 * t, wrap, 6);
    }
    B.box([l.ankle[0], 0.04, l.ankle[2] + 0.07], [0.12, 0.08, 0.28], dark);
    B.box([l.ankle[0], 0.012, l.ankle[2] + 0.08], [0.125, 0.025, 0.3], '#0d0b0b');
  }
  // skirt of the outer robe over the hips
  const sk = new THREE.CylinderGeometry(0.2, 0.31, 0.5, 10, 1, true);
  sk.translate(0, 0.62, -0.04);
  B.geo(sk, L.outer, true);
  const hem = new THREE.CylinderGeometry(0.31, 0.315, 0.05, 10, 1, true);
  hem.translate(0, 0.4, -0.04);
  B.geo(hem, L.trim, true);

  // upper body, turned to the left of the heading
  B.tx = new THREE.Matrix4().makeRotationY(0.5);
  B.bone([0, 0.84, -0.02], [0, 1.4, 0], 0.15, 0.17, L.inner, 8);
  B.bone([0, 0.84, -0.02], [0, 1.4, 0], 0.185, 0.205, L.outer, 8);
  B.box([0.05, 1.27, 0.2], [0.045, 0.3, 0.02], L.inner, [0, 0, 0.32]);
  B.box([-0.05, 1.27, 0.2], [0.045, 0.3, 0.02], L.inner, [0, 0, -0.32]);
  B.box([0.1, 1.24, 0.205], [0.02, 0.3, 0.012], L.trim, [0, 0, 0.32]);
  B.box([-0.1, 1.24, 0.205], [0.02, 0.3, 0.012], L.trim, [0, 0, -0.32]);
  B.bone([0, 1.38, 0.0], [0, 1.45, 0.0], 0.11, 0.1, L.inner, 8);
  B.blob([0.19, 1.39, 0], 0.08, 0.07, 0.08, L.outer);
  B.blob([-0.19, 1.39, 0], 0.08, 0.07, 0.08, L.outer);
  // sash, knot, hanging tails, jade pendant
  B.bone([0, 0.88, -0.02], [0, 0.98, -0.02], 0.215, 0.215, L.sash, 10);
  B.box([0.1, 0.92, 0.2], [0.11, 0.1, 0.05], L.sash);
  B.strip([[0.1, 0.88, 0.22], [0.13, 0.62, 0.2], [0.15, 0.4, 0.1]], [0.07, 0.08, 0.06], [1, 0, 0], [L.sash, L.sash, L.trim], 0.3, ph);
  B.strip([[0.07, 0.88, 0.22], [0.04, 0.6, 0.22], [0.02, 0.36, 0.15]], [0.06, 0.07, 0.05], [1, 0, 0], [L.sash, L.sash, L.trim], 0.3, ph + 1);
  if (L.extras.includes('jade')) {
    B.bone([-0.18, 0.9, 0.12], [-0.2, 0.62, 0.15], 0.006, 0.006, L.trim, 4);
    const jd = new THREE.CylinderGeometry(0.05, 0.05, 0.018, 8);
    jd.rotateX(Math.PI / 2);
    jd.translate(-0.2, 0.58, 0.16);
    B.geo(jd, '#7fd6a4');
    B.strip([[-0.2, 0.55, 0.16], [-0.2, 0.42, 0.14], [-0.19, 0.3, 0.08]], [0.03, 0.04, 0.03], [1, 0, 0], [L.ribbon], 0.4, ph + 2);
  }

  // right arm: sword fingers pointing along the blade
  const sh: V = [-0.19, 1.38, 0];
  const el: V = [-0.37, 1.27, 0.27];
  const wr: V = [-0.35, 1.4, 0.55];
  B.bone(sh, el, 0.06, 0.055, L.outer);
  B.bone(el, wr, 0.07 * L.sleeve, 0.12 * L.sleeve, L.outer, 9);
  B.bone([el[0], el[1] - 0.02, el[2]], [wr[0], wr[1] - 0.02, wr[2]], 0.04, 0.1 * L.sleeve, L.inner, 9);
  B.blob([wr[0], wr[1] + 0.02, wr[2] + 0.08], 0.05, 0.05, 0.06, SKIN);
  B.box([wr[0] - 0.012, wr[1] + 0.07, wr[2] + 0.2], [0.016, 0.016, 0.15], SKIN, [-0.45, 0, 0]);
  B.box([wr[0] + 0.012, wr[1] + 0.07, wr[2] + 0.2], [0.016, 0.016, 0.15], SKIN, [-0.45, 0, 0]);
  const cuffR: V[] = [[wr[0], wr[1] - 0.06, wr[2] - 0.05], [wr[0] - 0.02, wr[1] - 0.2, wr[2] - 0.35], [wr[0] - 0.04, wr[1] - 0.3, wr[2] - 0.8], [wr[0] - 0.05, wr[1] - 0.3, wr[2] - 1.35]];
  B.strip(cuffR, [0.2, 0.26, 0.3, 0.24].map((x) => x * L.sleeve), [1, 0, 0], [L.outer, L.outer, L.outer, L.trim], 0.1, ph + 3);
  B.strip(cuffR, [0.18, 0.22, 0.26, 0.2].map((x) => x * L.sleeve), [0, 1, 0], [L.inner, L.inner, L.outer, L.trim], 0.1, ph + 3.7);
  // left arm behind the back
  const sh2: V = [0.19, 1.38, 0];
  const el2: V = [0.31, 1.12, -0.14];
  const wr2: V = [0.1, 0.98, -0.3];
  B.bone(sh2, el2, 0.06, 0.055, L.outer);
  B.bone(el2, wr2, 0.07 * L.sleeve, 0.11 * L.sleeve, L.outer, 9);
  B.blob([wr2[0] - 0.03, wr2[1], wr2[2] - 0.05], 0.05, 0.05, 0.05, SKIN);
  const cuffL: V[] = [[wr2[0], wr2[1] - 0.05, wr2[2] - 0.05], [wr2[0] + 0.04, wr2[1] - 0.15, wr2[2] - 0.4], [wr2[0] + 0.07, wr2[1] - 0.22, wr2[2] - 0.9], [wr2[0] + 0.08, wr2[1] - 0.2, wr2[2] - 1.5]];
  B.strip(cuffL, [0.2, 0.25, 0.28, 0.22].map((x) => x * L.sleeve), [1, 0, 0], [L.outer, L.outer, L.outer, L.trim], 0.1, ph + 5);
  B.strip(cuffL, [0.17, 0.21, 0.24, 0.2].map((x) => x * L.sleeve), [0, 1, 0], [L.inner, L.outer, L.outer, L.trim], 0.1, ph + 5.5);

  // head
  B.bone([0, 1.44, 0.02], [0, 1.54, 0.03], 0.045, 0.045, SKIN);
  B.blob([0, 1.64, 0.04], 0.105, 0.12, 0.11, SKIN, 10, 8);
  B.box([0.04, 1.65, 0.148], [0.028, 0.012, 0.01], '#1b1412');
  B.box([-0.04, 1.65, 0.148], [0.028, 0.012, 0.01], '#1b1412');
  B.box([0.04, 1.68, 0.15], [0.04, 0.008, 0.01], L.hair, [0, 0, 0.12]);
  B.box([-0.04, 1.68, 0.15], [0.04, 0.008, 0.01], L.hair, [0, 0, -0.12]);
  const cap = new THREE.SphereGeometry(0.125, 10, 6, 0, TAU, 0, 1.85);
  cap.scale(1, 1.02, 1.08);
  cap.applyMatrix4(new THREE.Matrix4().makeRotationX(-0.38));
  cap.translate(0, 1.66, 0.0);
  B.geo(cap, L.hair);
  B.strip([[0.115, 1.66, 0.07], [0.12, 1.5, 0.05], [0.1, 1.38, 0.0]], [0.05, 0.05, 0.03], [0, 0, 1], [L.hair], 0, ph);
  B.strip([[-0.115, 1.66, 0.07], [-0.12, 1.5, 0.05], [-0.1, 1.38, 0.0]], [0.05, 0.05, 0.03], [0, 0, 1], [L.hair], 0, ph);
  let kz = -0.05;
  if (L.knot === 'topknot') {
    B.blob([0, 1.8, -0.04], 0.065, 0.07, 0.065, L.hair);
    B.bone([0, 1.76, -0.04], [0, 1.8, -0.04], 0.05, 0.05, L.trim, 8);
    B.box([0, 1.81, -0.04], [0.22, 0.014, 0.014], L.trim);
  }
  if (L.knot === 'halfup') {
    B.blob([0, 1.77, -0.09], 0.05, 0.055, 0.05, L.hair);
    B.box([0, 1.74, -0.09], [0.09, 0.03, 0.03], L.ribbon);
    kz = -0.09;
  }
  if (L.knot === 'loose') {
    // wild loose hair: two extra locks swept up and back
    B.strip([[0.06, 1.74, -0.05], [0.12, 1.84, -0.2], [0.1, 1.86, -0.5]], [0.1, 0.1, 0.05], [1, 0, 0], [L.hair], 0.2, ph + 2);
    B.strip([[-0.06, 1.74, -0.05], [-0.12, 1.84, -0.2], [-0.1, 1.86, -0.5]], [0.1, 0.1, 0.05], [1, 0, 0], [L.hair], 0.2, ph + 2.4);
  }
  if (L.knot === 'hat') {
    const brim = new THREE.ConeGeometry(0.34, 0.14, 12, 1, true);
    brim.translate(0, 1.82, 0.0);
    B.geo(brim, '#c9a96b', true);
    B.bone([0.1, 1.78, 0.05], [0.07, 1.56, 0.1], 0.006, 0.006, L.trim, 4);
    B.bone([-0.1, 1.78, 0.05], [-0.07, 1.56, 0.1], 0.006, 0.006, L.trim, 4);
  }
  // long hair streaming behind, and the ribbon
  const hl = L.hairLen;
  const hpts = (dx: number, dy: number): V[] => [
    [dx * 0.4, 1.7, -0.1], [dx, 1.56 + dy, -0.35], [dx * 1.3, 1.45 + dy, -0.35 - hl * 0.4], [dx * 1.5, 1.4 + dy, -0.35 - hl * 0.75], [dx * 1.6, 1.37 + dy, -0.35 - hl],
  ];
  const hw = [0.1, 0.16, 0.18, 0.14, 0.05];
  B.strip(hpts(0, 0), hw, [1, 0, 0], [L.hair], 0.05, ph + 1);
  B.strip(hpts(0.05, -0.04), hw, [1, 0, 0.0], [L.hair], 0.05, ph + 2.1);
  B.strip(hpts(-0.05, -0.02), hw, [1, 0, 0], [L.hair], 0.05, ph + 3.3);
  B.strip(hpts(0, 0), hw.map((x) => x * 0.9), [0, 1, 0], [L.hair], 0.05, ph + 4);
  const rb = (dx: number, p: number) =>
    B.strip([[dx, 1.74, kz], [dx * 1.5, 1.68, kz - 0.4], [dx * 2, 1.58, kz - 1.0], [dx * 2.4, 1.5, kz - 1.6]], [0.06, 0.08, 0.09, 0.06], [1, 0, 0], [L.ribbon, L.ribbon, L.ribbon, L.trim], 0.1, ph + p);
  rb(0.03, 6);
  rb(-0.03, 7);

  // accessories (all in the twisted upper-body frame, so they follow the torso)
  if (L.extras.includes('backSword')) {
    B.bone([-0.1, 1.0, -0.2], [0.1, 1.76, -0.22], 0.032, 0.03, '#1d1a1a');
    B.bone([0.1, 1.76, -0.22], [0.12, 1.92, -0.22], 0.02, 0.02, L.boot);
    B.blob([0.12, 1.94, -0.22], 0.03, 0.03, 0.03, L.trim);
    B.box([0.1, 1.76, -0.22], [0.1, 0.02, 0.05], L.trim, [0, 0, 0.2]);
    B.strip([[0.125, 1.94, -0.22], [0.14, 1.85, -0.5], [0.16, 1.75, -0.95]], [0.04, 0.05, 0.04], [1, 0, 0], [L.sash, L.sash, L.trim], 0.3, ph + 8);
  }
  if (L.extras.includes('gourd')) {
    B.blob([0.27, 0.74, -0.06], 0.075, 0.09, 0.075, '#c58a3c');
    B.blob([0.27, 0.87, -0.06], 0.05, 0.055, 0.05, '#c58a3c');
    B.bone([0.27, 0.92, -0.06], [0.27, 0.96, -0.06], 0.02, 0.016, '#7b4a1f', 5);
    B.bone([0.2, 0.96, -0.05], [0.27, 0.9, -0.06], 0.008, 0.008, L.sash, 4);
  }
  if (L.extras.includes('fan')) {
    const fan = new THREE.CircleGeometry(0.2, 9, 0.35, 2.4);
    fan.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.2, 0.9, 0.9)));
    fan.translate(-0.26, 1.0, 0.1);
    B.geo(fan, L.trim, true);
    B.box([-0.26, 0.97, 0.1], [0.012, 0.012, 0.09], L.boot, [0, 0.9, 0]);
  }
  B.tx = new THREE.Matrix4();
  if (L.extras.includes('scarf')) {
    B.strip([[0.1, 1.44, 0.1], [0.1, 1.4, -0.35], [0.16, 1.32, -1.1], [0.2, 1.3, -1.9]], [0.1, 0.14, 0.16, 0.12], [0, 1, 0], [L.trim, L.trim, L.ribbon, L.ribbon], 0.15, ph + 9);
    B.strip([[0.1, 1.44, 0.1], [0.1, 1.4, -0.35], [0.16, 1.32, -1.1], [0.2, 1.3, -1.9]], [0.08, 0.1, 0.12, 0.1], [1, 0, 0], [L.trim, L.trim, L.ribbon, L.ribbon], 0.15, ph + 9.3);
  }
  const cape = L.cape ?? L.outer;
  if (L.extras.includes('cape')) {
    B.strip([[0, 1.43, -0.14], [0, 1.2, -0.5], [0, 0.98, -1.15], [0, 0.82, -1.85]], [0.38, 0.52, 0.62, 0.58], [1, 0, 0], [cape, cape, cape, L.inner], 0.1, ph + 10);
  }
  // skirt panels streaming behind, each tapering towards the tip and edged in trim
  const panel = (x: number, c: string[], ph2: number, len: number, wd: number) =>
    B.strip([[x * 0.6, 0.84, -0.12], [x, 0.58, -0.45 * len], [x * 1.25, 0.42, -0.95 * len], [x * 1.4, 0.34, -1.5 * len]], [0.2 * wd, 0.28 * wd, 0.32 * wd, 0.28 * wd], [1, 0, 0], c, 0.12, ph2);
  panel(0.17, [L.outer, L.outer, L.outer, L.trim], ph + 11, 1, 1);
  panel(-0.17, [L.outer, L.outer, L.outer, L.trim], ph + 12, 1, 1);
  panel(0, [L.inner, L.inner, L.outer, L.trim], ph + 13, 0.85, 1.1);
  panel(0.28, [L.inner, L.outer, L.outer, L.trim], ph + 14, 0.7, 0.8);
  panel(-0.28, [L.inner, L.outer, L.outer, L.trim], ph + 15, 0.7, 0.8);
  B.strip([[0, 0.8, 0.2], [0, 0.5, 0.3], [0, 0.3, 0.12], [0, 0.22, -0.2]], [0.2, 0.22, 0.22, 0.18], [1, 0, 0], [L.outer, L.outer, L.outer, L.trim], 0.3, ph + 16);
  return B.merged();
}

// qi: blade aura plus two crossing ribbons trailing behind the sword. aFx = (fade, across, wave, gain)
function fxGeometry() {
  const pos: number[] = [];
  const fx: number[] = [];
  const idx: number[] = [];
  const quad = (pts: { p: V; across: V; w: number; fade: number; wave: number; gain: number }[]) => {
    const base = pos.length / 3;
    for (const q of pts) {
      for (const s of [-1, 1]) {
        pos.push(q.p[0] + q.across[0] * q.w * s, q.p[1] + q.across[1] * q.w * s, q.p[2] + q.across[2] * q.w * s);
        fx.push(q.fade, s, q.wave, q.gain);
      }
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = base + i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  };
  for (const across of [[1, 0, 0], [0, 1, 0]] as V[]) {
    // blade aura
    quad([-0.85, 0.2, 0.9, 1.65].map((z, i) => ({ p: [0, -0.014, z] as V, across, w: [0.1, 0.22, 0.22, 0.02][i], fade: 1, wave: 0, gain: 1.1 })));
    // trail
    const N = 14;
    const t: { p: V; across: V; w: number; fade: number; wave: number; gain: number }[] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      t.push({ p: [0, -0.014, -1.1 - u * 8], across, w: 0.3 * (1 - u * 0.9) * (0.4 + 0.6 * Math.sin(Math.min(1, u * 8) * Math.PI / 2)), fade: 1 - u, wave: u, gain: 1 });
    }
    quad(t);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aFx', new THREE.Float32BufferAttribute(fx, 4));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -3.5), 6);
  return g;
}

export type Swordsmen = {
  group: THREE.Group;
  update: (t: number) => void;
  // world position of flyer i (live), for the close-up debug hook
  position: (i: number) => THREE.Vector3;
  heading: (i: number) => number;
  dispose: () => void;
};

export function createSwordsmenFx(flyers: Flyer[], enabled: boolean): Swordsmen {
  const group = new THREE.Group();
  group.visible = enabled;
  const uTime = { value: 0 };

  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1 });
  const clothMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
  clothMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aFlow;\nattribute float aPh;\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float fl = aFlow * aFlow;
        float ph = aPh + transformed.z * 2.2;
        transformed.x += sin(uTime * 6.5 + ph) * 0.09 * fl;
        transformed.y += sin(uTime * 5.1 + ph * 1.3 + 1.7) * 0.07 * fl;
        transformed.z += sin(uTime * 3.2 + aPh) * 0.12 * fl;`,
      );
  };
  const fxMats = {} as Record<Glow, THREE.ShaderMaterial>;
  for (const k of Object.keys(GLOW_RGB) as Glow[]) {
    fxMats[k] = new THREE.ShaderMaterial({
      uniforms: { uTime, uColor: { value: new THREE.Color(GLOW_RGB[k]) } },
      vertexShader: /* glsl */ `
        attribute vec4 aFx;
        uniform float uTime;
        varying vec4 vFx;
        void main() {
          vFx = aFx;
          vec3 p = position;
          p.x += sin(uTime * 6.0 + aFx.z * 11.0) * 0.12 * aFx.z;
          p.y += cos(uTime * 5.0 + aFx.z * 9.0) * 0.1 * aFx.z;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uTime;
        varying vec4 vFx;
        void main() {
          float soft = 1.0 - abs(vFx.y);
          float streak = 0.75 + 0.25 * sin(vFx.z * 40.0 - uTime * 14.0 + vFx.y * 3.0);
          float a = soft * soft * pow(vFx.x, 1.4) * vFx.w * streak * 0.55;
          gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.35 * soft * soft * vFx.x) * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
      toneMapped: false,
    });
  }

  const fxGeo = fxGeometry();
  const types = new Map<number, { body: THREE.BufferGeometry; cloth: THREE.BufferGeometry }>();
  type Rig = { root: THREE.Group; rig: THREE.Group; offset: number; bob: number; scale: number };
  const rigs: Rig[] = [];
  flyers.forEach((f, i) => {
    const ti = ORDER[i % ORDER.length];
    const L = LOOKS[ti];
    let geo = types.get(ti);
    if (!geo) {
      geo = character(L, ti * 1.9);
      types.set(ti, geo);
    }
    const root = new THREE.Group();
    root.rotation.order = 'YXZ';
    const rig = new THREE.Group();
    const parts = [new THREE.Mesh(geo.body, bodyMat), new THREE.Mesh(geo.cloth, clothMat), new THREE.Mesh(fxGeo, fxMats[L.glow])];
    for (const m of parts) {
      m.raycast = () => {}; // never block sect hover and click
      m.frustumCulled = false;
      rig.add(m);
    }
    rig.scale.setScalar(L.scale);
    root.add(rig);
    group.add(root);
    rigs.push({ root, rig, offset: f.period * ((i * 0.381) % 1), bob: i * 1.7, scale: L.scale });
  });

  const pose: FlyerPose = { x: 0, y: 0, z: 0, yaw: 0, bank: 0, pitch: 0 };
  const update = (t: number) => {
    uTime.value = t;
    if (!enabled) return;
    for (let i = 0; i < flyers.length; i++) {
      const r = rigs[i];
      flyers[i].pathAt(t + r.offset, pose);
      r.root.position.set(pose.x, pose.y + Math.sin(t * 1.6 + r.bob) * 0.06, pose.z);
      r.root.rotation.set(-pose.pitch * 0.8, pose.yaw, pose.bank, 'YXZ');
    }
  };
  const tmp = new THREE.Vector3();
  const dispose = () => {
    for (const g of types.values()) {
      g.body.dispose();
      g.cloth.dispose();
    }
    fxGeo.dispose();
    bodyMat.dispose();
    clothMat.dispose();
    for (const k of Object.keys(fxMats) as Glow[]) fxMats[k].dispose();
  };
  return {
    group,
    update,
    position: (i) => tmp.copy(rigs[i].root.position),
    heading: (i) => rigs[i].root.rotation.y,
    dispose,
  };
}
