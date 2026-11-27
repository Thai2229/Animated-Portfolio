import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildSects, hullGap, type Footprint } from '@/scene/architecture';
import type { SiteKey } from '@/terrain/layout';

// minimal 2d-canvas stub so the procedural textures can be built without a DOM
const ctx = new Proxy({}, {
  get: (_t, name) => {
    if (name === 'createLinearGradient' || name === 'createRadialGradient') return () => ({ addColorStop: () => {} });
    return () => {};
  },
  set: () => true,
});
const saved = (globalThis as { document?: unknown }).document;
const keys: SiteKey[] = ['ledge', 'valley', 'lake'];
const MIN_GAP = 0.3;

beforeAll(() => {
  (globalThis as { document?: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
});
afterAll(() => {
  (globalThis as { document?: unknown }).document = saved;
});

describe('separate buildings in a sect never touch', () => {
  it.each(keys)('%s: footprints keep a clear gap', (key) => {
    const fps: Footprint[] = buildSects(() => 0, { ledge: 0, valley: 0, lake: 0 }, true)[key].footprints;
    expect(fps.length).toBeGreaterThan(1);
    const bad: string[] = [];
    for (let i = 0; i < fps.length; i++) {
      for (let j = i + 1; j < fps.length; j++) {
        const g = hullGap(fps[i].hull, fps[j].hull);
        if (g < MIN_GAP) bad.push(`${fps[i].name} / ${fps[j].name}: gap ${g.toFixed(2)}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
