import { createNoise } from './noise';
import {
  A2W, W2A, SITES, LAKE, FALL_TOP, FALL_BASE, RIVER, RIDGE, FEEDER, MESAS, streamWidth, streamBed, FALL_SCALE, type Pt,
} from './layout';

export type HeightfieldOptions = {
  n: number;
  worldSize: number;
  seed: number;
  erosionDroplets: number;
  onProgress?: (fraction: number) => void;
};

const HS = 30; // normalisation height used by the erosion pass
const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return { d: Math.hypot(px - ax - t * dx, py - ay - t * dy), t };
}
export function polyDist(px: number, py: number, pts: Pt[]) {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    best = Math.min(best, segDist(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]).d);
  }
  return best;
}

// nearest distance to a polyline plus the arclength from its first point to that nearest point
export function polyNearest(px: number, py: number, pts: Pt[]) {
  let best = 1e9;
  let at = 0;
  let run = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    const sd = segDist(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (sd.d < best) {
      best = sd.d;
      at = run + sd.t * len;
    }
    run += len;
  }
  return { d: best, s: at };
}

// Bilinear height lookup in world coordinates (x, z); clamps to the field.
export function makeHeightAt(heights: Float32Array, n: number, worldSize: number) {
  return (x: number, z: number) => {
    const fx = Math.min(n - 1.000001, Math.max(0, (x / worldSize + 0.5) * (n - 1)));
    const fy = Math.min(n - 1.000001, Math.max(0, (z / worldSize + 0.5) * (n - 1)));
    const xi = Math.floor(fx);
    const yi = Math.floor(fy);
    const tx = fx - xi;
    const ty = fy - yi;
    const i = yi * n + xi;
    return (
      heights[i] * (1 - tx) * (1 - ty) + heights[i + 1] * tx * (1 - ty) +
      heights[i + n] * (1 - tx) * ty + heights[i + n + 1] * tx * ty
    );
  };
}

// Thermal erosion pass over an m x m grid in place: material slides from any cell that stands higher than `talus`
// (rise per world unit) above a neighbour, so needles and walls relax to a scree angle and pile up as concave aprons.
export function slump(C: Float32Array, m: number, spacing: number, talus: number, iters: number, rate: number) {
  const d = new Float32Array(m * m);
  const T = talus * spacing;
  const off = [1, -1, m, -m, m + 1, -m - 1, m - 1, -m + 1];
  const lim = [T, T, T, T, T * Math.SQRT2, T * Math.SQRT2, T * Math.SQRT2, T * Math.SQRT2];
  for (let it = 0; it < iters; it++) {
    d.fill(0);
    for (let y = 1; y < m - 1; y++) {
      for (let x = 1; x < m - 1; x++) {
        const i = y * m + x;
        let tot = 0;
        let big = 0;
        for (let k = 0; k < 8; k++) {
          const df = C[i] - C[i + off[k]] - lim[k];
          if (df > 0) {
            tot += df;
            if (df > big) big = df;
          }
        }
        if (tot <= 0) continue;
        const move = (big * rate) / 2;
        for (let k = 0; k < 8; k++) {
          const df = C[i] - C[i + off[k]] - lim[k];
          if (df > 0) {
            const q = (move * df) / tot;
            d[i] -= q;
            d[i + off[k]] += q;
          }
        }
      }
    }
    for (let i = 0; i < d.length; i++) C[i] += d[i];
  }
}

