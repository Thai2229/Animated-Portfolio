import { describe, it, expect, beforeAll } from 'vitest';
import { generateHeightfield, polyNearest } from '@/terrain/heightfield';
import { A2W, SITES, WATER_Y, FEEDER, streamBed, streamWidth } from '@/terrain/layout';

const OPTS = { n: 192, worldSize: 120, seed: 1234, erosionDroplets: 20000 };

// Design-frame feature positions from the mock (not exported by layout).
const LAKE_CENTRE = { a: -1, b: -9 };
const PLUNGE_POOL = { a: 2.2, b: 17.4 };
const FALL_LIP = { a: 3, b: 21.5 };

type Field = ReturnType<typeof generateHeightfield>;
let hf: Field;

const at = (a: number, b: number) => {
  const w = A2W(a, b);
  return hf.heightAt(w.x, w.z);
};

describe('generateHeightfield', () => {
  beforeAll(() => {
    hf = generateHeightfield(OPTS);
  });

  it('returns n, worldSize and n*n heights without NaN', () => {
    expect(hf.n).toBe(OPTS.n);
    expect(hf.worldSize).toBe(OPTS.worldSize);
    expect(hf.heights).toBeInstanceOf(Float32Array);
    expect(hf.heights.length).toBe(OPTS.n * OPTS.n);
    for (let i = 0; i < hf.heights.length; i++) {
      if (Number.isNaN(hf.heights[i])) {
        throw new Error('NaN at index ' + i);
      }
    }
  });

  it('is deterministic for the same seed', () => {
    const again = generateHeightfield(OPTS);
    expect(Array.from(again.heights)).toEqual(Array.from(hf.heights));
    expect(again.siteHeights).toEqual(hf.siteHeights);
  });

  it('differs for another seed', () => {
    const other = generateHeightfield({ ...OPTS, seed: 99 });
    expect(Array.from(other.heights)).not.toEqual(Array.from(hf.heights));
  });

  it('heightAt matches the grid at texel centres and is bilinear between', () => {
    const texel = OPTS.worldSize / (OPTS.n - 1);
    const ix = 70;
    const iz = 90;
    const x = (ix / (OPTS.n - 1) - 0.5) * OPTS.worldSize;
    const z = (iz / (OPTS.n - 1) - 0.5) * OPTS.worldSize;
    expect(hf.heightAt(x, z)).toBeCloseTo(hf.heights[iz * OPTS.n + ix], 4);
    const h0 = hf.heights[iz * OPTS.n + ix];
    const h1 = hf.heights[iz * OPTS.n + ix + 1];
    expect(hf.heightAt(x + texel / 2, z)).toBeCloseTo((h0 + h1) / 2, 4);
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
    expect(hf.siteHeights[key]).toBeGreaterThan(min - 0.35);
    expect(hf.siteHeights[key]).toBeLessThan(max + 0.35);
  });

  it('puts the ledge high on the massif', () => {
    expect(hf.siteHeights.ledge).toBeGreaterThan(hf.siteHeights.valley + 6);
  });

  it('puts the valley site on the valley floor', () => {
    expect(hf.siteHeights.valley).toBeLessThan(4);
  });

  it('puts the lake site on a low tier above the water', () => {
    expect(hf.siteHeights.lake).toBeGreaterThan(3);
    expect(hf.siteHeights.lake).toBeLessThan(6.5);
  });

  it('carves the lake centre below the water line', () => {
    expect(at(LAKE_CENTRE.a, LAKE_CENTRE.b)).toBeLessThan(WATER_Y - 0.5);
  });

  it('carves the plunge pool below the water line', () => {
    expect(at(PLUNGE_POOL.a, PLUNGE_POOL.b)).toBeLessThan(WATER_Y - 0.5);
  });

  it('has a waterfall drop of at least 12 units', () => {
    const drop = at(FALL_LIP.a, FALL_LIP.b) - at(PLUNGE_POOL.a, PLUNGE_POOL.b);
    expect(drop).toBeGreaterThanOrEqual(12);
  });

  it('polyNearest gives distance and arclength along the polyline', () => {
    const r = polyNearest(5, 2, [[0, 0], [10, 0], [10, 10]]);
    expect(r.d).toBeCloseTo(2, 9);
    expect(r.s).toBeCloseTo(5, 9);
    expect(polyNearest(12, 4, [[0, 0], [10, 0], [10, 10]]).s).toBeCloseTo(14, 9);
  });

  it('carves a stream channel down to the lip: bed below the banks, rising upstream', () => {
    // sample along the feeder polyline at 3 and 10 units upstream of the lip
    let run = 0;
    const beds: number[] = [];
    for (const target of [3, 10]) {
      run = 0;
      for (let i = 0; i < FEEDER.length - 1; i++) {
        const len = Math.hypot(FEEDER[i + 1][0] - FEEDER[i][0], FEEDER[i + 1][1] - FEEDER[i][1]);
        if (run + len >= target) {
          const t = (target - run) / len;
          const a = FEEDER[i][0] + (FEEDER[i + 1][0] - FEEDER[i][0]) * t;
          const b = FEEDER[i][1] + (FEEDER[i + 1][1] - FEEDER[i][1]) * t;
          const centre = at(a, b);
          expect(centre).toBeLessThanOrEqual(streamBed(target) + 0.3);
          // wider than the water on either side the land is higher than the bed
          const side = [at(a + 0, b + streamWidth(target) / 2 + 2.6), at(a + streamWidth(target) / 2 + 2.6, b)];
          expect(Math.max(...side)).toBeGreaterThan(centre + 0.3);
          beds.push(centre);
          break;
        }
        run += len;
      }
    }
    expect(beds[1]).toBeGreaterThan(beds[0]);
  });
});
