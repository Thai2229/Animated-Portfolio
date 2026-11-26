import { describe, it, expect } from 'vitest';
import {
  createStorm,
  burn,
  boltPath,
  FLASH_CAP,
  MAX_FLASHES_PER_SECOND,
  BURN_DURATION,
  BOLT_MAX_OFFSET,
  type StormState,
  type StormOpts,
} from '@/scene/storm';

const DT = 1 / 30;
const TREES = 40;
const opts = (o: Partial<StormOpts> = {}): StormOpts => ({ treeCount: TREES, ...o });

const run = (seed: number, o: StormOpts, seconds: number) => {
  const storm = createStorm(seed, o);
  const states: { t: number; s: StormState }[] = [];
  const n = Math.round(seconds / DT);
  for (let i = 1; i <= n; i++) {
    const s = storm.step(DT);
    states.push({ t: i * DT, s: { ...s, strike: s.strike && { ...s.strike } } });
  }
  return states;
};

const firstTime = (states: { t: number; s: StormState }[], phase: string) =>
  states.find((x) => x.s.phase === phase)?.t;

describe('createStorm timing', () => {
  it('starts clear with cloud 0, flash 0 and no strike', () => {
    const s = createStorm(1, opts()).step(0);
    expect(s.phase).toBe('clear');
    expect(s.cloud).toBe(0);
    expect(s.flash).toBe(0);
    expect(s.strike).toBeNull();
  });

  it('is reproducible for the same seed', () => {
    const a = run(7, opts(), 300);
    const b = run(7, opts(), 300);
    expect(b).toEqual(a);
  });

  it('differs between seeds', () => {
    const a = run(1, opts(), 300).map((x) => x.s.phase);
    const b = run(2, opts(), 300).map((x) => x.s.phase);
    expect(b).not.toEqual(a);
  });

  it('cycles clear -> gathering -> active -> clearing -> clear in order', () => {
    const states = run(3, opts(), 400);
    const order: string[] = [];
    for (const { s } of states) {
      if (order[order.length - 1] !== s.phase) order.push(s.phase);
    }
    expect(order.slice(0, 5)).toEqual(['clear', 'gathering', 'active', 'clearing', 'clear']);
  });

  it('uses the default 50-90 s gap before the first storm', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const t = firstTime(run(seed, opts(), 200), 'gathering');
      expect(t).toBeGreaterThanOrEqual(50 - DT);
      expect(t).toBeLessThanOrEqual(90 + DT);
    }
  });

  it('honours a configured gap range', () => {
    for (const seed of [1, 2, 3, 4]) {
      const t = firstTime(run(seed, opts({ gapMin: 10, gapMax: 20 }), 100), 'gathering');
      expect(t).toBeGreaterThanOrEqual(10 - DT);
      expect(t).toBeLessThanOrEqual(20 + DT);
    }
  });

  it('phase durations are about 8 s gathering, 25 s active, 8 s clearing', () => {
    const states = run(5, opts({ gapMin: 10, gapMax: 10 }), 120);
    const g = firstTime(states, 'gathering')!;
    const a = firstTime(states, 'active')!;
    const c = firstTime(states, 'clearing')!;
    const k = states.find((x) => x.t > c && x.s.phase === 'clear')!.t;
    expect(g).toBeCloseTo(10, 0);
    expect(a - g).toBeGreaterThan(6);
    expect(a - g).toBeLessThan(10);
    expect(c - a).toBeGreaterThan(20);
    expect(c - a).toBeLessThan(30);
    expect(k - c).toBeGreaterThan(6);
    expect(k - c).toBeLessThan(10);
  });

  it('cloud stays in [0,1], is 0 when clear, rises while gathering, peaks while active, falls while clearing', () => {
    const states = run(5, opts({ gapMin: 10, gapMax: 10 }), 120);
    for (const { s } of states) {
      expect(s.cloud).toBeGreaterThanOrEqual(0);
      expect(s.cloud).toBeLessThanOrEqual(1);
      if (s.phase === 'clear') expect(s.cloud).toBe(0);
    }
    const of = (p: string) => states.filter((x) => x.s.phase === p).map((x) => x.s.cloud);
    const g = of('gathering');
    expect(g[g.length - 1]).toBeGreaterThan(g[0]);
    expect(Math.max(...of('active'))).toBeCloseTo(1, 1);
    const c = of('clearing');
    expect(c[c.length - 1]).toBeLessThan(c[0]);
  });

  it('handles large dt without skipping into an invalid state', () => {
    const storm = createStorm(1, opts());
    for (let i = 0; i < 200; i++) {
      const s = storm.step(5);
      expect(['clear', 'gathering', 'active', 'clearing']).toContain(s.phase);
      expect(s.cloud).toBeGreaterThanOrEqual(0);
      expect(s.cloud).toBeLessThanOrEqual(1);
    }
  });
});