// Relaxes the macro shape on a block-averaged copy (about 256 cells across, so it stays cheap at any n) and adds the
// change back, then a few full-resolution passes take the fine cliffs and spikes the coarse grid cannot see.
export function thermal(H: Float32Array, n: number, worldSize: number, talus: number, rate: number) {
  const texel = worldSize / (n - 1);
  const f = Math.max(1, Math.round(n / 256));
  if (f > 1) {
    const m = Math.floor(n / f);
    const C = new Float32Array(m * m);
    for (let y = 0; y < m; y++) {
      for (let x = 0; x < m; x++) {
        let acc = 0;
        for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) acc += H[(y * f + j) * n + x * f + i];
        C[y * m + x] = acc / (f * f);
      }
    }
    const before = Float32Array.from(C);
    slump(C, m, texel * f, talus, Math.round(m / 6), rate);
    for (let y = 0; y < n; y++) {
      const fy = Math.min(m - 1.001, Math.max(0, (y + 0.5) / f - 0.5));
      const yi = Math.floor(fy);
      const ty = fy - yi;
      for (let x = 0; x < n; x++) {
        const fx = Math.min(m - 1.001, Math.max(0, (x + 0.5) / f - 0.5));
        const xi = Math.floor(fx);
        const tx = fx - xi;
        const i = yi * m + xi;
        const dd = (j: number) => C[j] - before[j];
        H[y * n + x] +=
          dd(i) * (1 - tx) * (1 - ty) + dd(i + 1) * tx * (1 - ty) + dd(i + m) * (1 - tx) * ty + dd(i + m + 1) * tx * ty;
      }
    }
    slump(H, n, texel, talus, 4, rate);
    return;
  }
  slump(H, n, texel, talus, Math.round(n / 24), rate);
}

