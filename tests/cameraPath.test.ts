import { describe, it, expect } from 'vitest';
import { flyPose, type Pose } from '@/scene/cameraPath';

const from: Pose = { position: [10, 30, -50], target: [4, 5, 6] };
const to: Pose = { position: [-3, 8, 12], target: [-5, 6, 20] };

const dist = (a: [number, number, number], b: [number, number, number]) => {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
};

describe('flyPose', () => {
  it('returns from at t = 0', () => {
    expect(flyPose(from, to, 0)).toEqual(from);
  });

  it('returns to at t = 1', () => {
    const p = flyPose(from, to, 1);
    for (let i = 0; i < 3; i++) {
      expect(p.position[i]).toBeCloseTo(to.position[i], 9);
      expect(p.target[i]).toBeCloseTo(to.target[i], 9);
    }
  });

  it('clamps t below 0 and above 1', () => {
    expect(flyPose(from, to, -2)).toEqual(flyPose(from, to, 0));
    expect(flyPose(from, to, 7)).toEqual(flyPose(from, to, 1));
  });

  it('never moves away from the destination as t grows', () => {
    let prev = Infinity;
    for (let i = 0; i <= 20; i++) {
      const d = dist(flyPose(from, to, i * 0.05).position, to.position);
      expect(d).toBeLessThanOrEqual(prev + 1e-9);
      prev = d;
    }
  });

  it('is eased, not linear, at the midpoint region', () => {
    const early = dist(flyPose(from, to, 0.1).position, from.position);
    const linear = 0.1 * dist(from.position, to.position);
    expect(early).toBeLessThan(linear);
  });

  it('does not mutate its inputs', () => {
    const f: Pose = { position: [1, 2, 3], target: [4, 5, 6] };
    const t: Pose = { position: [7, 8, 9], target: [1, 1, 1] };
    flyPose(f, t, 0.5);
    expect(f).toEqual({ position: [1, 2, 3], target: [4, 5, 6] });
    expect(t).toEqual({ position: [7, 8, 9], target: [1, 1, 1] });
  });
});
