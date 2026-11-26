// Flying swordsmen: pure path logic (no three.js). Stub until implemented.
export type Vec3 = { x: number; y: number; z: number };
export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number; maxY: number };
export type Cylinder = { x: number; z: number; r: number; top: number };
export type FlyerPose = { x: number; y: number; z: number; yaw: number; bank: number };

export type Flyer = {
  // seconds for one full loop: pathAt(period) coincides with pathAt(0)
  period: number;
  // yaw = atan2(vx, vz) of the velocity; bank is signed roll in radians (|bank| <= MAX_BANK)
  // pose at time t seconds (paths loop; any t >= 0 is valid)
  pathAt: (t: number) => FlyerPose;
};

export type FlyerOptions = {
  heightAt: (x: number, z: number) => number;
  clearance: number;
  proxies: Cylinder[];
  margin: number;
};

export const SPEED_MIN = 4;
export const SPEED_MAX = 14;
export const MAX_BANK = 0.6;

export function createFlyers(seed: number, count: number, bounds: Bounds, opts: FlyerOptions): Flyer[] {
  throw new Error('not implemented');
}

// advances a flyer by dt seconds from time t and returns the new time and pose
export function stepFlyer(flyer: Flyer, t: number, dt: number): { t: number; pose: FlyerPose } {
  throw new Error('not implemented');
}