export function generateHeightfield(opts: HeightfieldOptions) {
  const { n, worldSize, seed, erosionDroplets, onProgress } = opts;
  const { simplex2: simplex, fbm, ridged } = createNoise(7331 + seed);
  const H = new Float32Array(n * n);
  const wxOf = (x: number) => (x / (n - 1) - 0.5) * worldSize;

  // 1. sculpted base: massif ridge, jagged peaks, mesas, lakeside tier
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const { a, b } = W2A(wxOf(x), wxOf(y));
      let h = 1.2 + fbm(a * 0.05, b * 0.05, 4) * 1.6 + ridged(a * 0.09 + 3, b * 0.09, 5) * 1.6;
      const d = polyDist(a, b, RIDGE) + fbm(a * 0.08 + 7, b * 0.08, 3) * 4;
      const m = sstep(21, 3, d);
      const peaks = 0.55 + 0.6 * ridged(a * 0.06 + 11, b * 0.06 - 4, 4);
      h += Math.pow(m, 1.25) * 30 * peaks + m * ridged(a * 0.25, b * 0.25, 3) * 1.1;
      for (const [ma, mb, mr, mh, sq] of MESAS) {
        const R = mr * 1.4;
        const dm = Math.hypot(a - ma, (b - mb) * sq) + fbm(a * 0.13 + ma, b * 0.13 + mb, 3) * R * 0.45;
        h = Math.max(h, lerp(h, mh + fbm(a * 0.2, b * 0.2, 2) * 0.4, sstep(R + 1.4, R - 0.2, dm)));
      }
      const L = SITES.lake;
      const dq = Math.hypot(a - L.a, (b - L.b) * 1.1) + fbm(a * 0.17 + 5, b * 0.17, 3) * 1.8;
      h = Math.max(h, lerp(h, L.h, sstep(L.r + 2.6, L.r + 0.4, dq)));
      H[y * n + x] = h;
    }
    if (y % 32 === 0) onProgress?.((y / n) * 0.3);
  }

  // 2. hydraulic erosion on a normalised copy (droplets walk in texel units)
  {
    let s = 99 + seed;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < H.length; i++) H[i] /= HS;
    let gh = 0;
    let gx = 0;
    let gy = 0;
    const grad = (px: number, py: number) => {
      const xi = px | 0;
      const yi = py | 0;
      const fx = px - xi;
      const fy = py - yi;
      const i = yi * n + xi;
      const A = H[i];
      const B = H[i + 1];
      const Cc = H[i + n];
      const D = H[i + n + 1];
      gh = A * (1 - fx) * (1 - fy) + B * fx * (1 - fy) + Cc * (1 - fx) * fy + D * fx * fy;
      gx = (B - A) * (1 - fy) + (D - Cc) * fy;
      gy = (Cc - A) * (1 - fx) + (D - B) * fx;
    };
    for (let k = 0; k < erosionDroplets; k++) {
      let px = 1 + rnd() * (n - 3);
      let py = 1 + rnd() * (n - 3);
      let dx = 0;
      let dy = 0;
      let sp = 1;
      let wa = 1;
      let sed = 0;
      for (let st = 0; st < 64; st++) {
        const xi = px | 0;
        const yi = py | 0;
        const fx = px - xi;
        const fy = py - yi;
        const idx = yi * n + xi;
        grad(px, py);
        const h0 = gh;
        dx = dx * 0.05 - gx * 0.95;
        dy = dy * 0.05 - gy * 0.95;
        const l = Math.hypot(dx, dy);
        if (l < 1e-9) break;
        dx /= l;
        dy /= l;
        px += dx;
        py += dy;
        if (px < 2 || py < 2 || px > n - 3 || py > n - 3) break;
        grad(px, py);
        const dh = gh - h0;
        const c = Math.max(-dh * sp * wa * 4, 0.0001);
        if (sed > c || dh > 0) {
          let amt = (sed - c) * 0.3;
          if (dh > 0) amt = Math.min(dh, sed);
          sed -= amt;
          H[idx] += amt * (1 - fx) * (1 - fy);
          H[idx + 1] += amt * fx * (1 - fy);
          H[idx + n] += amt * (1 - fx) * fy;
          H[idx + n + 1] += amt * fx * fy;
        } else {
          const amt = Math.min((c - sed) * 0.3, -dh);
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              let wgt = 0.36;
              if (ox !== 0 || oy !== 0) wgt = 0.08;
              H[idx + oy * n + ox] -= amt * wgt;
            }
          }
          sed += amt;
        }
        sp = Math.sqrt(Math.max(0, sp * sp + dh * 4));
        wa *= 0.988;
      }
      if (k % 20000 === 0) onProgress?.(0.3 + (k / erosionDroplets) * 0.6);
    }
    for (let i = 0; i < H.length; i++) H[i] *= HS;
  }
  // 2a. relax needles and walls to a scree angle, leaving broad shoulders and concave aprons
  thermal(H, n, worldSize, 0.7, 0.6);

  // 2b. terrace the land into stacked plateaus (flat tops, cliff risers)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const h = H[i];
      if (h < 1.5) continue;
      const wx = wxOf(x);
      const wz = wxOf(y);
      const tier = 3.6 + 4.8 * (fbm(wx * 0.035 + 40, wz * 0.035, 2) * 0.5 + 0.5);
      const hn = h + fbm(wx * 0.045, wz * 0.045, 3) * 4.5 + simplex(wx * 0.16, wz * 0.16) * 0.9;
      const k = Math.floor(hn / tier);
      const f = hn / tier - k;
      const sharp = 0.55 + 0.2 * (simplex(wx * 0.07 + 9, wz * 0.07) * 0.5 + 0.5);
      const stepped = (k + sstep(sharp, 0.98, f)) * tier - (hn - h) * 0.35 + fbm(wx * 0.5, wz * 0.5, 2) * 0.2;
      const patch = sstep(-0.35, 0.3, fbm(wx * 0.04 + 20, wz * 0.04 - 7, 3));
      H[i] = lerp(h, stepped, sstep(1.5, 4, h) * (0.2 + 0.4 * patch));
    }
  }
  // cliff bands only where terraces step; anything steeper than the rock can hold slumps
  thermal(H, n, worldSize, 1.0, 0.6);
  // valley site height: mean of the surrounding ground, never below 0.8
  const V = SITES.valley;
  let acc = 0;
  for (let k = 0; k < 24; k++) {
    const ang = (k / 24) * Math.PI * 2;
    const w = A2W(V.a + Math.cos(ang) * (V.r + 3), V.b + Math.sin(ang) * (V.r + 3));
    const tx = Math.floor((w.x / worldSize + 0.5) * (n - 1));
    const ty = Math.floor((w.z / worldSize + 0.5) * (n - 1));
    acc += H[ty * n + tx];
  }
  const valleyH = Math.max(0.8, acc / 24);
  const siteHeights = { ledge: SITES.ledge.h, valley: valleyH, lake: SITES.lake.h };

  // 3. carve features: ledge, valley floor, lakeside tier, waterfall, stream, plunge pool, river, lake
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const { a, b } = W2A(wxOf(x), wxOf(y));
      let h = H[i];
      const E = SITES.ledge;
      const de = Math.hypot(a - E.a, b - E.b);
      if (h > E.h || de < E.r + 1) h = lerp(h, E.h, 1 - sstep(E.r, E.r + 2.2, de));
      const dv = Math.hypot(a - V.a, b - V.b);
      h = lerp(h, valleyH, 1 - sstep(V.r, V.r + 3.5, dv));
      const L = SITES.lake;
      const dl2 = Math.hypot(a - L.a, b - L.b);
      h = lerp(h, L.h, 1 - sstep(L.r, L.r + 2.5, dl2));
      // massif shelf upstream of the lip, so the fall drops from a real cliff whatever the seed
      const df = polyDist(a, b, FEEDER);
      h = Math.max(h, lerp(h, FALL_TOP.h + 3, (1 - sstep(4.5, 9, df)) * sstep(FALL_TOP.b - 2, FALL_TOP.b, b)));
      const sd = segDist(a, b, FALL_TOP.a, FALL_TOP.b, FALL_BASE.a, FALL_BASE.b);
      if (sd.d < 7) {
        const prof = lerp(FALL_TOP.h, FALL_BASE.h, sstep(0.02, 0.22, sd.t));
        h = Math.min(h, lerp(prof, h, sstep(3.6, 7, sd.d)));
      }
      const dl = Math.hypot(a - FALL_TOP.a, b - FALL_TOP.b);
      if (dl < 8 && h > FALL_TOP.h) h = lerp(FALL_TOP.h, h, sstep(2.2, 8, dl));
      // winding stream channel from the massif to the lip, the bed climbing gently upstream
      const st = polyNearest(a, b, FEEDER);
      const half = streamWidth(st.s) / 2 + 0.5;
      if (st.d < half + 1.4) h = Math.min(h, lerp(streamBed(st.s), h, sstep(half - 0.3, half + 1.4, st.d)));
      // the lakeside tier keeps its flat top: later water carving fades out inside it
      const keep = sstep(L.r, L.r + 2.5, dl2);
      // the pool is stretched sideways (along a) to match the wider fall without reaching the lip
      const dp = Math.hypot((a - FALL_BASE.a) / FALL_SCALE, b - FALL_BASE.b) + fbm(a * 0.5, b * 0.5, 2) * 0.6;
      h = lerp(h, Math.min(h, -1.2), (1 - sstep(2.6, 4.2, dp)) * keep);
      const dr = polyDist(a, b, RIVER) + fbm(a * 0.4, b * 0.4, 2) * 0.4;
      h = lerp(h, Math.min(h, -0.8), (1 - sstep(0.9, 2.2, dr)) * keep);
      const dk = Math.hypot(a - LAKE.a, (b - LAKE.b) * 1.2) + fbm(a * 0.2, b * 0.2, 3) * 1.6;
      h = lerp(h, Math.min(h, -1.6), (1 - sstep(LAKE.r - 1.5, LAKE.r + 1.2, dk)) * keep);
      H[i] = h;
    }
  }
  onProgress?.(1);

  return { n, worldSize, heights: H, siteHeights, heightAt: makeHeightAt(H, n, worldSize) };
}

export type Heightfield = ReturnType<typeof generateHeightfield>;