describe('strike', () => {
  it('is null outside the active phase until the strike, and age is never negative', () => {
    const states = run(4, opts({ gapMin: 10, gapMax: 10 }), 120);
    for (const { s } of states) {
      if (s.phase === 'clear' || s.phase === 'gathering') expect(s.strike).toBeNull();
      if (s.strike) expect(s.strike.age).toBeGreaterThanOrEqual(0);
    }
  });

  it('happens during the active phase with a valid integer tree index', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const states = run(seed, opts({ gapMin: 5, gapMax: 5 }), 60);
      const struck = states.filter((x) => x.s.strike);
      expect(struck.length).toBeGreaterThan(0);
      expect(struck[0].s.phase).toBe('active');
      for (const { s } of struck) {
        const i = s.strike!.treeIndex;
        expect(Number.isInteger(i)).toBe(true);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(TREES);
      }
    }
  });

  it('strikes only once per storm: same tree throughout, age grows with time', () => {
    const states = run(9, opts({ gapMin: 5, gapMax: 5 }), 42).filter((x) => x.s.strike);
    const idx = new Set(states.map((x) => x.s.strike!.treeIndex));
    expect(idx.size).toBe(1);
    for (let i = 1; i < states.length; i++) {
      const d = states[i].s.strike!.age - states[i - 1].s.strike!.age;
      expect(d).toBeCloseTo(DT, 5);
    }
  });

  it('picks a new strike in the next storm (age restarts near 0)', () => {
    const states = run(11, opts({ gapMin: 5, gapMax: 5 }), 200);
    const firstOfStorm = states.filter((x, i) => {
      const prev = states[i - 1]?.s.strike;
      return x.s.strike && (!prev || x.s.strike.age < prev.age);
    });
    expect(firstOfStorm.length).toBeGreaterThanOrEqual(2);
    for (const { s } of firstOfStorm) expect(s.strike!.age).toBeLessThan(1);
  });

  it('works with a single tree and never strikes with zero trees', () => {
    const one = run(1, opts({ treeCount: 1, gapMin: 5, gapMax: 5 }), 60).filter((x) => x.s.strike);
    expect(one.length).toBeGreaterThan(0);
    for (const { s } of one) expect(s.strike!.treeIndex).toBe(0);
    const none = run(1, opts({ treeCount: 0, gapMin: 5, gapMax: 5 }), 60);
    for (const { s } of none) expect(s.strike).toBeNull();
  });

  it('keeps the strike (burning tree) available while the clouds clear', () => {
    const states = run(2, opts({ gapMin: 5, gapMax: 5 }), 60);
    const clearing = states.filter((x) => x.s.phase === 'clearing');
    expect(clearing.length).toBeGreaterThan(0);
    expect(clearing[0].s.strike).not.toBeNull();
  });
});

describe('burn(age)', () => {
  it('is 0 at age 0 and for negative age', () => {
    expect(burn(0)).toBe(0);
    expect(burn(-5)).toBe(0);
  });

  it('rises fast: more than 0.8 within 2 s', () => {
    expect(burn(2)).toBeGreaterThan(0.8);
  });

  it('holds near 1 mid-burn', () => {
    expect(burn(8)).toBeCloseTo(1, 1);
    expect(burn(10)).toBeGreaterThan(0.9);
  });

  it('fades to a charred state around BURN_DURATION and stays there', () => {
    expect(BURN_DURATION).toBeCloseTo(20, 0);
    expect(burn(BURN_DURATION)).toBeLessThan(0.1);
    expect(burn(BURN_DURATION + 100)).toBe(0);
  });

  it('is never negative or above 1, and never rises after the peak (fine sweep)', () => {
    let prev = 0;
    let peaked = false;
    for (let a = -2; a <= 60; a += 0.05) {
      const b = burn(a);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
      if (peaked) expect(b).toBeLessThanOrEqual(prev + 1e-9);
      if (b >= 0.99) peaked = true;
      prev = b;
    }
    expect(peaked).toBe(true);
  });

  it.each([NaN, Infinity, 1e9])('stays finite and in [0,1] for odd input %s', (v) => {
    const b = burn(v);
    expect(Number.isFinite(b)).toBe(true);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThanOrEqual(1);
  });
});

