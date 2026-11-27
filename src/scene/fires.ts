// Fire bookkeeping (pure: no three.js, no DOM). Shared by the storm strike and click strikes.
import { BURN_DURATION, burn, type Vec3 } from './storm';

export type FiresOpts = { maxFires?: number; burnSeconds?: number };
export type ActiveFire = { treeIndex: number; age: number; burn: number };
export type Fires = {
  ignite: (treeIndex: number, now: number) => boolean;
  step: (dt: number) => ActiveFire[];
  isCharred: (treeIndex: number) => boolean;
};
export type ClickIgnitionOpts = { radius?: number; max?: number; now?: number };

export const DEFAULT_MAX_FIRES = 6;
export const CLICK_IGNITE_RADIUS = 1.4;
export const CLICK_IGNITE_MAX = 2;
export const VERTICAL_TOLERANCE = 2;

export function createFires(opts: FiresOpts = {}): Fires {
  const maxFires = opts.maxFires ?? DEFAULT_MAX_FIRES;
  const burnSeconds = opts.burnSeconds ?? BURN_DURATION;
  // own clock, advanced by step(); `now` of ignite is accepted for the caller's convenience but the fire starts at this clock
  let clock = 0;
  const active: { treeIndex: number; start: number }[] = [];
  const charred = new Set<number>();
  const out = () => active.map((f) => ({ treeIndex: f.treeIndex, age: clock - f.start, burn: burn(clock - f.start) }));
  return {
    ignite: (treeIndex, now) => {
      void now;
      if (!Number.isInteger(treeIndex) || treeIndex < 0 || charred.has(treeIndex) || active.some((f) => f.treeIndex === treeIndex) || active.length >= maxFires) return false;
      active.push({ treeIndex, start: clock });
      return true;
    },
    step: (dt) => {
      if (dt > 0) clock += dt;
      for (let i = active.length - 1; i >= 0; i--) {
        if (clock - active[i].start >= burnSeconds) {
          charred.add(active[i].treeIndex);
          active.splice(i, 1);
        }
      }
      return out();
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
    if (fires.ignite(i, opts.now ?? 0)) lit.push(i);
  }
  return lit;
}
