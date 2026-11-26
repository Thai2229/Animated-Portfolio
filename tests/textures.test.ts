import { describe, expect, it } from "vitest";
import { earthMaps } from "../src/lib/planetTextures";

describe("planet textures", () => {
  it("wraps without a seam in longitude", () => {
    const w = 256;
    const h = 128;
    const { bump } = earthMaps(w, h);
    const col = (x: number) => (j: number) => bump[(j * w + x) * 4];
    const diff = (a: number, b: number) => {
      let s = 0;
      for (let j = 20; j < h - 20; j++) s += Math.abs(col(a)(j) - col(b)(j));
      return s;
    };
    const seam = diff(w - 1, 0);
    const typical = Math.max(diff(100, 101), 1);
    expect(seam).toBeLessThan(typical * 2 + 50);
  });
});
