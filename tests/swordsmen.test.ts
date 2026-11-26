import { describe, it, expect, beforeAll } from 'vitest';
import {
  createFlyers, stepFlyer, SPEED_MIN, SPEED_MAX, MAX_BANK,
  type Bounds, type Cylinder, type Flyer, type FlyerOptions,
} from '@/scene/swordsmen';

const bounds: Bounds = { minX: -60, maxX: 60, minZ: -60, maxZ: 60, maxY: 60 };
// a massif ridge rising to the north plus a valley floor, sampled analytically
const heightAt = (x: number, z: number) => Math.max(0, 30 * Math.exp(-((z - 30) * (z - 30)) / 300)) + 2 * Math.sin(x * 0.1);
const proxies: Cylinder[] = [
  { x: 10, z: 12, r: 5, top: 20 },
  { x: -20, z: 5, r: 5.3, top: 8 },
  { x: 20, z: -15, r: 5, top: 12 },
];
const clearance = 3;
const margin = 1;
const opts: FlyerOptions = { heightAt, clearance, proxies, margin };
const DT = 0.05;
const TOL = 1e-6;

const sample = (f: Flyer, fn: (t: number) => void) => {
  for (let t = 0; t <= f.period; t += DT) fn(t);
};
const velocity = (f: Flyer, t: number) => {
  const a = f.pathAt(t - DT / 2);
  const b = f.pathAt(t + DT / 2);
  return { x: (b.x - a.x) / DT, y: (b.y - a.y) / DT, z: (b.z - a.z) / DT };
};
const angleDiff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

describe('createFlyers', () => {
  it('returns no flyers for count 0', () => {
    expect(createFlyers(1, 0, bounds, opts)).toEqual([]);
  });

  it('returns exactly count flyers', () => {
    expect(createFlyers(1, 5, bounds, opts)).toHaveLength(5);
  });

  it('is deterministic for a seed and differs for another', () => {
    const a = createFlyers(42, 3, bounds, opts);
    const b = createFlyers(42, 3, bounds, opts);
    const c = createFlyers(43, 3, bounds, opts);
    for (const t of [0, 1.5, 17.25, 100]) {
      expect(a.map((f) => f.pathAt(t))).toEqual(b.map((f) => f.pathAt(t)));
    }
    expect(a.map((f) => f.pathAt(10))).not.toEqual(c.map((f) => f.pathAt(10)));
  });

  it('gives each flyer a distinct path', () => {
    const fl = createFlyers(7, 4, bounds, opts);
    const at = fl.map((f) => f.pathAt(0));
    const keys = new Set(at.map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`));
    expect(keys.size).toBe(4);
  });
});

describe.each([1, 2, 99])('flyer paths (seed %i)', (seed) => {
  let flyers: Flyer[] = [];
  beforeAll(() => {
    flyers = createFlyers(seed, 4, bounds, opts);
  });

  it('has a positive finite period and loops back to its start', () => {
    for (const f of flyers) {
      expect(Number.isFinite(f.period)).toBe(true);
      expect(f.period).toBeGreaterThan(5);
      const a = f.pathAt(0);
      const b = f.pathAt(f.period);
      expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(1e-3);
      const c = f.pathAt(3.7);
      const d = f.pathAt(3.7 + 2 * f.period);
      expect(Math.hypot(c.x - d.x, c.y - d.y, c.z - d.z)).toBeLessThan(1e-3);
    }
  });

  it('stays inside the bounds at all times and has finite values', () => {
    for (const f of flyers) {
      sample(f, (t) => {
        const p = f.pathAt(t);
        for (const v of [p.x, p.y, p.z, p.yaw, p.bank]) expect(Number.isFinite(v)).toBe(true);
        expect(p.x).toBeGreaterThanOrEqual(bounds.minX);
        expect(p.x).toBeLessThanOrEqual(bounds.maxX);
        expect(p.z).toBeGreaterThanOrEqual(bounds.minZ);
        expect(p.z).toBeLessThanOrEqual(bounds.maxZ);
        expect(p.y).toBeLessThanOrEqual(bounds.maxY);
      });
    }
  });

  it('keeps at least `clearance` above the ground at all sampled times', () => {
    for (const f of flyers) {
      sample(f, (t) => {
        const p = f.pathAt(t);
        expect(p.y - heightAt(p.x, p.z)).toBeGreaterThanOrEqual(clearance - TOL);
      });
    }
  });

  it('keeps speed between SPEED_MIN and SPEED_MAX', () => {
    for (const f of flyers) {
      sample(f, (t) => {
        const v = velocity(f, t);
        const s = Math.hypot(v.x, v.y, v.z);
        expect(s).toBeGreaterThanOrEqual(SPEED_MIN - 0.05);
        expect(s).toBeLessThanOrEqual(SPEED_MAX + 0.05);
      });
    }
  });

  it('is smooth: velocity changes gradually and position has no jumps', () => {
    for (const f of flyers) {
      sample(f, (t) => {
        const v0 = velocity(f, t);
        const v1 = velocity(f, t + DT);
        expect(Math.hypot(v1.x - v0.x, v1.y - v0.y, v1.z - v0.z) / DT).toBeLessThan(15);
      });
    }
  });

  it('heading follows velocity: yaw is atan2(vx, vz) within tolerance', () => {
    for (const f of flyers) {
      sample(f, (t) => {
        const v = velocity(f, t);
        if (Math.hypot(v.x, v.z) < 0.5) return;
        expect(angleDiff(f.pathAt(t).yaw, Math.atan2(v.x, v.z))).toBeLessThan(0.08);
      });
    }
  });

  it('bank angle is bounded by MAX_BANK and banks into turns', () => {
    for (const f of flyers) {
      let peak = 0;
      sample(f, (t) => {
        const bank = f.pathAt(t).bank;
        expect(Math.abs(bank)).toBeLessThanOrEqual(MAX_BANK + TOL);
        peak = Math.max(peak, Math.abs(bank));
      });
      // a looping path must turn, so it banks at least a little
      expect(peak).toBeGreaterThan(0.02);
    }
  });

  it('never enters a hit proxy (radius + margin) below its top', () => {
    for (const f of flyers) {
      sample(f, (t) => {
        const p = f.pathAt(t);
        for (const c of proxies) {
          if (p.y >= c.top) continue;
          expect(Math.hypot(p.x - c.x, p.z - c.z)).toBeGreaterThanOrEqual(c.r + margin - TOL);
        }
      });
    }
  });
});

describe('stepFlyer', () => {
  let f: Flyer;
  beforeAll(() => {
    f = createFlyers(5, 1, bounds, opts)[0];
  });

  it('advances time by dt and returns the pose at the new time', () => {
    const s = stepFlyer(f, 2, 0.1);
    expect(s.t).toBeCloseTo(2.1, 9);
    expect(s.pose).toEqual(f.pathAt(s.t));
  });

  it('wraps time at the loop period', () => {
    const s = stepFlyer(f, f.period - 0.05, 0.1);
    expect(s.t).toBeGreaterThanOrEqual(0);
    expect(s.t).toBeLessThan(f.period);
    expect(s.t).toBeCloseTo(0.05, 6);
  });

  it('rejects negative dt', () => {
    expect(() => stepFlyer(f, 1, -0.1)).toThrow();
  });
});
