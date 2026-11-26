// The cat's path around the sun: a tilted ellipse that swings in front of the sun (z > 0) and behind it (z < 0).
// Positions are relative to the sun's centre.
export const PERIOD = 14;
const A = 4.2;
const B = 0.7;
const C = 3;
const D = 1.2; // yaw: puts the front pass over the sun's disc as seen through the perspective camera
const TILT = -0.2;

type Vec3 = [number, number, number];

function tilt(x: number, y: number, z: number): Vec3 {
  const c = Math.cos(TILT);
  const s = Math.sin(TILT);
  return [x * c - y * s, x * s + y * c, z];
}

export function position(t: number): Vec3 {
  const a = (t / PERIOD) * Math.PI * 2;
  return tilt(A * Math.cos(a) - D * Math.sin(a), -B * Math.sin(a), C * Math.sin(a));
}

export function tangent(t: number): Vec3 {
  const a = (t / PERIOD) * Math.PI * 2;
  const d = tilt(-A * Math.sin(a) - D * Math.cos(a), -B * Math.cos(a), C * Math.cos(a));
  const l = Math.hypot(d[0], d[1], d[2]);
  return [d[0] / l, d[1] / l, d[2] / l];
}
