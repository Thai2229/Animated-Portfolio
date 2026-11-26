// Everything heavy and pure: heightfield, baked shadows, albedo texture and tree placement.
import { createNoise } from './noise';
import { generateHeightfield, makeHeightAt, polyDist, polyNearest } from './heightfield';
import { bakeShadows } from './bake';
import { A2W, W2A, SITES, SUN_DIR, RIVER, PATH_ALL, FEEDER, streamWidth } from './layout';
import { grassAmount, scatterGrass } from './grass';
import { makeRockTextures } from './rock';
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
  rockSize: number;
  rock: Uint8ClampedArray;
  rockNoise: Uint8ClampedArray;
  grassCount: number;
  grassPos: Float32Array;
  grassRnd: Float32Array;
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

  // normal of the box-blurred height: smooth, no gullies
  const nrmBlurAt = (x: number, y: number) => {
    const xl = Math.max(0, x - 1);
    const xr = Math.min(n - 1, x + 1);
    const yu = Math.max(0, y - 1);
    const yd = Math.min(n - 1, y + 1);
    const dX = (blur[y * n + xr] - blur[y * n + xl]) / ((xr - xl) * texel);
    const dZ = (blur[yd * n + x] - blur[yu * n + x]) / ((yd - yu) * texel);
    const l = Math.hypot(dX, 1, dZ);
    return [-dX / l, 1 / l, -dZ / l];
  };

  // distance from the stream's banks (negative inside), so no grass or trees grow in the channel
  const streamGap = (a: number, b: number) => {
    const st = polyNearest(a, b, FEEDER);
    return st.d - streamWidth(st.s) / 2 - 0.8;
  };

  // where grass grows: flat, dry, clear of courtyards and paths (also drives the blades)
  const GRASS = new Float32Array(n * n);
  for (let y = 1; y < n - 1; y++) {
    for (let x = 1; x < n - 1; x++) {
      const i = y * n + x;
      const h = H[i];
      if (h < 0.5) continue;
      const ny = nrmAt(x, y)[1];
      if (ny < 0.82) continue;
      const { a, b } = W2A(((x / (n - 1)) - 0.5) * worldSize, ((y / (n - 1)) - 0.5) * worldSize);
      let siteK = 9;
      for (const k of [SITES.ledge, SITES.valley, SITES.lake]) siteK = Math.min(siteK, Math.hypot(a - k.a, b - k.b) / k.r);
      GRASS[i] = grassAmount({ ny, h, siteK, pathD: Math.min(polyDist(a, b, PATH_ALL), streamGap(a, b)) });
    }
  }
  const grassAt = (fx: number, fy: number) => {
    const xi = Math.min(n - 2, fx | 0);
    const yi = Math.min(n - 2, fy | 0);
    const tx = fx - xi;
    const ty = fy - yi;
    const i = yi * n + xi;
    return GRASS[i] * (1 - tx) * (1 - ty) + GRASS[i + 1] * tx * (1 - ty) + GRASS[i + n] * (1 - tx) * ty + GRASS[i + n + 1] * tx * ty;
  };

  // albedo with baked lighting
  report('Painting the valley', 0.62);
  const VEG = new Float32Array(n * n);
  const albedo = new Uint8ClampedArray(TEX * TEX * 4);
  const granite: Rgb = [178, 172, 162];
  const grassD: Rgb = [70, 104, 44];
  const dirt: Rgb = [120, 98, 70];
  const clover: Rgb = [150, 168, 84];
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
      // steep rock stays one flat colour here: the triplanar rock shader supplies all of its detail
      let c = granite;
      const gentle = sstep(0.62, 0.32, slope);
      const lowGrass = sstep(0.25, 0.04, slope) * sstep(14, 2, h);
      let veg = gentle * (0.55 + 0.45 * sstep(0.2, -0.7, cav)) + (mid - 0.5) * 0.5 + (fine - 0.5) * 0.35 - sstep(16, 26, h) * 0.6;
      veg = sstep(0.3, 0.7, veg);
      veg *= sstep(0.75, 0.45, slope); // noise alone must not tint cliffs: the top-down map stretches it into dark vertical streaks
      const fcol = mixc(forest, forestD, fine2);
      const gcol = mixc(grass, grassL, mid);
      let ground = mixc(soil, gcol, lowGrass * 0.9);
      ground = mixc(ground, fcol, veg * (1 - lowGrass * 0.6));
      c = mixc(c, ground, gentle * 0.85 + veg * 0.3);
      const dp = Math.hypot(a - V.a, b - V.b);
      c = mixc(c, mixc(grass, grassL, fine), 0.6 * (1 - sstep(V.r * 0.6, V.r + 0.8, dp)));
      const gm = grassAt(fx, fy);
      if (gm > 0.01) {
        const blot = simplex(wx * 5.5, wz * 5.5) * 0.5 + 0.5;
        const specks = simplex(wx * 17 + 30, wz * 17) * 0.5 + 0.5;
        const pale = simplex(wx * 13 + 7, wz * 13 - 4) * 0.5 + 0.5;
        let gc = mixc(grassD, grassL, mid * 0.55 + blot * 0.45);
        gc = mixc(gc, dirt, sstep(0.74, 0.92, specks) * 0.7);
        gc = mixc(gc, clover, sstep(0.78, 0.94, pale) * 0.65);
        c = mixc(c, gc, gm * 0.95);
      }
      if (h < 0.6) c = mixc(c, mixc(sand, wet, sstep(0.6, -0.4, h)), sstep(0.6, 0.1, h));
      VEG[i] = 0;
      if (h > 0.5) VEG[i] = veg * gentle;
      // steep rock: no baked shadow or cavity (they smear down the walls as dark stripes), a gully-free normal,
      // and a floor of 0.75 of the fully lit value so the triplanar rock carries the look
      const steep = 1 - sstep(0.6, 0.85, ny);
      const ndlRaw = Math.max(0, nx * sun.x + ny * sun.y + nz * sun.z);
      const bn = nrmBlurAt(xi, yi);
      const ndlSmooth = Math.max(0, bn[0] * sun.x + bn[1] * sun.y + bn[2] * sun.z);
      const ndl = lerp(ndlRaw, ndlSmooth, steep);
      const sh = 1 - (1 - shadow[i]) * (1 - steep);
      const ao = 1 - (0.5 - 0.5 * sstep(-1, 0.4, cav)) * (1 - steep);
      const o = (ty * TEX + tx) * 4;
      for (let k = 0; k < 3; k++) {
        const full = skyC[k] * (0.6 + 0.4 * bn[1]) + sunC[k] * ndlSmooth;
        const L = skyC[k] * ao * (0.6 + 0.4 * ny) + sunC[k] * ndl * sh;
        const lit = (c[k] / 255) * lerp(L, Math.max(L, 0.75 * full), steep) * (1 + gentle * 0.14 * (fine2 - 0.5));
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
    if (blocked || polyDist(a, b, PATH_ALL) < 0.7 || polyDist(a, b, RIVER) < 2 || streamGap(a, b) < 0.4) continue;
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
  // grass blades and the rock textures
  report('Sowing the grass', 0.97);
  const blades = scatterGrass(GRASS, n, worldSize, hAtW, { density: profile.grassDensity, max: profile.grass, seed: 91 });
  const rockTex = makeRockTextures(profile.rock, profile.rockOctaves);
  report('Done', 1);
  return {
    n, worldSize, heights: H, siteHeights: hf.siteHeights, tex: TEX, albedo,
    treeCount: placed, treeMatrices, treeHsl,
    rockSize: rockTex.size, rock: rockTex.rock, rockNoise: rockTex.noise,
    grassCount: blades.count, grassPos: blades.pos, grassRnd: blades.rnd,
  };
}
