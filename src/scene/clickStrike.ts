// pure logic for click-cast lightning (no three.js, no DOM)
import { FLASH_CAP, type Vec3 } from './storm';

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

// a storm flash counts as "on" above this level; click strikes are skipped meanwhile
export const FLASH_ON = 0.05;
export const stormFlashOn = (flash: number) => flash > FLASH_ON;

const CLICK_FLASH = FLASH_CAP * 0.7;
const FLASH_DECAY = 9;
const FLASH_RISE = 0.03;
const ACTIVE_SECONDS = 0.6;
const RAY_STEP = 0.2;
const RAY_MAX = 400;

export function shouldStrike(i: StrikeInput): boolean {
  let cooldown = CLICK_COOLDOWN;
  if (i.cooldown !== undefined) cooldown = i.cooldown;
  // small epsilon so 10.45 - 10 counts as 0.45 despite float error
  return !(i.hitSect || i.panelOpen || i.reduced || i.onUi || i.dragPx > DRAG_THRESHOLD_PX || i.now - i.lastStrikeAt < cooldown - 1e-9);
}

export function createClickStrikes(): ClickStrikes {
  const state: ClickStrikeState = { active: false, flash: 0, age: 0, point: { x: 0, y: 0, z: 0 }, seed: 0 };
  let last = -Infinity;
  let count = 0;
  return {
    strike: (point, now) => {
      if (!shouldStrike({ hitSect: false, panelOpen: false, reduced: false, onUi: false, dragPx: 0, now, lastStrikeAt: last })) return false;
      last = now;
      count++;
      state.active = true;
      state.age = 0;
      state.seed = count * 7919 + 13;
      state.point.x = point.x;
      state.point.y = point.y;
      state.point.z = point.z;
      return true;
    },
    step: (dt) => {
      if (!state.active) {
        state.flash = 0;
        return state;
      }
      state.age += Math.max(0, dt);
      if (state.age >= ACTIVE_SECONDS) {
        state.active = false;
        state.flash = 0;
        return state;
      }
      const f = CLICK_FLASH * Math.min(1, state.age / FLASH_RISE) * Math.exp(-state.age * FLASH_DECAY);
      state.flash = Math.min(CLICK_FLASH, Math.max(0, f));
      return state;
    },
  };
}

// first intersection of a ray with the surface y = heightAt(x, z); null on a miss, an upward ray from above, or outside bounds
export function groundPoint(
  origin: Vec3,
  direction: Vec3,
  heightAt: (x: number, z: number) => number,
  bounds: Bounds,
): Vec3 | null {
  const inside = (x: number, z: number) => x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
  const f = (t: number) => origin.y + direction.y * t - heightAt(origin.x + direction.x * t, origin.z + direction.z * t);
  let prevT = 0;
  let prevF = 0;
  let have = false;
  for (let t = 0; t <= RAY_MAX; t += RAY_STEP) {
    if (!inside(origin.x + direction.x * t, origin.z + direction.z * t)) {
      have = false;
      continue;
    }
    const v = f(t);
    if (have && (prevF > 0) !== (v > 0)) {
      let lo = prevT;
      let hi = t;
      for (let k = 0; k < 30; k++) {
        const mid = (lo + hi) / 2;
        if (f(mid) > 0 === prevF > 0) lo = mid;
        else hi = mid;
      }
      return { x: origin.x + direction.x * hi, y: origin.y + direction.y * hi, z: origin.z + direction.z * hi };
    }
    prevT = t;
    prevF = v;
    have = true;
  }
  return null;
}

export function hitSect(point: Vec3, proxies: SectProxy[]): boolean {
  for (const p of proxies) {
    if (Math.hypot(point.x - p.x, point.z - p.z) <= p.r + SECT_MARGIN && point.y <= p.top + SECT_MARGIN) return true;
  }
  return false;
}
