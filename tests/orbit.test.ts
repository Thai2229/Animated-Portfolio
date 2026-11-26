import { describe, expect, it } from "vitest";
import { PERIOD, position, tangent } from "../src/orbit";

const len = (v: number[]) => Math.hypot(v[0], v[1], v[2]);

describe("orbit", () => {
  it("completes a lap in about 14 seconds", () => {
    expect(PERIOD).toBe(14);
    const a = position(1.3);
    const b = position(1.3 + PERIOD);
    for (let i = 0; i < 3; i++) expect(b[i]).toBeCloseTo(a[i], 9);
  });

  it("passes in front of the sun and behind it", () => {
    let front = 0;
    let back = 0;
    for (let i = 0; i < 140; i++) {
      const z = position(i / 10)[2];
      if (z > 0.5) front++;
      if (z < -0.5) back++;
    }
    expect(front).toBeGreaterThan(30);
    expect(back).toBeGreaterThan(30);
  });

  it("stays on a ellipse of bounded size around the sun", () => {
    for (let i = 0; i < 140; i++) {
      const r = len(position(i / 10));
      expect(r).toBeGreaterThan(2);
      expect(r).toBeLessThan(6);
    }
  });

  it("returns a unit tangent that matches the motion direction", () => {
    for (const t of [0, 2.2, 5, 9.7, 13.9]) {
      const d = tangent(t);
      expect(len(d)).toBeCloseTo(1, 9);
      const a = position(t - 1e-4);
      const b = position(t + 1e-4);
      const fd = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const l = len(fd);
      for (let i = 0; i < 3; i++) expect(fd[i] / l).toBeCloseTo(d[i], 4);
    }
  });
});
