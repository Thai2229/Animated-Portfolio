import { describe, it, expect } from 'vitest';
import { bakeShadows } from '@/terrain/bake';

const N = 129;
const WORLD = 64;
const TEXEL = WORLD / (N - 1);
const norm = (x: number, y: number, z: number) => {
  const l = Math.hypot(x, y, z);
  return { x: x / l, y: y / l, z: z / l };
};
// Sun toward +x, 45 degrees elevation. Texel x maps to world x, texel y to world z.
const SUN = norm(1, 1, 0);
const ELEV = Math.asin(SUN.y);

const flat = () => new Float32Array(N * N);

const withBlock = (h: number) => {
  const heights = flat();
  for (let y = 60; y < 69; y++) {
    for (let x = 60; x < 69; x++) {
      heights[y * N + x] = h;
    }
  }
  return heights;
};

describe('bakeShadows', () => {
  it('returns N*N values in [0, 1]', () => {
    const out = bakeShadows(withBlock(10), N, WORLD, SUN);
    expect(out).toBeInstanceOf(Float32Array);
    expect(out.length).toBe(N * N);
    for (let i = 0; i < out.length; i++) {
      expect(out[i]).toBeGreaterThanOrEqual(0);
      expect(out[i]).toBeLessThanOrEqual(1);
    }
  });

  it('leaves a flat field fully lit', () => {
    const out = bakeShadows(flat(), N, WORLD, SUN);
    for (let i = 0; i < out.length; i++) {
      if (out[i] <= 0.95) {
        throw new Error('shadowed texel ' + i + ' = ' + out[i]);
      }
    }
  });

  it('casts a shadow on the side away from the sun and not on the sun side', () => {
    const out = bakeShadows(withBlock(10), N, WORLD, SUN);
    const row = 64;
    // away from the sun is -x
    expect(out[row * N + 56]).toBeLessThan(0.5);
    expect(out[row * N + 52]).toBeLessThan(0.5);
    // sun side (+x) and lateral sides stay lit
    expect(out[row * N + 75]).toBeGreaterThan(0.9);
    expect(out[row * N + 85]).toBeGreaterThan(0.9);
    expect(out[40 * N + 56]).toBeGreaterThan(0.9);
    expect(out[90 * N + 56]).toBeGreaterThan(0.9);
  });

  it('does not make shadows over-long (regression)', () => {
    const h = 10;
    const out = bakeShadows(withBlock(h), N, WORLD, SUN);
    const maxTexels = ((h / Math.tan(ELEV)) * 1.25) / TEXEL + 2;
    const blockEdge = 60;
    let farthest = 0;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < blockEdge; x++) {
        if (out[y * N + x] < 0.5) {
          farthest = Math.max(farthest, blockEdge - x);
        }
      }
    }
    expect(farthest).toBeGreaterThan(3);
    expect(farthest).toBeLessThanOrEqual(maxTexels);
  });

  it('shortens the shadow for a higher sun', () => {
    const high = norm(1, 3, 0);
    const lowOut = bakeShadows(withBlock(10), N, WORLD, SUN);
    const highOut = bakeShadows(withBlock(10), N, WORLD, high);
    let lowLen = 0;
    let highLen = 0;
    for (let x = 0; x < 60; x++) {
      if (lowOut[64 * N + x] < 0.5) {
        lowLen = Math.max(lowLen, 60 - x);
      }
      if (highOut[64 * N + x] < 0.5) {
        highLen = Math.max(highLen, 60 - x);
      }
    }
    expect(highLen).toBeLessThan(lowLen);
  });
});
