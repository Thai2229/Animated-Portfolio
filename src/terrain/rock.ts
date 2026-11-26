// Procedural, seamlessly tiling rock textures (albedo + height, and a noise pack), generated once in the worker.
const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function hash(x: number, y: number, s: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// value noise that wraps every px x py lattice cells
function pnoise(x: number, y: number, px: number, py: number, s: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const x0 = ((xi % px) + px) % px;
  const x1 = (x0 + 1) % px;
  const y0 = ((yi % py) + py) % py;
  const y1 = (y0 + 1) % py;
  const a = hash(x0, y0, s);
  const b = hash(x1, y0, s);
  const c = hash(x0, y1, s);
  const d = hash(x1, y1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

// u, v in [0,1); base frequency fx x fy cells per tile, doubling per octave
export function tileFbm(u: number, v: number, fx: number, fy: number, octaves: number, s: number) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const px = fx << o;
    const py = fy << o;
    sum += amp * pnoise(u * px, v * py, px, py, s + o * 17);
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

// wrapped cellular noise: returns nearest and second-nearest distance (cell units) and the nearest cell's random id
function cells(u: number, v: number, cx: number, cy: number, s: number) {
  const px = u * cx;
  const py = v * cy;
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  let f1 = 9;
  let f2 = 9;
  let id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const gx = ix + i;
      const gy = iy + j;
      const wx = ((gx % cx) + cx) % cx;
      const wy = ((gy % cy) + cy) % cy;
      const fx = gx + 0.15 + hash(wx, wy, s) * 0.7;
      const fy = gy + 0.15 + hash(wx, wy, s + 1) * 0.7;
      const d = Math.hypot(fx - px, fy - py);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = hash(wx, wy, s + 2);
      } else if (d < f2) f2 = d;
    }
  }
  return { f1, f2, id };
}

export type RockTextures = { size: number; rock: Uint8ClampedArray; noise: Uint8ClampedArray };

// rock: rgb = albedo (sRGB), a = height. noise: r,g,b = low/mid/fine fbm, a = vertically stretched streak noise.
export function makeRockTextures(size: number, octaves: number, seed = 11): RockTextures {
  const rock = new Uint8ClampedArray(size * size * 4);
  const noise = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      // domain warp keeps the blocks from looking like a grid
      const wu = u + (tileFbm(u, v, 3, 3, 2, seed + 40) - 0.5) * 0.06;
      const wv = v + (tileFbm(u, v, 3, 3, 2, seed + 50) - 0.5) * 0.06;
      const blocks = cells(wu, wv, 4, 8, seed);
      const slabs = cells(wu, wv, 2, 3, seed + 9);
      const edge = blocks.f2 - blocks.f1;
      const big = slabs.f2 - slabs.f1;
      const body = tileFbm(u, v, 4, 4, octaves, seed + 3);
      const grain = tileFbm(u, v, 64, 64, Math.min(2, octaves), seed + 5);
      const ridge = 1 - Math.abs(2 * tileFbm(wu, wv, 3, 6, Math.min(4, octaves), seed + 7) - 1);
      const fissure = sstep(0.955, 0.99, ridge);
      // cracks break up and vary in width instead of outlining every block
      const brk = sstep(0.35, 0.65, tileFbm(u, v, 8, 8, 3, seed + 31));
      const crack = (1 - sstep(0.015, 0.075, edge + (brk - 0.5) * 0.1)) * (0.25 + 0.75 * brk);
      const gap = (1 - sstep(0.015, 0.06, big)) * (0.3 + 0.7 * brk);
      let h = blocks.id * 0.3 + 0.22 * sstep(0, 0.5, edge) + body * 0.38 + grain * 0.1 + slabs.id * 0.14 + 0.08 * sstep(0, 0.4, big);
      h -= crack * 0.2 + gap * 0.18 + fissure * 0.25;
      h = Math.min(1, Math.max(0, h * 1.25 - 0.08));
      // warm tan to cool grey, per-block tint, soft cavity darkening (never black)
      const tone = tileFbm(u, v, 2, 2, 3, seed + 21);
      const tint = (blocks.id - 0.5) * 0.22;
      const r = 150 + 46 * tone + 70 * tint;
      const g = 144 + 38 * tone + 55 * tint;
      const b = 132 + 22 * tone + 40 * tint;
      const grainK = 0.9 + 0.2 * grain;
      const cav = 1 - 0.3 * Math.max(crack * 0.7, gap * 0.6, fissure) - 0.16 * (1 - h);
      const o = (y * size + x) * 4;
      rock[o] = r * grainK * cav;
      rock[o + 1] = g * grainK * cav;
      rock[o + 2] = b * grainK * cav;
      rock[o + 3] = h * 255;
      noise[o] = tileFbm(u, v, 3, 3, octaves, seed + 61) * 255;
      noise[o + 1] = tileFbm(u, v, 6, 6, octaves, seed + 71) * 255;
      noise[o + 2] = tileFbm(u, v, 12, 12, Math.min(3, octaves), seed + 81) * 255;
      noise[o + 3] = tileFbm(u, v, 16, 2, Math.min(4, octaves), seed + 91) * 255;
    }
  }
  return { size, rock, noise };
}
