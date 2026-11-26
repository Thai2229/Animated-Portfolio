// 3D value noise. Sampling it on the sphere (not on a flat u,v grid) is what keeps textures free of a seam.
export function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x: number, y: number, z: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  let xf = x - xi;
  let yf = y - yi;
  let zf = z - zi;
  xf = xf * xf * (3 - 2 * xf);
  yf = yf * yf * (3 - 2 * yf);
  zf = zf * zf * (3 - 2 * zf);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const x00 = l(hash(xi, yi, zi), hash(xi + 1, yi, zi), xf);
  const x10 = l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), xf);
  const x01 = l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), xf);
  const x11 = l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), xf);
  return l(l(x00, x10, yf), l(x01, x11, yf), zf);
}

export function fbm3(x: number, y: number, z: number, octaves = 5) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * f + i * 17.3, y * f + i * 9.1, z * f + i * 5.7);
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

export const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export type RGB = [number, number, number];
export const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

// Calls fn for every texel with its point on the unit sphere. Column w-1 sits next to column 0, so there is no seam.
export function sampleSphere(w: number, h: number, fn: (x: number, y: number, z: number, i: number) => void) {
  for (let j = 0; j < h; j++) {
    const lat = (j / (h - 1) - 0.5) * Math.PI;
    const cy = Math.cos(lat);
    const y = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = (i / w) * Math.PI * 2;
      fn(cy * Math.cos(lon), y, cy * Math.sin(lon), j * w + i);
    }
  }
}
