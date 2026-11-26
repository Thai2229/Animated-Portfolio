import { describe, it, expect, beforeAll } from 'vitest';
import { generateHeightfield, polyDist } from '@/terrain/heightfield';
import { slopeGridDeg, prominenceGrid, percentile } from '@/terrain/metrics';
import { A2W, W2A, SITES, LAKE, RIVER, RIDGE, FEEDER, FALL_TOP, FALL_BASE, WATER_Y, streamBed, streamWidth } from '@/terrain/layout';

const OPTS = { n: 192, worldSize: 120, seed: 1234, erosionDroplets: 20000 };
const STEEP_DEG = 60;
// Measured on the original terrain (seed 1234): 44.0% of massif cells steeper than 60 deg (2619 of 5949),
// prominence p99.9 = 7.45, max = 8.65. Targets: at least ~43% fewer steep cells, p99.9 down at least 40%.
const STEEP_FRAC_MAX = 0.25;
const STEEP_FRAC_MIN = 0.02; // some cliffs must remain
const P999_MAX = 4.5;
const PROM_MAX = 6;
const MASSIF_DIST = 18; // design-frame distance from the RIDGE polyline that counts as massif
const FALL_BAND = [[FALL_TOP.a, FALL_TOP.b], [FALL_BASE.a, FALL_BASE.b]] as [number, number][];

type Field = ReturnType<typeof generateHeightfield>;
let hf: Field;
let slope: Float32Array;
let prom: Float32Array;
let massif: number[]; // indices of massif cells outside carved sites, lake, river, stream and fall band

const excluded = (a: number, b: number) => {
  const siteHit = (Object.values(SITES) as { a: number; b: number; r: number }[]).some(
    (s) => Math.hypot(a - s.a, b - s.b) < s.r + 5,
  );
  const lakeHit = Math.hypot(a - LAKE.a, (b - LAKE.b) * 1.2) < LAKE.r + 5;
  return (
    siteHit || lakeHit || polyDist(a, b, RIVER) < 5 || polyDist(a, b, FEEDER) < 9 || polyDist(a, b, FALL_BAND) < 9
  );
};

const at = (a: number, b: number) => {
  const w = A2W(a, b);
  return hf.heightAt(w.x, w.z);
};

describe('natural terrain shape', () => {
  beforeAll(() => {
    hf = generateHeightfield(OPTS);
    slope = slopeGridDeg(hf.heights, hf.n, hf.worldSize);
    prom = prominenceGrid(hf.heights, hf.n, 2);
    massif = [];
    const margin = 3; // keep clear of the prominence border and erosion edge
    for (let y = margin; y < hf.n - margin; y++) {
      for (let x = margin; x < hf.n - margin; x++) {
        const wx = (x / (hf.n - 1) - 0.5) * hf.worldSize;
        const wz = (y / (hf.n - 1) - 0.5) * hf.worldSize;
        const { a, b } = W2A(wx, wz);
        if (polyDist(a, b, RIDGE) < MASSIF_DIST && !excluded(a, b)) massif.push(y * hf.n + x);
      }
    }
  });

  it('measures a sensible massif sample', () => {
    expect(massif.length).toBeGreaterThan(2000);
  });

  it('slope helper reports 45 degrees on a unit ramp and 0 on flat ground', () => {
    const n = 8;
    const ramp = new Float32Array(n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) ramp[y * n + x] = x * 2; // texel = 2 for worldSize 14
    expect(slopeGridDeg(ramp, n, 14)[3 * n + 3]).toBeCloseTo(45, 4);
    expect(slopeGridDeg(new Float32Array(n * n), n, 14)[3 * n + 3]).toBe(0);
  });

  it('prominence helper is 0 on a plane and positive on a spike', () => {
    const n = 9;
    const g = new Float32Array(n * n);
    expect(prominenceGrid(g, n, 2)[4 * n + 4]).toBe(0);
    g[4 * n + 4] = 24;
    expect(prominenceGrid(g, n, 2)[4 * n + 4]).toBeCloseTo(24, 6);
  });

  it('has few near-vertical cells on the massif, but still some cliffs', () => {
    let steep = 0;
    for (const i of massif) if (slope[i] > STEEP_DEG) steep++;
    const frac = steep / massif.length;
    expect(frac).toBeLessThan(STEEP_FRAC_MAX);
    expect(frac).toBeGreaterThan(STEEP_FRAC_MIN);
  });

  it('has no needle spikes: prominence over the 5x5 mean is bounded', () => {
    const vals = massif.map((i) => prom[i]);
    const p999 = percentile(vals, 0.999);
    const max = Math.max(...vals);
    expect(p999).toBeLessThan(P999_MAX);
    expect(max).toBeLessThan(PROM_MAX);
  });

  it('keeps a waterfall drop of at least 12 units', () => {
    expect(at(FALL_TOP.a, FALL_TOP.b) - at(2.2, 17.4)).toBeGreaterThanOrEqual(12);
  });

  it.each(['ledge', 'valley', 'lake'] as const)('keeps the %s site flat', (key) => {
    const s = SITES[key];
    let min = Infinity;
    let max = -Infinity;
    for (let k = 0; k < 16; k++) {
      for (const f of [0, 0.3, 0.6]) {
        const ang = (k / 16) * Math.PI * 2;
        const h = at(s.a + Math.cos(ang) * s.r * f, s.b + Math.sin(ang) * s.r * f);
        min = Math.min(min, h);
        max = Math.max(max, h);
      }
    }
    expect(max - min).toBeLessThan(0.35);
  });

  it('keeps the stream channel below its banks and the lake below the water line', () => {
    const target = 6;
    let run = 0;
    let found = false;
    for (let i = 0; i < FEEDER.length - 1 && !found; i++) {
      const len = Math.hypot(FEEDER[i + 1][0] - FEEDER[i][0], FEEDER[i + 1][1] - FEEDER[i][1]);
      if (run + len >= target) {
        const t = (target - run) / len;
        const a = FEEDER[i][0] + (FEEDER[i + 1][0] - FEEDER[i][0]) * t;
        const b = FEEDER[i][1] + (FEEDER[i + 1][1] - FEEDER[i][1]) * t;
        const centre = at(a, b);
        expect(centre).toBeLessThanOrEqual(streamBed(target) + 0.3);
        const side = [at(a, b + streamWidth(target) / 2 + 2.6), at(a + streamWidth(target) / 2 + 2.6, b)];
        expect(Math.max(...side)).toBeGreaterThan(centre + 0.3);
        found = true;
      }
      run += len;
    }
    expect(found).toBe(true);
    expect(at(LAKE.a, LAKE.b)).toBeLessThan(WATER_Y - 0.5);
  });
});
