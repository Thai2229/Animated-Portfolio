import type { PlanetKind } from "./projects";

// World units on the z = 0 plane; 1 unit is about 62 px at 1440x900 (camera fov 40 at distance 20).
export const SUN_POS: [number, number, number] = [7.12, 3.32, -1];
export const SUN_R = 1.55;

// One slot per project, in projects.ts order. `label` is the leader-line offset in px.
export const SLOTS: { pos: [number, number, number]; label: [number, number] }[] = [
  { pos: [-2.35, 2.43, 0], label: [-60, -92] },
  { pos: [1.62, 0.32, 0], label: [-130, 60] },
  { pos: [5.99, -2.26, 0], label: [-150, 80] },
];

export const KIND_LABEL: Record<PlanetKind, string> = {
  mars: "Mars",
  earth: "Earth",
  giant: "Ringed giant",
};

// Light comes from the sun, upper right.
export const SUN_DIR: [number, number, number] = [9, 6, 6];
