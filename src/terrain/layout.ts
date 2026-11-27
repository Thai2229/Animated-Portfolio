// Design frame: a = screen-right along the ground, b = away from the camera. Look target C.
const S2 = Math.SQRT1_2;
export const C = { x: 4, z: 6 };
export const A2W = (a: number, b: number) => ({ x: C.x + (b - a) * S2, z: C.z + (a + b) * S2 });
export const W2A = (x: number, z: number) => ({
  a: (z - C.z - (x - C.x)) * S2,
  b: (z - C.z + (x - C.x)) * S2,
});

export const WATER_Y = 0;
export type Pt = [number, number];

export const RIDGE: Pt[] = [[-14, 48], [-2, 40], [10, 33], [22, 26], [34, 20], [48, 16]];
export const SITES = {
  ledge: { a: 16, b: 15.5, r: 5.6, h: 13.5 },
  valley: { a: -15, b: 8, r: 5.5, h: 0 },
  lake: { a: 7.8, b: -6.5, r: 5.6, h: 4.5 },
};
export type SiteKey = keyof typeof SITES;
export const LAKE = { a: -1, b: -9, r: 7.5 };
export const FALL_TOP = { a: 3, b: 21.5, h: 18 };
export const FALL_BASE = { a: 2.2, b: 17.4, h: -0.4 };
export const RIVER: Pt[] = [[2.2, 16.5], [1.2, 12], [-0.5, 6], [-1.5, 1], [-1.2, -3.5]];
// stream down from the massif to the lip, winding; index 0 is the lip
export const FEEDER: Pt[] = [[FALL_TOP.a, FALL_TOP.b], [4.8, 24], [8.2, 25.6], [9.6, 28.8], [8, 31.8], [11.6, 33.8], [14.2, 36.8]];
// the fall is this much wider than the original 2.6 ribbon
export const FALL_SCALE = 1.8;
const sst = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// stream water width at arclength s upstream of the lip: flared at the lip, narrowing just above it, widening slowly upstream
export const streamWidth = (s: number) => {
  const flare = 2.6 * FALL_SCALE;
  return flare + (3 - flare) * sst(0, 2.5, s) + 1.3 * sst(5, 15, s);
};
// stream bed height: a gentle climb upstream from just below the lip
export const streamBed = (s: number) => FALL_TOP.h - 0.4 + 0.13 * s;
// free-standing mesas: [a, b, radius, height, squash]
export const MESAS: [number, number, number, number, number][] = [
  [-26, 22, 5.5, 10.5, 0.8], [-6, 26, 3.5, 7.5, 1.3], [-30, 2, 4.2, 5.2, 1.0],
  [24, 4, 6.2, 8.2, 0.7], [16, -16, 3.2, 3.8, 1.4], [-22, -12, 2.6, 6.2, 1.0],
  [32, 30, 7, 15, 0.9], [-12, 34, 4.5, 13, 1.1], [38, -6, 4, 5.5, 1.2],
];
// stone path baked into the ground: ledge -> switchbacks -> bridge -> plateau, plus a branch to the lake tier
export const PATH_MAIN: Pt[] = [
  [SITES.ledge.a - 3, SITES.ledge.b - 1], [13, 12.5], [10.5, 13.5], [8, 11.5], [5.5, 12.2], [3.2, 11.5],
  [-0.5, 10.6], [-4, 9.4], [-7.5, 10.4], [-10.2, 9.2], [SITES.valley.a + 5.5, SITES.valley.b - 1.5],
];
export const PATH_BRANCH: Pt[] = [
  [0.2, 10.4], [2.6, 7.5], [4.2, 3.5], [5.2, 0.2], [SITES.lake.a - 1.2, SITES.lake.b + 3.2],
];
export const PATH_ALL: Pt[] = PATH_MAIN.concat(PATH_BRANCH);
// sun direction (unnormalised) from the upper-left of the frame
export const SUN_DIR = { x: 0.5, y: 0.95, z: -0.45 };
