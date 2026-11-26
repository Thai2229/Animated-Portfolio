import { describe, it, expect } from 'vitest';
import { makeRockTextures, tileFbm } from '@/terrain/rock';

const S = 64;
const t = makeRockTextures(S, 3);
const px = (a: Uint8ClampedArray, x: number, y: number, c: number) => a[(y * S + x) * 4 + c];

describe('makeRockTextures', () => {
  it('is deterministic and sized', () => {
    expect(t.rock.length).toBe(S * S * 4);
    expect(makeRockTextures(S, 3).rock).toEqual(t.rock);
  });
  it('tiles: the wrap seam is no rougher than the interior', () => {
    const seam = (a: Uint8ClampedArray, c: number) => {
      let wrap = 0;
      let inner = 0;
      for (let k = 0; k < S; k++) {
        wrap += Math.abs(px(a, S - 1, k, c) - px(a, 0, k, c)) + Math.abs(px(a, k, S - 1, c) - px(a, k, 0, c));
        inner += Math.abs(px(a, 31, k, c) - px(a, 32, k, c)) + Math.abs(px(a, k, 31, c) - px(a, k, 32, c));
      }
      return wrap / inner;
    };
    for (const c of [0, 3]) expect(seam(t.rock, c)).toBeLessThan(2.2);
    for (const c of [0, 1, 2, 3]) expect(seam(t.noise, c)).toBeLessThan(2.2);
  });
  it('has relief, stays warm and never goes black', () => {
    let lo = 255;
    let hi = 0;
    let minLum = 255;
    for (let i = 0; i < S * S; i++) {
      lo = Math.min(lo, t.rock[i * 4 + 3]);
      hi = Math.max(hi, t.rock[i * 4 + 3]);
      minLum = Math.min(minLum, t.rock[i * 4], t.rock[i * 4 + 1], t.rock[i * 4 + 2]);
    }
    expect(hi - lo).toBeGreaterThan(120);
    expect(minLum).toBeGreaterThan(40);
  });
  it('tileFbm stays in [0,1]', () => {
    for (let i = 0; i < 200; i++) {
      const v = tileFbm(i / 200, (i * 7) % 200 / 200, 3, 3, 4, 1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
