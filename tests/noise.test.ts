import { describe, it, expect } from 'vitest';
import { createNoise } from '@/terrain/noise';

const sample = (n: ReturnType<typeof createNoise>) => {
  const out: number[] = [];
  for (let i = 0; i < 20; i++) {
    for (let j = 0; j < 20; j++) {
      const x = i * 0.37 + 0.11;
      const y = j * 0.41 - 3.3;
      out.push(n.simplex2(x, y), n.fbm(x, y, 4), n.ridged(x, y, 4));
    }
  }
  return out;
};

describe('createNoise', () => {
  it('is deterministic for a seed', () => {
    expect(sample(createNoise(7331))).toEqual(sample(createNoise(7331)));
  });

  it('differs for another seed', () => {
    expect(sample(createNoise(1))).not.toEqual(sample(createNoise(2)));
  });

  it('keeps simplex2 within [-1, 1] and finite', () => {
    const n = createNoise(42);
    let min = Infinity;
    let max = -Infinity;
    for (let i = -50; i < 50; i++) {
      for (let j = -50; j < 50; j++) {
        const v = n.simplex2(i * 0.173, j * 0.211);
        expect(Number.isFinite(v)).toBe(true);
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
    expect(min).toBeGreaterThanOrEqual(-1);
    expect(max).toBeLessThanOrEqual(1);
    expect(max - min).toBeGreaterThan(0.5);
  });

  it('returns finite fbm and ridged values', () => {
    const n = createNoise(5);
    for (const v of sample(n)) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});
