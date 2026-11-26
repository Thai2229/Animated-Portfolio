import { describe, it, expect } from 'vitest';
import { A2W, W2A, WATER_Y, SITES } from '@/terrain/layout';

describe('layout', () => {
  it('W2A inverts A2W', () => {
    for (const [a, b] of [[0, 0], [16, 15.5], [-15, 8], [7.8, -6.5], [-40, 50]]) {
      const w = A2W(a, b);
      const back = W2A(w.x, w.z);
      expect(Math.abs(back.a - a)).toBeLessThan(1e-9);
      expect(Math.abs(back.b - b)).toBeLessThan(1e-9);
    }
  });

  it('A2W inverts W2A', () => {
    for (const [x, z] of [[0, 0], [4, 6], [-30, 22.5], [55, -12]]) {
      const p = W2A(x, z);
      const back = A2W(p.a, p.b);
      expect(Math.abs(back.x - x)).toBeLessThan(1e-9);
      expect(Math.abs(back.z - z)).toBeLessThan(1e-9);
    }
  });

  it('matches the mock frame (look target C = {4, 6})', () => {
    const w = A2W(0, 0);
    expect(w.x).toBeCloseTo(4, 9);
    expect(w.z).toBeCloseTo(6, 9);
  });

  it('has water at y = 0', () => {
    expect(WATER_Y).toBe(0);
  });

  it('defines the three sites with a, b, r', () => {
    expect(Object.keys(SITES).sort()).toEqual(['ledge', 'lake', 'valley']);
    for (const s of Object.values(SITES)) {
      expect(Number.isFinite(s.a)).toBe(true);
      expect(Number.isFinite(s.b)).toBe(true);
      expect(s.r).toBeGreaterThan(0);
    }
  });

  it('matches the mock site positions', () => {
    expect(SITES.ledge).toMatchObject({ a: 16, b: 15.5, r: 4.6 });
    expect(SITES.valley).toMatchObject({ a: -15, b: 8, r: 4.8 });
    expect(SITES.lake).toMatchObject({ a: 7.8, b: -6.5, r: 4.6 });
  });
});