describe('flash', () => {
  const countFlashes = (states: { t: number; s: StormState }[]) => {
    const edges: number[] = [];
    let on = false;
    for (const { t, s } of states) {
      const now = s.flash > 0.05;
      if (now && !on) edges.push(t);
      on = now;
    }
    return edges;
  };

  it('has a modest cap', () => {
    expect(FLASH_CAP).toBeGreaterThan(0);
    expect(FLASH_CAP).toBeLessThanOrEqual(0.7);
    expect(MAX_FLASHES_PER_SECOND).toBeLessThanOrEqual(3);
  });

  it('never exceeds the cap and is always in [0, cap]', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const { s } of run(seed, opts({ gapMin: 5, gapMax: 5 }), 300)) {
        expect(s.flash).toBeGreaterThanOrEqual(0);
        expect(s.flash).toBeLessThanOrEqual(FLASH_CAP + 1e-9);
      }
    }
  });

  it('is 0 outside the active phase', () => {
    for (const seed of [1, 2, 3]) {
      for (const { s } of run(seed, opts({ gapMin: 5, gapMax: 5 }), 300)) {
        if (s.phase !== 'active') expect(s.flash).toBe(0);
      }
    }
  });

  it('flashes at least once per storm', () => {
    const states = run(6, opts({ gapMin: 5, gapMax: 5 }), 45);
    expect(countFlashes(states).length).toBeGreaterThanOrEqual(1);
  });

  it('never has more than 3 flashes in any 1 s window', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const edges = countFlashes(run(seed, opts({ gapMin: 5, gapMax: 5 }), 400));
      for (let i = 0; i + MAX_FLASHES_PER_SECOND < edges.length; i++) {
        expect(edges[i + MAX_FLASHES_PER_SECOND] - edges[i]).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('stays within limits at a coarse and a fine timestep', () => {
    for (const dt of [1 / 120, 0.25]) {
      const storm = createStorm(3, opts({ gapMin: 5, gapMax: 5 }));
      for (let i = 0; i < 300 / dt; i++) {
        const s = storm.step(dt);
        expect(s.flash).toBeLessThanOrEqual(FLASH_CAP + 1e-9);
        expect(s.flash).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('disabled (reduced motion)', () => {
  it('stays clear with cloud 0, no flash and no strike forever', () => {
    const states = run(1, opts({ enabled: false, gapMin: 1, gapMax: 1 }), 400);
    for (const { s } of states) {
      expect(s.phase).toBe('clear');
      expect(s.cloud).toBe(0);
      expect(s.flash).toBe(0);
      expect(s.strike).toBeNull();
    }
  });
});

describe('boltPath', () => {
  const from = { x: 0, y: 30, z: 0 };
  const to = { x: 10, y: 2, z: -6 };

  it('starts at from and ends at to, with segments+1 points', () => {
    const p = boltPath(1, from, to, 12);
    expect(p).toHaveLength(13);
    expect(p[0]).toEqual(from);
    expect(p[p.length - 1]).toEqual(to);
  });

  it('is deterministic per seed and differs across seeds', () => {
    expect(boltPath(5, from, to, 12)).toEqual(boltPath(5, from, to, 12));
    expect(boltPath(6, from, to, 12)).not.toEqual(boltPath(5, from, to, 12));
  });

  it('is jagged: interior points leave the straight line', () => {
    const p = boltPath(2, from, to, 12);
    const dir = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const len = Math.hypot(dir.x, dir.y, dir.z);
    const off = p.slice(1, -1).map((q) => {
      const v = { x: q.x - from.x, y: q.y - from.y, z: q.z - from.z };
      const t = (v.x * dir.x + v.y * dir.y + v.z * dir.z) / (len * len);
      return Math.hypot(v.x - dir.x * t, v.y - dir.y * t, v.z - dir.z * t);
    });
    expect(Math.max(...off)).toBeGreaterThan(0.05);
  });

  it('keeps lateral offset within BOLT_MAX_OFFSET for many seeds', () => {
    const dir = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const len = Math.hypot(dir.x, dir.y, dir.z);
    for (let seed = 0; seed < 50; seed++) {
      for (const q of boltPath(seed, from, to, 16)) {
        const v = { x: q.x - from.x, y: q.y - from.y, z: q.z - from.z };
        const t = (v.x * dir.x + v.y * dir.y + v.z * dir.z) / (len * len);
        const d = Math.hypot(v.x - dir.x * t, v.y - dir.y * t, v.z - dir.z * t);
        expect(d).toBeLessThanOrEqual(BOLT_MAX_OFFSET + 1e-9);
      }
    }
  });

  it('all coordinates are finite; one segment is just from -> to', () => {
    for (const q of boltPath(3, from, to, 20)) {
      expect(Number.isFinite(q.x + q.y + q.z)).toBe(true);
    }
    expect(boltPath(3, from, to, 1)).toEqual([from, to]);
  });

  it('rejects invalid segment counts', () => {
    expect(() => boltPath(1, from, to, 0)).toThrow();
    expect(() => boltPath(1, from, to, -3)).toThrow();
    expect(() => boltPath(1, from, to, 2.5)).toThrow();
  });
});
