// Fire bookkeeping (pure: no three.js, no DOM). Shared by the storm strike and click strikes.
import { BURN_DURATION, burn, type Vec3 } from './storm';

export type FiresOpts = { maxFires?: number; burnSeconds?: number };
export type ActiveFire = { treeIndex: number; age: number; burn: number };
export type Fires = {
  ignite: (treeIndex: number) => boolean;
  step: (dt: number) => ActiveFire[];
  isCharred: (treeIndex: number) => boolean;
};
export type ClickIgnitionOpts = { radius?: number; max?: number };

export const DEFAULT_MAX_FIRES = 6;
export const CLICK_IGNITE_RADIUS = 1.4;
export const CLICK_IGNITE_MAX = 2;
export const VERTICAL_TOLERANCE = 2;

export function createFires(opts: FiresOpts = {}): Fires {
  const maxFires = opts.maxFires ?? DEFAULT_MAX_FIRES;
  const burnSeconds = opts.burnSeconds ?? BURN_DURATION;
  // own clock, advanced by step(); a fire starts at the clock when it is lit
  let clock = 0;
  const trees: number[] = [];
  const starts: number[] = [];
  const charred = new Set<number>();
  // step() hands out the same array and objects every call, so the frame loop allocates nothing; copy what you keep
  const out: ActiveFire[] = [];
  return {
    ignite: (treeIndex) => {
      if (!Number.isInteger(treeIndex) || treeIndex < 0 || charred.has(treeIndex) || trees.length >= maxFires) return false;
      for (let i = 0; i < trees.length; i++) {
        if (trees[i] === treeIndex) return false;
      }
      trees.push(treeIndex);
      starts.push(clock);
      return true;
    },
    step: (dt) => {
      if (dt > 0) clock += dt;
      let n = 0;
      for (let i = 0; i < trees.length; i++) {
        const age = clock - starts[i];
        if (age >= burnSeconds) {
          charred.add(trees[i]);
          continue;
        }
        trees[n] = trees[i];
        starts[n] = starts[i];
        n++;
      }
      trees.length = n;
      starts.length = n;
      while (out.length < n) out.push({ treeIndex: 0, age: 0, burn: 0 });
      out.length = n;
      for (let i = 0; i < n; i++) {
        out[i].treeIndex = trees[i];
        out[i].age = clock - starts[i];
        out[i].burn = burn(out[i].age);
      }
      return out;
    },
    isCharred: (treeIndex) => charred.has(treeIndex),
  };
}

// trees (x, y, z triples) within `radius` of the point in XZ and within VERTICAL_TOLERANCE in y, nearest first, at most `max`
export function pickTreesNear(
  point: Vec3,
  positions: Float32Array | number[],
  radius: number,
  max: number,
): number[] {
  const hits: { i: number; d: number }[] = [];
  for (let i = 0; i * 3 + 2 < positions.length; i++) {
    const d = Math.hypot(positions[i * 3] - point.x, positions[i * 3 + 2] - point.z);
    if (d <= radius && Math.abs(positions[i * 3 + 1] - point.y) <= VERTICAL_TOLERANCE) hits.push({ i, d });
  }
  hits.sort((a, b) => a.d - b.d || a.i - b.i);
  return hits.slice(0, Math.max(0, max)).map((h) => h.i);
}

// ignites up to `max` of the nearest trees that are free to burn (not burning, not charred, a fire slot available)
export function clickIgnition(
  point: Vec3,
  positions: Float32Array | number[],
  fires: Fires,
  opts: ClickIgnitionOpts = {},
): number[] {
  const max = opts.max ?? CLICK_IGNITE_MAX;
  const lit: number[] = [];
  for (const i of pickTreesNear(point, positions, opts.radius ?? CLICK_IGNITE_RADIUS, positions.length)) {
    if (lit.length >= max) break;
    if (fires.ignite(i)) lit.push(i);
  }
  return lit;
}
