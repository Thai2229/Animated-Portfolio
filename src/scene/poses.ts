import { A2W, SITES, type SiteKey } from '../terrain/layout';
import type { Pose, Vec3 } from './cameraPath';

const S2 = Math.SQRT1_2;
// offset in world units for a step along the design frame (a = screen right, b = away from camera)
export const offA = (da: number, db: number) => ({ x: (db - da) * S2, z: (da + db) * S2 });

export const HOME: Pose = (() => {
  const t = A2W(3, 11);
  const p = A2W(-3, -54);
  return { position: [p.x, 30, p.z], target: [t.x, 5, t.z] };
})();

// Height of the floating label anchor above each site.
export const LABEL_UP: Record<SiteKey, number> = { ledge: 2.2, valley: 3.6, lake: 3.2 };

// How far back to stand: the valley compound is much wider than the pagoda ledge.
const DIST: Record<SiteKey, number> = { ledge: 1.25, valley: 2.1, lake: 1.35 };

export function sectPose(site: SiteKey, groundY: number, mobile: boolean): Pose {
  const w = A2W(SITES[site].a, SITES[site].b);
  // shift the framing so the building sits clear of the panel (left on desktop, upper half on phones)
  const shift = offA(2.6, 0);
  const ty = groundY + 1;
  let tx = w.x + shift.x;
  let tz = w.z + shift.z;
  let targetY = ty;
  if (mobile) {
    tx = w.x;
    tz = w.z;
    targetY = ty - 3.5;
  }
  const k = DIST[site];
  const back = offA(-4.5 * k, -11.5 * k);
  const target: Vec3 = [tx, targetY, tz];
  const position: Vec3 = [tx + back.x, groundY + 7.5 * k, tz + back.z];
  return { position, target };
}

export function fovFor(aspect: number) {
  if (aspect >= 1.6) return 36;
  const v = 2 * Math.atan(Math.tan((18 * Math.PI) / 180) * (1.6 / aspect));
  return Math.min(70, (v * 180) / Math.PI);
}
