// Where grass grows (shared by the baked ground colour and the blade placement) and the blade scatter itself.
const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export type GrassInput = {
  ny: number; // up component of the ground normal
  h: number; // ground height
  siteK: number; // distance to the nearest sect centre divided by its radius
  pathD: number; // distance to the nearest stone path
};

// 0..1: flat, dry, outside the stone courtyards and off the paths
export function grassAmount({ ny, h, siteK, pathD }: GrassInput) {
  return sstep(0.82, 0.93, ny) * sstep(0.5, 1.1, h) * sstep(0.72, 0.9, siteK) * sstep(0.2, 0.5, pathD);
}

export type GrassScatter = { count: number; pos: Float32Array; rnd: Float32Array };

type ScatterOpts = { density: number; max: number; seed: number };

// Blades per cell follow the mask; if the total would exceed max it is thinned uniformly.
// rnd = [rank (LOD order), height, colour, yaw]
export function scatterGrass(
  mask: Float32Array,
  n: number,
  worldSize: number,
  heightAt: (x: number, z: number) => number,
  { density, max, seed }: ScatterOpts,
): GrassScatter {
  const texel = worldSize / (n - 1);
  const per = density * texel * texel;
  let total = 0;
  for (let i = 0; i < mask.length; i++) total += mask[i] * per;
  const keep = Math.min(1, (max * 0.97) / Math.max(1, total));
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pos = new Float32Array(max * 3);
  const r = new Float32Array(max * 4);
  let count = 0;
  for (let y = 0; y < n - 1 && count < max; y++) {
    for (let x = 0; x < n - 1 && count < max; x++) {
      const m = mask[y * n + x];
      if (m < 0.05) continue;
      const want = m * per * keep;
      let k = Math.floor(want);
      if (rnd() < want - k) k++;
      for (; k > 0 && count < max; k--) {
        const wx = ((x + rnd()) / (n - 1) - 0.5) * worldSize;
        const wz = ((y + rnd()) / (n - 1) - 0.5) * worldSize;
        pos.set([wx, heightAt(wx, wz), wz], count * 3);
        r.set([rnd(), rnd(), rnd(), rnd()], count * 4);
        count++;
      }
    }
  }
  return { count, pos, rnd: r };
}
