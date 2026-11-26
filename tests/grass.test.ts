import { describe, it, expect } from 'vitest';
import { grassAmount, scatterGrass } from '@/terrain/grass';

const ok = { ny: 1, h: 3, siteK: 2, pathD: 5 };

describe('grassAmount', () => {
  it('grows on flat dry open ground', () => expect(grassAmount(ok)).toBe(1));
  it('not on cliffs, under water, in courtyards or on paths', () => {
    expect(grassAmount({ ...ok, ny: 0.6 })).toBe(0);
    expect(grassAmount({ ...ok, h: 0.1 })).toBe(0);
    expect(grassAmount({ ...ok, siteK: 0.5 })).toBe(0);
    expect(grassAmount({ ...ok, pathD: 0.2 })).toBe(0);
  });
  it('fades softly at the edges', () => {
    const m = grassAmount({ ...ok, ny: 0.88 });
    expect(m).toBeGreaterThan(0);
    expect(m).toBeLessThan(1);
  });
});

describe('scatterGrass', () => {
  const N = 33;
  const W = 32;
  const mask = new Float32Array(N * N);
  for (let y = 8; y < 16; y++) for (let x = 8; x < 16; x++) mask[y * N + x] = 1;
  const hAt = (x: number, z: number) => x * 0.1 + z * 0.01;
  const g = scatterGrass(mask, N, W, hAt, { density: 50, max: 100000, seed: 3 });
  it('places blades only where the mask is set, on the ground', () => {
    expect(g.count).toBeGreaterThan(1000);
    for (let i = 0; i < g.count; i++) {
      const tx = (g.pos[i * 3] / W + 0.5) * (N - 1);
      const ty = (g.pos[i * 3 + 2] / W + 0.5) * (N - 1);
      expect(tx).toBeGreaterThanOrEqual(8);
      expect(tx).toBeLessThan(16);
      expect(ty).toBeGreaterThanOrEqual(8);
      expect(ty).toBeLessThan(16);
      expect(g.pos[i * 3 + 1]).toBeCloseTo(hAt(g.pos[i * 3], g.pos[i * 3 + 2]), 5);
    }
  });
  it('density matches and max thins uniformly', () => {
    expect(g.count / (8 * 8 * (W / (N - 1)) ** 2)).toBeGreaterThan(40);
    const t = scatterGrass(mask, N, W, hAt, { density: 50, max: 500, seed: 3 });
    expect(t.count).toBeLessThanOrEqual(500);
    expect(t.count).toBeGreaterThan(300);
  });
  it('is deterministic', () => {
    const again = scatterGrass(mask, N, W, hAt, { density: 50, max: 100000, seed: 3 });
    expect(again.count).toBe(g.count);
    expect(again.pos.slice(0, 30)).toEqual(g.pos.slice(0, 30));
  });
});
