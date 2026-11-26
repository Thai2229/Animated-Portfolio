// Storm logic (pure: no three.js, no DOM). Cycle: clear -> gathering -> active -> clearing -> clear.
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
  firstGap?: number;
  // tree indices the strike may pick (e.g. the ones in view); defaults to every tree
  candidates?: number[];
};
export type Storm = { step: (dtSeconds: number) => StormState };

export const FLASH_CAP = 0.6;
export const MAX_FLASHES_PER_SECOND = 3;
export const BURN_DURATION = 20;
export const BOLT_MAX_OFFSET = 1;

const GATHER = 8;
const ACTIVE = 25;
const CLEAR = 8;
const BURN_PEAK = 1.6;
const FLASH_DECAY = 7;
const FLASH_RISE = 0.04;
const FLASH_LENGTH = 0.5;

function makeRnd(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (x: number) => x * x * (3 - 2 * x);

export function createStorm(seed: number, opts: StormOpts): Storm {
  const rnd = makeRnd(seed);
  const gapMin = opts.gapMin ?? 50;
  const gapMax = opts.gapMax ?? 90;
  const enabled = opts.enabled !== false;
  const nextGap = () => gapMin + rnd() * (gapMax - gapMin);
  let phase: StormPhase = 'clear';
  let gap = opts.firstGap ?? nextGap();
  let el = 0; // seconds spent in the current phase
  // per-storm schedule, drawn when the storm turns active
  let strikeAt = 0;
  let treeIndex = -1;
  let flashes: number[] = [];

  const enterActive = () => {
    // flashes are at least 1 s apart (0.5-2.5, 3.5-8, 10-14, 16-22), so never more than one per second
    strikeAt = 3.5 + rnd() * 4.5;
    flashes = [0.5 + rnd() * 2, strikeAt, 10 + rnd() * 4, 16 + rnd() * 6];
    treeIndex = -1;
    if (opts.treeCount > 0) treeIndex = Math.floor(rnd() * opts.treeCount);
    if (opts.treeCount > 0 && opts.candidates && opts.candidates.length > 0) {
      treeIndex = opts.candidates[Math.floor(rnd() * opts.candidates.length)];
    }
  };

  const duration = () => {
    if (phase === 'clear') return gap;
    if (phase === 'gathering') return GATHER;
    if (phase === 'active') return ACTIVE;
    return CLEAR;
  };

  const advance = () => {
    if (phase === 'clear') phase = 'gathering';
    else if (phase === 'gathering') {
      phase = 'active';
      enterActive();
    } else if (phase === 'active') phase = 'clearing';
    else {
      phase = 'clear';
      gap = nextGap();
    }
  };

  const step = (dt: number): StormState => {
    if (!enabled) return { phase: 'clear', cloud: 0, flash: 0, strike: null };
    el += Math.max(0, dt);
    while (el >= duration()) {
      el -= duration();
      advance();
    }
    let cloud = 0;
    if (phase === 'gathering') cloud = smooth(el / GATHER);
    if (phase === 'active') cloud = 1;
    if (phase === 'clearing') cloud = 1 - smooth(el / CLEAR);
    let flash = 0;
    if (phase === 'active') {
      for (const f of flashes) {
        const a = el - f;
        if (a >= 0 && a < FLASH_LENGTH) {
          flash = Math.max(flash, FLASH_CAP * Math.min(1, a / FLASH_RISE) * Math.exp(-a * FLASH_DECAY));
        }
      }
    }
    let strike: StormState['strike'] = null;
    if (treeIndex >= 0 && (phase === 'clearing' || (phase === 'active' && el >= strikeAt))) {
      let age = el - strikeAt;
      if (phase === 'clearing') age = ACTIVE - strikeAt + el;
      strike = { treeIndex, age };
    }
    return { phase, cloud, flash, strike };
  };
  return { step };
}

// 0 at the strike, ramps to 1 by BURN_PEAK, holds near 1, then fades to 0 (charred) at BURN_DURATION
export function burn(age: number): number {
  if (!(age > 0) || age >= BURN_DURATION) return 0;
  if (age < BURN_PEAK) return age / BURN_PEAK;
  const u = (age - BURN_PEAK) / (BURN_DURATION - BURN_PEAK);
  return 1 - u * u * u * u;
}

export function boltPath(seed: number, from: Vec3, to: Vec3, segments: number): Vec3[] {
  if (!Number.isInteger(segments) || segments < 1) throw new Error('segments must be a positive integer');
  const rnd = makeRnd(seed);
  const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
  const len = Math.hypot(d.x, d.y, d.z);
  // two unit vectors perpendicular to the bolt axis
  const ax = { x: d.x / len, y: d.y / len, z: d.z / len };
  let ref = { x: 1, y: 0, z: 0 };
  if (Math.abs(ax.x) > 0.9) ref = { x: 0, y: 1, z: 0 };
  let u = { x: ax.y * ref.z - ax.z * ref.y, y: ax.z * ref.x - ax.x * ref.z, z: ax.x * ref.y - ax.y * ref.x };
  const ul = Math.hypot(u.x, u.y, u.z);
  u = { x: u.x / ul, y: u.y / ul, z: u.z / ul };
  const w = { x: ax.y * u.z - ax.z * u.y, y: ax.z * u.x - ax.x * u.z, z: ax.x * u.y - ax.y * u.x };
  const pts: Vec3[] = [{ ...from }];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const amp = BOLT_MAX_OFFSET * 0.9 * Math.sin(Math.PI * t);
    let su = 1;
    if (rnd() < 0.5) su = -1;
    let sw = 1;
    if (rnd() < 0.5) sw = -1;
    const a = (su * (0.4 + 0.6 * rnd()) * amp) / Math.SQRT2;
    const b = (sw * (0.4 + 0.6 * rnd()) * amp) / Math.SQRT2;
    pts.push({
      x: from.x + d.x * t + u.x * a + w.x * b,
      y: from.y + d.y * t + u.y * a + w.y * b,
      z: from.z + d.z * t + u.z * a + w.z * b,
    });
  }
  pts.push({ ...to });
  return pts;
}
