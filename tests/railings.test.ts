import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildSects } from '@/scene/architecture';
import { generateHeightfield } from '@/terrain/heightfield';
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
const OPTS = { n: 192, worldSize: 120, seed: 1234, erosionDroplets: 20000 };
const keys: SiteKey[] = ['ledge', 'valley', 'lake'];
const EPS = 1e-4;
// a post base may be sunk this far into its platform or step, no more
const MAX_SINK = 0.2;

let sects: ReturnType<typeof buildSects>;

beforeAll(() => {
  (globalThis as { document?: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  const hf = generateHeightfield(OPTS);
  sects = buildSects(hf.heightAt, hf.siteHeights, true);
});
afterAll(() => {
  (globalThis as { document?: unknown }).document = saved;
});

describe('railings are attached to the platform or steps they stand on', () => {
  it('the lake sect has zigzag and pavilion railings', () => {
    const names = new Set(sects.lake.rails.map((r) => r.name));
    expect([...names].sort()).toEqual(['pavilion', 'zigzag']);
  });

  it.each(keys)('%s: every rail post stands on a surface and its base is sunk into it', (key) => {
    const bad: string[] = [];
    for (const rail of sects[key].rails) {
      rail.posts.forEach((p, i) => {
        const top = rail.support(p[0], p[2]);
        if (top === null) {
          bad.push(`${rail.name} post ${i}: nothing under it at (${p[0].toFixed(2)}, ${p[2].toFixed(2)})`);
        } else if (p[1] > top + EPS || p[1] < top - MAX_SINK) {
          bad.push(`${rail.name} post ${i}: base ${p[1].toFixed(3)} vs surface ${top.toFixed(3)}`);
        }
      });
    }
    expect(bad).toEqual([]);
  });

  it.each(keys)('%s: each rail run starts and ends on a post that stands on a surface', (key) => {
    for (const rail of sects[key].rails) {
      expect(rail.posts.length, rail.name).toBeGreaterThan(1);
      for (const p of [rail.posts[0], rail.posts[rail.posts.length - 1]]) {
        expect(rail.support(p[0], p[2]), `${rail.name} end post`).not.toBeNull();
      }
    }
  });
});
