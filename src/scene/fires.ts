// Fire bookkeeping (pure: no three.js, no DOM). Shared by the storm strike and click strikes.
import { BURN_DURATION, type Vec3 } from './storm';

export type FiresOpts = { maxFires?: number; burnSeconds?: number };
export type ActiveFire = { treeIndex: number; age: number; burn: number };
export type Fires = {
  ignite: (treeIndex: number, now: number) => boolean;
  step: (dt: number) => ActiveFire[];
  isCharred: (treeIndex: number) => boolean;
};
export type ClickIgnitionOpts = { radius?: number; max?: number };

export const DEFAULT_MAX_FIRES = 6;
export const CLICK_IGNITE_RADIUS = 1.4;
export const CLICK_IGNITE_MAX = 2;
export const VERTICAL_TOLERANCE = 2;

export function createFires(opts: FiresOpts = {}): Fires {
  void opts;
  void BURN_DURATION;
  throw new Error('not implemented');
}

export function pickTreesNear(
  point: Vec3,
  positions: Float32Array | number[],
  radius: number,
  max: number,
): number[] {
  void point;
  void positions;
  void radius;
  void max;
  throw new Error('not implemented');
}

export function clickIgnition(
  point: Vec3,
  positions: Float32Array | number[],
  fires: Fires,
  opts: ClickIgnitionOpts = {},
): number[] {
  void point;
  void positions;
  void fires;
  void opts;
  throw new Error('not implemented');
}
