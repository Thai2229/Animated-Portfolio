import * as THREE from "three";
import { fbm3, mix, noise3, sampleSphere, sstep, type RGB } from "./noise";

export type Maps = {
  w: number;
  h: number;
  color: Uint8ClampedArray;
  bump: Uint8ClampedArray;
  rough: Uint8ClampedArray;
};

function blank(w: number, h: number): Maps {
  const n = w * h * 4;
  return { w, h, color: new Uint8ClampedArray(n), bump: new Uint8ClampedArray(n), rough: new Uint8ClampedArray(n) };
}

function put(a: Uint8ClampedArray, i: number, r: number, g: number, b: number, al = 255) {
  a[i * 4] = r;
  a[i * 4 + 1] = g;
  a[i * 4 + 2] = b;
  a[i * 4 + 3] = al;
}

function grey(a: Uint8ClampedArray, i: number, v: number) {
  put(a, i, v * 255, v * 255, v * 255);
}

export function earthMaps(w = 1024, h = 512): Maps {
  const m = blank(w, h);
  const SEA = 0.54;
  sampleSphere(w, h, (x, y, z, i) => {
    // domain warp: continents get ragged, believable coastlines
    const wx = (noise3(x * 1.7 + 3.1, y * 1.7, z * 1.7) - 0.5) * 0.9;
    const wy = (noise3(x * 1.7, y * 1.7 + 7.7, z * 1.7) - 0.5) * 0.9;
    const wz = (noise3(x * 1.7, y * 1.7, z * 1.7 + 13.3) - 0.5) * 0.9;
    const ht = fbm3(x * 1.5 + wx, y * 1.5 + wy, z * 1.5 + wz, 6);
    const lat = Math.abs(y);
    const iceEdge = 0.86 + (fbm3(x * 4, y * 4, z * 4, 3) - 0.5) * 0.14;
    let c: RGB;
    let height = 0.25;
    let rough = 70;
    if (ht < SEA) {
      c = mix([3, 14, 46], [24, 96, 152], sstep(0.3, SEA, ht));
      c = mix(c, [70, 160, 176], sstep(SEA - 0.025, SEA, ht));
    } else {
      const e = (ht - SEA) * 4;
      const moist = fbm3(x * 2.6 + 11, y * 2.6, z * 2.6 + 5, 4);
      const temp = 1 - lat * lat * 1.15 - e * 0.35;
      c = mix([176, 150, 102], [38, 88, 40], sstep(0.42, 0.58, moist));
      c = mix(c, [20, 68, 34], sstep(0.55, 0.7, moist) * (1 - lat));
      c = mix(c, [124, 130, 108], sstep(0.5, 0.25, temp));
      const d = 0.82 + 0.36 * fbm3(x * 18, y * 18, z * 18, 3);
      c = [c[0] * d, c[1] * d, c[2] * d];
      c = mix(c, [112, 106, 100], sstep(0.35, 0.6, e));
      c = mix(c, [240, 244, 248], sstep(0.7, 0.95, e + (0.6 - temp) * 0.8));
      height = 0.32 + e * 0.55 + (fbm3(x * 40, y * 40, z * 40, 2) - 0.5) * 0.12;
      rough = 230;
    }
    if (lat > iceEdge) {
      const k = sstep(iceEdge, iceEdge + 0.04, lat);
      c = mix(c, [236, 242, 248], k);
      rough = rough + (150 - rough) * k;
    }
    put(m.color, i, c[0], c[1], c[2]);
    grey(m.bump, i, Math.min(1, height));
    put(m.rough, i, rough, rough, rough);
  });
  return m;
}

// Alpha-only swirling cloud deck; the shear by latitude gives it storm-belt curls.
export function cloudMap(w = 512, h = 256): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  sampleSphere(w, h, (x, y, z, i) => {
    const a = Math.sin(y * 5) * 1.2 + (fbm3(x * 1.5, y * 1.5, z * 1.5, 3) - 0.5) * 3;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const xs = x * c - z * s;
    const zs = x * s + z * c;
    const d = fbm3(xs * 3 + 4, y * 5, zs * 3, 5);
    put(out, i, 255, 255, 255, sstep(0.56, 0.8, d) * 170);
  });
  return out;
}

export function marsMaps(w = 512, h = 256): Maps {
  const m = blank(w, h);
  sampleSphere(w, h, (x, y, z, i) => {
    const wx = (noise3(x * 2 + 1.3, y * 2, z * 2) - 0.5) * 0.7;
    const wy = (noise3(x * 2, y * 2 + 5.1, z * 2) - 0.5) * 0.7;
    const n = fbm3(x * 2.2 + wx, y * 2.2 + wy, z * 2.2, 6);
    let c = mix([118, 48, 26], [198, 98, 52], sstep(0.35, 0.65, n));
    c = mix(c, [58, 38, 34], sstep(0.55, 0.68, fbm3(x * 1.2 + 7, y * 1.2, z * 1.2, 3)) * 0.85);
    c = mix(c, [222, 150, 96], sstep(0.55, 0.75, fbm3(x * 1.2, y * 14, z * 1.2, 3)) * 0.45);
    const lat = Math.abs(y);
    const edge = 0.88 + (fbm3(x * 5, y * 5, z * 5, 3) - 0.5) * 0.1;
    c = mix(c, [240, 236, 232], sstep(edge, edge + 0.03, lat));
    put(m.color, i, c[0], c[1], c[2]);
    grey(m.bump, i, Math.min(1, n * 0.8 + fbm3(x * 30, y * 30, z * 30, 2) * 0.3));
    put(m.rough, i, 255, 255, 255);
  });
  return m;
}

