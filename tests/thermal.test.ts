import { describe, it, expect } from 'vitest';
import { slump, thermal } from '@/terrain/heightfield';

const spike = (n: number, h: number) => {
  const g = new Float32Array(n * n);
  g[Math.floor(n / 2) * n + Math.floor(n / 2)] = h;
  return g;
};
const sum = (g: Float32Array) => g.reduce((a, b) => a + b, 0);

describe('slump', () => {
  it('conserves mass, stays finite and relaxes a spike to the talus bound', () => {
    const n = 33;
    const g = spike(n, 10);
    const before = sum(g);
    slump(g, n, 1, 1, 400, 0.6);
    expect(Math.abs(sum(g) - before)).toBeLessThan(1e-2);
    let worst = 0;
    for (let y = 1; y < n - 1; y++) {
      for (let x = 1; x < n - 1; x++) {
        const v = g[y * n + x];
        expect(Number.isFinite(v)).toBe(true);
        worst = Math.max(worst, v - g[y * n + x + 1], v - g[(y + 1) * n + x]);
      }
    }
    expect(worst).toBeLessThan(1.05);
    expect(Math.max(...g)).toBeLessThan(10);
  });

  it('leaves ground under the talus angle untouched', () => {
    const n = 16;
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = (i % n) * 0.5;
    const copy = Float32Array.from(g);
    slump(g, n, 1, 1, 20, 0.6);
    expect(Array.from(g)).toEqual(Array.from(copy));
  });
});

describe('thermal (coarse path)', () => {
  it('keeps mass, stays finite and lowers a tall spike at n=512', () => {
    const n = 512;
    const g = spike(n, 40);
    const before = sum(g);
    thermal(g, n, 120, 1, 0.6);
    expect(Math.abs(sum(g) - before)).toBeLessThan(0.5);
    for (let i = 0; i < g.length; i += 97) expect(Number.isFinite(g[i])).toBe(true);
    expect(g.reduce((m, v) => Math.max(m, v), 0)).toBeLessThan(40);
  });
});
