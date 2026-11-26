// Bakes a soft sun-shadow mask (1 = lit, 0 = shadowed) from a heightfield by marching toward the sun
// with bilinear height lookups and a penumbra term.
const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function bakeShadows(
  heights: Float32Array,
  n: number,
  worldSize: number,
  sun: { x: number; y: number; z: number },
) {
  const texel = worldSize / (n - 1);
  const lh = Math.hypot(sun.x, sun.z);
  const sx = sun.x / lh;
  const sy = sun.z / lh;
  const rise = (sun.y / lh) * texel;
  const maxSteps = Math.ceil(37.5 / texel);
  const out = new Float32Array(n * n);
  const at = (fx: number, fy: number) => {
    const x = Math.min(n - 2, Math.max(0, fx));
    const y = Math.min(n - 2, Math.max(0, fy));
    const xi = x | 0;
    const yi = y | 0;
    const tx = x - xi;
    const ty = y - yi;
    const i = yi * n + xi;
    return (
      heights[i] * (1 - tx) * (1 - ty) + heights[i + 1] * tx * (1 - ty) +
      heights[i + n] * (1 - tx) * ty + heights[i + n + 1] * tx * ty
    );
  };
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const h0 = heights[y * n + x] + 0.03;
      let px = x;
      let py = y;
      let minR = 1;
      for (let s = 1; s < maxSteps; s++) {
        px += sx;
        py += sy;
        if (px < 0 || py < 0 || px >= n - 1 || py >= n - 1 || h0 + rise * s > 40) break;
        const diff = h0 + rise * s - at(px, py);
        minR = Math.min(minR, (diff / (s * texel)) * 6);
        if (minR < -0.2) break;
      }
      out[y * n + x] = sstep(-0.15, 1, minR);
    }
  }
  return out;
}