export function giantMap(w = 512, h = 256): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  const lat0 = -0.3;
  const lon0 = 1;
  sampleSphere(w, h, (x, y, z, i) => {
    const wv = fbm3(x * 2, y * 7, z * 2, 4);
    const t = y * 9 + (wv - 0.5) * 3.2;
    const k = (Math.sin(t * Math.PI) + 1) / 2;
    const k2 = (Math.sin(t * 2.3 + 1) + 1) / 2;
    let c = mix([236, 218, 178], [196, 150, 98], k);
    c = mix(c, [150, 104, 66], sstep(0.6, 1, k2) * 0.6);
    const f = 0.9 + 0.2 * fbm3(x * 8, y * 30, z * 8, 3);
    c = [c[0] * f, c[1] * f, c[2] * f];
    c = mix(c, [110, 120, 130], sstep(0.7, 1, Math.abs(y)) * 0.5);
    // storm oval
    let dlon = Math.atan2(z, x) - lon0;
    dlon = Math.atan2(Math.sin(dlon), Math.cos(dlon)) * Math.cos(lat0);
    const dlat = Math.asin(y) - lat0;
    const e = (dlon / 0.34) ** 2 + (dlat / 0.15) ** 2;
    if (e < 1.6) {
      const curl = 0.5 + 0.5 * Math.sin(Math.atan2(dlat / 0.15, dlon / 0.34) * 2 + e * 6);
      c = mix(c, [236, 218, 178], sstep(0.8, 1, e) * sstep(1.6, 1.1, e) * 0.7);
      c = mix(c, [190, 84, 52], sstep(1.1, 0.2, e) * (0.65 + 0.3 * curl));
    }
    put(out, i, c[0], c[1], c[2]);
  });
  return out;
}

export function sunMap(w = 1024, h = 512): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4);
  sampleSphere(w, h, (x, y, z, i) => {
    const n = fbm3(x * 3, y * 3, z * 3, 6);
    const cells = fbm3(x * 18, y * 18, z * 18, 3);
    let c = mix([255, 150, 40], [255, 226, 130], sstep(0.3, 0.75, n));
    c = mix(c, [255, 245, 205], sstep(0.45, 0.8, cells) * 0.55);
    c = mix(c, [255, 110, 25], sstep(0.55, 0.8, fbm3(x * 9 + 4, y * 9, z * 9, 4)) * 0.35);
    const spot = sstep(0.68, 0.74, fbm3(x * 2.5 + 5, y * 2.5, z * 2.5, 3)) * (1 - Math.abs(y));
    c = mix(c, [150, 50, 10], spot * 0.8);
    put(out, i, c[0], c[1], c[2]);
  });
  return out;
}

// Ring seen face-on; RingGeometry UVs make radius t the distance from the texture centre (outer edge = 1).
export function ringMap(size = 512, inner = 0.566): Uint8ClampedArray {
  const out = new Uint8ClampedArray(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const t = Math.hypot(((i + 0.5) / size) * 2 - 1, ((j + 0.5) / size) * 2 - 1);
      if (t < inner || t > 1) {
        put(out, j * size + i, 0, 0, 0, 0);
        continue;
      }
      const s = (t - inner) / (1 - inner);
      const n1 = fbm3(s * 40, 1.7, 3.3, 4);
      const n2 = noise3(s * 220, 8.1, 2.2);
      let zone = 0.3 + 0.7 * sstep(0.12, 0.2, s);
      zone *= 1 - 0.95 * sstep(0.62, 0.66, s) * sstep(0.74, 0.7, s); // Cassini-style gap
      zone *= 1 - 0.8 * sstep(0.015, 0, Math.abs(s - 0.88)); // thin Encke-style gap
      zone *= 1 - sstep(0.96, 1, s);
      const d = Math.min(1, zone * (0.35 + n1 * 1.2) * (0.7 + 0.6 * n2));
      const c = mix([196, 170, 128], [236, 220, 190], n1);
      put(out, j * size + i, c[0], c[1], c[2], d * 235);
    }
  }
  return out;
}

export function toTexture(data: Uint8ClampedArray, w: number, h: number, srgb: boolean) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.colorSpace = THREE.NoColorSpace;
  if (srgb) {
    t.colorSpace = THREE.SRGBColorSpace;
  }
  t.wrapS = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

export function glowTexture(r: number, g: number, b: number, size = 128) {
  const d = new Uint8ClampedArray(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const k = Math.max(0, 1 - Math.hypot(i + 0.5 - size / 2, j + 0.5 - size / 2) / (size / 2));
      put(d, j * size + i, r, g, b, k * k * 255 * 0.6 + k * 255 * 0.4);
    }
  }
  return toTexture(d, size, size, true);
}
