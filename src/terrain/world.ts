// Everything heavy and pure: heightfield, baked shadows, albedo texture and tree placement.
import { createNoise } from './noise';
import { generateHeightfield, makeHeightAt, polyDist } from './heightfield';
import { bakeShadows } from './bake';
import { A2W, W2A, SITES, SUN_DIR, RIVER, PATH_ALL } from './layout';
import type { Profile } from './profile';

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
type Rgb = [number, number, number];
const mixc = (c1: Rgb, c2: Rgb, t: number): Rgb => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

export type WorldData = {
  n: number;
  worldSize: number;
  heights: Float32Array;
  siteHeights: { ledge: number; valley: number; lake: number };
  tex: number;
  albedo: Uint8ClampedArray;
  treeCount: number;
  treeMatrices: Float32Array;
  treeHsl: Float32Array;
};

export function buildWorld(profile: Profile, report: (stage: string, fraction: number) => void): WorldData {
  const { n, worldSize, tex: TEX } = profile;
  report('Raising the mountains', 0);
  const hf = generateHeightfield({
    n, worldSize, seed: 0, erosionDroplets: profile.droplets,
    onProgress: (f) => report('Raising the mountains', f * 0.55),
  });
  const H = hf.heights;
  const texel = worldSize / (n - 1);
  const { simplex2: simplex, fbm } = createNoise(7331);
  const hAtW = makeHeightAt(H, n, worldSize);

  report('Casting shadows', 0.55);
  const L = SUN_DIR;
  const ll = Math.hypot(L.x, L.y, L.z);
  const sun = { x: L.x / ll, y: L.y / ll, z: L.z / ll };
  const shadow = bakeShadows(H, n, worldSize, sun);

  // box-blurred height for cavity / ambient occlusion
  const blur = new Float32Array(n * n);
  {
    const tmp = new Float32Array(n * n);
    const R = Math.max(2, Math.round((12 * n) / 1024));
    const cl = (v: number) => Math.min(n - 1, Math.max(0, v));
    for (let y = 0; y < n; y++) {
      let acc = 0;
      for (let x = -R; x <= R; x++) acc += H[y * n + cl(x)];
      for (let x = 0; x < n; x++) {
        tmp[y * n + x] = acc / (2 * R + 1);
        acc += H[y * n + cl(x + R + 1)] - H[y * n + cl(x - R)];
      }
    }
    for (let x = 0; x < n; x++) {
      let acc = 0;
      for (let y = -R; y <= R; y++) acc += tmp[cl(y) * n + x];
      for (let y = 0; y < n; y++) {
        blur[y * n + x] = acc / (2 * R + 1);
        acc += tmp[cl(y + R + 1) * n + x] - tmp[cl(y - R) * n + x];
      }
    }
  }
  const nrmAt = (x: number, y: number) => {
    const xl = Math.max(0, x - 1);
    const xr = Math.min(n - 1, x + 1);
    const yu = Math.max(0, y - 1);
    const yd = Math.min(n - 1, y + 1);
    const dX = (H[y * n + xr] - H[y * n + xl]) / ((xr - xl) * texel);
    const dZ = (H[yd * n + x] - H[yu * n + x]) / ((yd - yu) * texel);
    const l = Math.hypot(dX, 1, dZ);
    return [-dX / l, 1 / l, -dZ / l];
  };

  // albedo with baked lighting
  report('Painting the valley', 0.62);
  const VEG = new Float32Array(n * n);
  const albedo = new Uint8ClampedArray(TEX * TEX * 4);
  const granite: Rgb = [178, 172, 162];
  const graniteD: Rgb = [112, 106, 100];
  const soil: Rgb = [150, 128, 100];
  const grass: Rgb = [96, 128, 62];
  const grassL: Rgb = [140, 160, 84];
  const forest: Rgb = [38, 60, 38];
  const forestD: Rgb = [24, 40, 28];
  const sand: Rgb = [182, 168, 138];
  const wet: Rgb = [92, 84, 70];
  const sunC = [1.5, 1.36, 1.14];
  const skyC = [0.34, 0.42, 0.54];
  const V = SITES.valley;
  for (let ty = 0; ty < TEX; ty++) {
    for (let tx = 0; tx < TEX; tx++) {
      const fx = (tx / (TEX - 1)) * (n - 1);
      const fy = (ty / (TEX - 1)) * (n - 1);
      const xi = Math.min(n - 2, fx | 0);
      const yi = Math.min(n - 2, fy | 0);
      const i = yi * n + xi;
      const wx = (fx / (n - 1) - 0.5) * worldSize;
      const wz = (fy / (n - 1) - 0.5) * worldSize;
      const h = hAtW(wx, wz);
      const [nx, ny, nz] = nrmAt(xi, yi);
      const { a, b } = W2A(wx, wz);
      const slope = 1 - ny;
      const cav = Math.max(-1, Math.min(1, (h - blur[i]) / 1.2));
      const fine = simplex(wx * 3.1, wz * 3.1) * 0.5 + 0.5;
      const fine2 = simplex(wx * 9, wz * 9) * 0.5 + 0.5;
      const mid = fbm(wx * 0.22, wz * 0.22, 3) * 0.5 + 0.5;
      const joint = Math.abs(Math.sin(h * 2.3 + fbm(wx * 0.3, wz * 0.3, 2) * 3));
      const streak = simplex(wx * 1.5 + h * 0.2, wz * 1.5) * 0.5 + 0.5;
      let c = mixc(granite, graniteD, sstep(0.4, 1, streak) * 0.7 + sstep(0.85, 1, joint) * 0.4);
      const gentle = sstep(0.62, 0.32, slope);
      const lowGrass = sstep(0.25, 0.04, slope) * sstep(14, 2, h);
      let veg = gentle * (0.55 + 0.45 * sstep(0.2, -0.7, cav)) + (mid - 0.5) * 0.5 + (fine - 0.5) * 0.35 - sstep(16, 26, h) * 0.6;
      veg = sstep(0.3, 0.7, veg);
      const fcol = mixc(forest, forestD, fine2);
      const gcol = mixc(grass, grassL, mid);
      let ground = mixc(soil, gcol, lowGrass * 0.9);
      ground = mixc(ground, fcol, veg * (1 - lowGrass * 0.6));
      c = mixc(c, ground, gentle * 0.85 + veg * 0.3);
      const dp = Math.hypot(a - V.a, b - V.b);
      c = mixc(c, mixc(grass, grassL, fine), 0.6 * (1 - sstep(V.r * 0.6, V.r + 0.8, dp)));
      if (h < 0.6) c = mixc(c, mixc(sand, wet, sstep(0.6, -0.4, h)), sstep(0.6, 0.1, h));
      VEG[i] = 0;
      if (h > 0.5) VEG[i] = veg * gentle;
      const ndl = Math.max(0, nx * sun.x + ny * sun.y + nz * sun.z);
      const sh = shadow[i];
      const ao = 0.5 + 0.5 * sstep(-1, 0.4, cav);
      const o = (ty * TEX + tx) * 4;
      for (let k = 0; k < 3; k++) {
        const lit = (c[k] / 255) * (skyC[k] * ao * (0.6 + 0.4 * ny) + sunC[k] * ndl * sh) * (0.93 + 0.14 * fine2);
        albedo[o + k] = Math.min(255, Math.pow(lit, 1 / 1.06) * 255);
      }
      albedo[o + 3] = 255;
    }
    if (ty % 64 === 0) report('Painting the valley', 0.62 + (ty / TEX) * 0.3);
  }

  // instanced pines
  report('Planting the forest', 0.93);
  const treeMatrices = new Float32Array(profile.trees * 16);
  const treeHsl = new Float32Array(profile.trees * 3);
  let seed = 5;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let placed = 0;
  const sites = [SITES.ledge, SITES.valley, SITES.lake];
  for (let tries = 0; tries < profile.trees * 25 && placed < profile.trees; tries++) {
    const a = -40 + rnd() * 90;
    const b = -30 + rnd() * 80;
    const w = A2W(a, b);
    const tx = (w.x / worldSize + 0.5) * (n - 1);
    const ty = (w.z / worldSize + 0.5) * (n - 1);
    if (tx < 2 || ty < 2 || tx > n - 3 || ty > n - 3) continue;
    const i = (ty | 0) * n + (tx | 0);
    const [, ny] = nrmAt(tx | 0, ty | 0);
    if (VEG[i] < 0.35 + rnd() * 0.5 || ny < 0.55) continue;
    let blocked = false;
    for (const s of sites) {
      let pad = 0.6;
      if (s === V) pad = -0.2;
      if (Math.hypot(a - s.a, b - s.b) < s.r + pad) blocked = true;
    }
    if (blocked || polyDist(a, b, PATH_ALL) < 0.7 || polyDist(a, b, RIVER) < 2) continue;
    const h = hAtW(w.x, w.z);
    if (h < 0.5) continue;
    const s = 0.26 + rnd() * 0.3;
    const yaw = rnd() * 6.28;
    const sy = s * (0.8 + rnd() * 0.5);
    const m = placed * 16;
    const cs = Math.cos(yaw) * s;
    const sn = Math.sin(yaw) * s;
    treeMatrices.set([cs, 0, -sn, 0, 0, sy, 0, 0, sn, 0, cs, 0, w.x, h - 0.05, w.z, 1], m);
    treeHsl.set([0.29 + rnd() * 0.07, 0.22 + rnd() * 0.14, 0.075 + rnd() * 0.06], placed * 3);
    placed++;
  }
  report('Done', 1);
  return {
    n, worldSize, heights: H, siteHeights: hf.siteHeights, tex: TEX, albedo,
    treeCount: placed, treeMatrices, treeHsl,
  };
}
