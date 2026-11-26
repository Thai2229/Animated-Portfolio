// Storm logic (pure: no three.js, no DOM). Stub: signatures only, tests drive the implementation.
export type StormPhase = 'clear' | 'gathering' | 'active' | 'clearing';
export type Vec3 = { x: number; y: number; z: number };
export type StormState = {
  phase: StormPhase;
  cloud: number;
  flash: number;
  strike: null | { treeIndex: number; age: number };
};
export type StormOpts = {
  treeCount: number;
  enabled?: boolean;
  gapMin?: number;
  gapMax?: number;
};
export type Storm = { step: (dtSeconds: number) => StormState };

export const FLASH_CAP = 0.6;
export const MAX_FLASHES_PER_SECOND = 3;
export const BURN_DURATION = 20;
export const BOLT_MAX_OFFSET = 1;

export function createStorm(seed: number, opts: StormOpts): Storm {
  throw new Error('not implemented');
}

export function burn(age: number): number {
  throw new Error('not implemented');
}

export function boltPath(seed: number, from: Vec3, to: Vec3, segments: number): Vec3[] {
  throw new Error('not implemented');
}
