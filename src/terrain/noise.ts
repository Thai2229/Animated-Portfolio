// Seeded 2D simplex noise plus fbm / ridged helpers, ported from the mock.
const GR = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

export function createNoise(seed: number) {
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
  }

  const simplex2 = (x: number, y: number) => {
    const sk = (x + y) * F2;
    const i = Math.floor(x + sk);
    const j = Math.floor(y + sk);
    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const i1 = Number(x0 > y0);
    const j1 = 1 - i1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      const g = GR[perm[ii + perm[jj]] & 7];
      t0 *= t0;
      n += t0 * t0 * (g[0] * x0 + g[1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      const g = GR[perm[ii + i1 + perm[jj + j1]] & 7];
      t1 *= t1;
      n += t1 * t1 * (g[0] * x1 + g[1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      const g = GR[perm[ii + 1 + perm[jj + 1]] & 7];
      t2 *= t2;
      n += t2 * t2 * (g[0] * x2 + g[1] * y2);
    }
    return Math.max(-1, Math.min(1, 70 * n));
  };

  const fbm = (x: number, y: number, o: number) => {
    let sum = 0;
    let a = 0.5;
    let f = 1;
    for (let i = 0; i < o; i++) {
      sum += a * simplex2(x * f, y * f);
      a *= 0.5;
      f *= 2.02;
    }
    return sum;
  };

  const ridged = (x: number, y: number, o: number) => {
    let sum = 0;
    let a = 0.5;
    let f = 1;
    let w = 1;
    for (let i = 0; i < o; i++) {
      let n = 1 - Math.abs(simplex2(x * f, y * f));
      n *= n * w;
      w = Math.min(1, n * 2);
      sum += n * a;
      a *= 0.5;
      f *= 2.03;
    }
    return sum;
  };

  return { simplex2, fbm, ridged };
}

export type Noise = ReturnType<typeof createNoise>;
