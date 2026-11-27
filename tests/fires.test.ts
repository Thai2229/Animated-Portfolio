import { describe, it, expect } from 'vitest';
import {
  createFires,
  pickTreesNear,
  clickIgnition,
  VERTICAL_TOLERANCE,
} from '@/scene/fires';
import { burn, BURN_DURATION } from '@/scene/storm';

describe('createFires', () => {
  it('ignites a tree and reports it with age 0 and burn 0 at dt 0', () => {
    const f = createFires({});
    expect(f.ignite(3)).toBe(true);
    expect(f.step(0)).toEqual([{ treeIndex: 3, age: 0, burn: 0 }]);
  });

  it('reports age and burn(age) after stepping', () => {
    const f = createFires({});
    f.ignite(1);
    f.step(1);
    const [a] = f.step(2);
    expect(a.treeIndex).toBe(1);
    expect(a.age).toBeCloseTo(3, 9);
    expect(a.burn).toBeCloseTo(burn(3), 9);
    expect(a.burn).toBeGreaterThan(0.5);
  });

  it('refuses a tree that is already burning', () => {
    const f = createFires({});
    expect(f.ignite(2)).toBe(true);
    expect(f.ignite(2)).toBe(false);
    expect(f.step(0)).toHaveLength(1);
  });

  it('uses BURN_DURATION by default and then marks the tree charred', () => {
    const f = createFires({});
    f.ignite(4);
    expect(f.isCharred(4)).toBe(false);
    f.step(BURN_DURATION - 0.5);
    expect(f.step(0)).toHaveLength(1);
    expect(f.isCharred(4)).toBe(false);
    expect(f.step(0.5)).toEqual([]);
    expect(f.isCharred(4)).toBe(true);
  });

  it('honours a custom burnSeconds', () => {
    const f = createFires({ burnSeconds: 2 });
    f.ignite(0);
    expect(f.step(1.9)).toHaveLength(1);
    expect(f.step(0.2)).toEqual([]);
    expect(f.isCharred(0)).toBe(true);
  });

  it('does not let a charred tree re-ignite', () => {
    const f = createFires({ burnSeconds: 1 });
    f.ignite(7);
    f.step(1.5);
    expect(f.ignite(7)).toBe(false);
    expect(f.step(0)).toEqual([]);
    expect(f.isCharred(7)).toBe(true);
  });

  it('isCharred is false for untouched and invalid trees', () => {
    const f = createFires({});
    expect(f.isCharred(0)).toBe(false);
    expect(f.isCharred(-1)).toBe(false);
    expect(f.isCharred(NaN)).toBe(false);
  });

  it('allows 6 fires by default and refuses the 7th', () => {
    const f = createFires({});
    for (let i = 0; i < 6; i++) expect(f.ignite(i)).toBe(true);
    expect(f.ignite(6)).toBe(false);
    expect(f.step(0).map((x) => x.treeIndex)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('keeps the oldest fire when full and frees a slot when one ends', () => {
    const f = createFires({ maxFires: 2, burnSeconds: 5 });
    f.ignite(0);
    f.step(3);
    f.ignite(1);
    expect(f.ignite(2)).toBe(false);
    expect(f.step(0).map((x) => x.treeIndex)).toEqual([0, 1]);
    f.step(2.5); // tree 0 ends at age 5
    expect(f.isCharred(0)).toBe(true);
    expect(f.ignite(2)).toBe(true);
    expect(f.step(0).map((x) => x.treeIndex).sort()).toEqual([1, 2]);
  });

  it('refused ignitions do not mark the tree as charred or burning', () => {
    const f = createFires({ maxFires: 1, burnSeconds: 1 });
    f.ignite(0);
    expect(f.ignite(1)).toBe(false);
    f.step(2);
    expect(f.isCharred(1)).toBe(false);
    expect(f.ignite(1)).toBe(true);
  });

  it('refuses invalid indices', () => {
    const f = createFires({});
    for (const bad of [-1, NaN, 1.5, Infinity, -Infinity]) expect(f.ignite(bad)).toBe(false);
    expect(f.step(0)).toEqual([]);
  });

  it('handles dt 0, negative dt and a huge dt', () => {
    const f = createFires({});
    f.ignite(0);
    f.step(1);
    expect(f.step(0)[0].age).toBeCloseTo(1, 9);
    expect(f.step(-5)[0].age).toBeCloseTo(1, 9);
    expect(f.step(1e9)).toEqual([]);
    expect(f.isCharred(0)).toBe(true);
  });

  it('keeps burn within [0, 1] for every active fire', () => {
    const f = createFires({});
    f.ignite(0);
    for (let i = 0; i < 700; i++) {
      for (const a of f.step(0.03)) {
        expect(a.burn).toBeGreaterThanOrEqual(0);
        expect(a.burn).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic and instances are independent', () => {
    const run = () => {
      const f = createFires({ maxFires: 3, burnSeconds: 4 });
      const out: unknown[] = [];
      for (let i = 0; i < 40; i++) {
        f.ignite(i % 7);
        out.push(f.step(0.25).map((x) => ({ ...x })));
      }
      return out;
    };
    expect(run()).toEqual(run());
    const a = createFires({});
    const b = createFires({});
    a.ignite(1);
    expect(b.step(0)).toEqual([]);
    expect(b.ignite(1)).toBe(true);
  });
});

describe('pickTreesNear', () => {
  // x, y, z triples
  const pos = [
    0, 0, 0, // 0
    1, 0, 0, // 1
    0, 0, 2, // 2
    5, 0, 5, // 3
    5.5, 0, 5, // 4
    0.5, 9, 0, // 5: close in XZ but far above
  ];
  const p = { x: 0, y: 0, z: 0 };

  it('returns indices within radius sorted nearest first', () => {
    expect(pickTreesNear(p, pos, 2.5, 10)).toEqual([0, 1, 2]);
    expect(pickTreesNear({ x: 0.8, y: 0, z: 0 }, pos, 2.5, 10)).toEqual([1, 0, 2]);
  });

  it('caps the result at max', () => {
    expect(pickTreesNear(p, pos, 2.5, 2)).toEqual([0, 1]);
    expect(pickTreesNear(p, pos, 2.5, 0)).toEqual([]);
  });

  it('is empty when nothing is in range or the input is empty', () => {
    expect(pickTreesNear({ x: 50, y: 0, z: 50 }, pos, 3, 5)).toEqual([]);
    expect(pickTreesNear(p, [], 3, 5)).toEqual([]);
    expect(pickTreesNear(p, new Float32Array(0), 3, 5)).toEqual([]);
  });

  it('includes a tree exactly on the radius but not beyond', () => {
    expect(pickTreesNear(p, [2, 0, 0], 2, 5)).toEqual([0]);
    expect(pickTreesNear(p, [2.01, 0, 0], 2, 5)).toEqual([]);
  });

  it('uses XZ distance with a small vertical tolerance', () => {
    expect(VERTICAL_TOLERANCE).toBeGreaterThan(0);
    expect(pickTreesNear(p, [0.5, VERTICAL_TOLERANCE * 0.5, 0], 2, 5)).toEqual([0]);
    expect(pickTreesNear(p, [0.5, -VERTICAL_TOLERANCE * 0.5, 0], 2, 5)).toEqual([0]);
    expect(pickTreesNear(p, [0.5, VERTICAL_TOLERANCE * 4, 0], 2, 5)).toEqual([]);
    expect(pickTreesNear(p, pos, 2.5, 10)).not.toContain(5);
  });

  it('works for several clusters', () => {
    expect(pickTreesNear({ x: 5.2, y: 0, z: 5 }, pos, 1, 5)).toEqual([3, 4]);
    expect(pickTreesNear({ x: 5.2, y: 0, z: 5 }, pos, 1, 1)).toEqual([3]);
  });

  it('accepts Float32Array and plain arrays alike', () => {
    expect(pickTreesNear(p, new Float32Array(pos), 2.5, 10)).toEqual(pickTreesNear(p, pos, 2.5, 10));
  });

  it('does not mutate its inputs', () => {
    const arr = [...pos];
    const f32 = new Float32Array(pos);
    const f32copy = new Float32Array(pos);
    const pc = { ...p };
    pickTreesNear(p, arr, 3, 4);
    pickTreesNear(p, f32, 3, 4);
    expect(arr).toEqual(pos);
    expect(f32).toEqual(f32copy);
    expect(p).toEqual(pc);
  });
});

describe('clickIgnition', () => {
  const pos = [
    0, 0, 0, // 0
    0.5, 0, 0, // 1
    1, 0, 0, // 2
    10, 0, 10, // 3
  ];
  const p = { x: 0.1, y: 0, z: 0 };

  it('ignites the 2 nearest trees by default (radius 1.4)', () => {
    const f = createFires({});
    expect(clickIgnition(p, pos, f, {})).toEqual([0, 1]);
    expect(f.step(0).map((x) => x.treeIndex)).toEqual([0, 1]);
  });

  it('honours custom radius and max', () => {
    const f = createFires({});
    expect(clickIgnition(p, pos, f, { radius: 2, max: 3 })).toEqual([0, 1, 2]);
    const g = createFires({});
    expect(clickIgnition(p, pos, g, { radius: 0.3, max: 3 })).toEqual([0]);
  });

  it('returns [] and ignites nothing when no tree is near', () => {
    const f = createFires({});
    expect(clickIgnition({ x: 50, y: 0, z: 50 }, pos, f, {})).toEqual([]);
    expect(f.step(0)).toEqual([]);
  });

  it('skips burning trees and fills with the next nearest', () => {
    const f = createFires({});
    f.ignite(0);
    expect(clickIgnition(p, pos, f, { radius: 2, max: 2 })).toEqual([1, 2]);
  });

  it('skips charred trees', () => {
    const f = createFires({ burnSeconds: 1 });
    f.ignite(0);
    f.step(2);
    expect(clickIgnition(p, pos, f, { radius: 2, max: 2 })).toEqual([1, 2]);
  });

  it('returns [] when every nearby tree is burning or charred', () => {
    const f = createFires({});
    clickIgnition(p, pos, f, { radius: 2, max: 3 });
    expect(clickIgnition(p, pos, f, { radius: 2, max: 3 })).toEqual([]);
  });

  it('honours the fire limit shared with other ignitions (e.g. the storm)', () => {
    const f = createFires({ maxFires: 2 });
    f.ignite(3); // storm strike uses a slot
    expect(clickIgnition(p, pos, f, { radius: 2, max: 3 })).toEqual([0]);
    expect(f.step(0)).toHaveLength(2);
    expect(clickIgnition(p, pos, f, { radius: 2, max: 3 })).toEqual([]);
  });

  it('does not mutate the point or positions', () => {
    const f = createFires({});
    const arr = [...pos];
    const pc = { ...p };
    clickIgnition(p, arr, f, {});
    expect(arr).toEqual(pos);
    expect(p).toEqual(pc);
  });
});
