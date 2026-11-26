// pure logic for click-cast lightning (no three.js, no DOM)
import type { Vec3 } from './storm';

export const CLICK_COOLDOWN = 0.45;
export const DRAG_THRESHOLD_PX = 8;
export const SECT_MARGIN = 0.25;

export type StrikeInput = {
  hitSect: boolean;
  panelOpen: boolean;
  reduced: boolean;
  onUi: boolean;
  dragPx: number;
  now: number;
  lastStrikeAt: number;
  cooldown?: number;
};
export type ClickStrikeState = { active: boolean; flash: number; age: number; point: Vec3; seed: number };
export type ClickStrikes = {
  // returns true when the strike was accepted, false when ignored (cooldown)
  strike: (point: Vec3, now: number) => boolean;
  step: (dt: number) => ClickStrikeState;
};
export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type SectProxy = { x: number; z: number; r: number; top: number };

export function shouldStrike(_input: StrikeInput): boolean {
  throw new Error('not implemented');
}

export function createClickStrikes(): ClickStrikes {
  throw new Error('not implemented');
}

// first intersection of a ray with the surface y = heightAt(x, z); null on a miss, an upward ray from above, or outside bounds
export function groundPoint(
  _origin: Vec3,
  _direction: Vec3,
  _heightAt: (x: number, z: number) => number,
  _bounds: Bounds,
): Vec3 | null {
  throw new Error('not implemented');
}

export function hitSect(_point: Vec3, _proxies: SectProxy[]): boolean {
  throw new Error('not implemented');
}
