export type Vec3 = [number, number, number];
export type Pose = { position: Vec3; target: Vec3 };

const ease = (t: number) => {
  return t * t * t * (t * (t * 6 - 15) + 10);
};

const mix = (a: Vec3, b: Vec3, e: number): Vec3 => {
  return [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e];
};

// Eased interpolation between two camera poses; t is clamped to [0, 1].
export function flyPose(from: Pose, to: Pose, t: number): Pose {
  const e = ease(Math.min(1, Math.max(0, t)));
  return { position: mix(from.position, to.position, e), target: mix(from.target, to.target, e) };
}
