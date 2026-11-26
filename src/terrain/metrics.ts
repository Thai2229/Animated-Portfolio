// Terrain shape metrics measured on a heightfield grid (used by tests; pure, no side effects).

// Slope angle in degrees per cell, central differences (one-sided at the border).
export function slopeGridDeg(heights: Float32Array, n: number, worldSize: number) {
  const texel = worldSize / (n - 1);
  const out = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(n - 1, x + 1);
      const y0 = Math.max(0, y - 1);
      const y1 = Math.min(n - 1, y + 1);
      const gx = (heights[y * n + x1] - heights[y * n + x0]) / ((x1 - x0) * texel);
      const gy = (heights[y1 * n + x] - heights[y0 * n + x]) / ((y1 - y0) * texel);
      out[y * n + x] = (Math.atan(Math.hypot(gx, gy)) * 180) / Math.PI;
    }
  }
  return out;
}

// Height of each cell above the mean of its (2r+1)^2 neighbourhood (centre excluded); needles give large values.
// Border cells (within r of the edge) are 0.
export function prominenceGrid(heights: Float32Array, n: number, r = 2) {
  const out = new Float32Array(n * n);
  const count = (2 * r + 1) * (2 * r + 1) - 1;
  for (let y = r; y < n - r; y++) {
    for (let x = r; x < n - r; x++) {
      let sum = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx !== 0 || dy !== 0) sum += heights[(y + dy) * n + x + dx];
        }
      }
      out[y * n + x] = heights[y * n + x] - sum / count;
    }
  }
  return out;
}

// q in [0,1]; nearest-rank percentile of a list of values.
export function percentile(values: ArrayLike<number>, q: number) {
  if (values.length === 0) return 0;
  const sorted = Array.from(values).sort((p, q2) => p - q2);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))];
}
