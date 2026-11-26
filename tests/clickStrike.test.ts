import { describe, it, expect } from 'vitest';
import {
  shouldStrike,
  createClickStrikes,
  groundPoint,
  hitSect,
  CLICK_COOLDOWN,
  DRAG_THRESHOLD_PX,
  SECT_MARGIN,
  type StrikeInput,
  type Bounds,
} from '@/scene/clickStrike';
import { FLASH_CAP, MAX_FLASHES_PER_SECOND } from '@/scene/storm';

const DT = 1 / 60;
const base = (o: Partial<StrikeInput> = {}): StrikeInput => ({
  hitSect: false,
  panelOpen: false,
  reduced: false,
  onUi: false,
  dragPx: 0,
  now: 10,
  lastStrikeAt: 0,
  ...o,
});

describe('shouldStrike', () => {
  it('allows a plain click on the scene', () => {
    expect(shouldStrike(base())).toBe(true);
  });

  it('allows the very first click (lastStrikeAt -Infinity)', () => {
    expect(shouldStrike(base({ lastStrikeAt: -Infinity, now: 0 }))).toBe(true);
  });

  it.each(['hitSect', 'panelOpen', 'reduced', 'onUi'] as const)('is false when %s', (k) => {
    expect(shouldStrike(base({ [k]: true }))).toBe(false);
  });

  it('rejects drags beyond the threshold but not at it', () => {
    expect(DRAG_THRESHOLD_PX).toBe(8);
    expect(shouldStrike(base({ dragPx: DRAG_THRESHOLD_PX }))).toBe(true);
    expect(shouldStrike(base({ dragPx: DRAG_THRESHOLD_PX + 0.1 }))).toBe(false);
    expect(shouldStrike(base({ dragPx: 400 }))).toBe(false);
  });

  it('uses a 0.45 s default cooldown', () => {
    expect(CLICK_COOLDOWN).toBe(0.45);
    expect(shouldStrike(base({ now: 10.2, lastStrikeAt: 10 }))).toBe(false);
    expect(shouldStrike(base({ now: 10.44, lastStrikeAt: 10 }))).toBe(false);
    expect(shouldStrike(base({ now: 10.45, lastStrikeAt: 10 }))).toBe(true);
  });

  it('honours a custom cooldown', () => {
    expect(shouldStrike(base({ now: 11, lastStrikeAt: 10, cooldown: 2 }))).toBe(false);
    expect(shouldStrike(base({ now: 12.5, lastStrikeAt: 10, cooldown: 2 }))).toBe(true);
  });

  it('does not mutate its input', () => {
    const i = base({ dragPx: 3 });
    const copy = { ...i };
    shouldStrike(i);
    expect(i).toEqual(copy);
  });
});

describe('createClickStrikes', () => {
  const p = { x: 3, y: 1, z: -4 };

  it('is idle before any strike', () => {
    const s = createClickStrikes().step(DT);
    expect(s.active).toBe(false);
    expect(s.flash).toBe(0);
  });

  it('flashes after a strike, within the cap, and reports the point and age', () => {
    const c = createClickStrikes();
    expect(c.strike(p, 0)).toBe(true);
    let peak = 0;
    const s = c.step(DT);
    expect(s.active).toBe(true);
    expect(s.point).toEqual(p);
    expect(s.age).toBeGreaterThan(0);
    expect(Number.isFinite(s.seed)).toBe(true);
    peak = s.flash;
    for (let i = 0; i < 60; i++) {
      const n = c.step(DT);
      expect(n.flash).toBeGreaterThanOrEqual(0);
      expect(n.flash).toBeLessThanOrEqual(FLASH_CAP + 1e-9);
      peak = Math.max(peak, n.flash);
    }
    expect(peak).toBeGreaterThan(0.05);
  });

  it('decays within about 0.35 s and returns to idle', () => {
    const c = createClickStrikes();
    c.strike(p, 0);
    let s = c.step(DT);
    for (let t = DT; t < 0.35; t += DT) s = c.step(DT);
    expect(s.flash).toBeLessThanOrEqual(0.05);
    for (let t = 0; t < 0.5; t += DT) s = c.step(DT);
    expect(s.active).toBe(false);
    expect(s.flash).toBe(0);
  });

  it('age grows while active', () => {
    const c = createClickStrikes();
    c.strike(p, 0);
    const a = c.step(0.05).age;
    const b = c.step(0.05).age;
    expect(b - a).toBeCloseTo(0.05, 5);
  });

  it('ignores a second strike inside the cooldown, accepts one after it', () => {
    const c = createClickStrikes();
    expect(c.strike(p, 0)).toBe(true);
    c.step(DT);
    expect(c.strike({ x: 9, y: 0, z: 9 }, 0.2)).toBe(false);
    expect(c.step(DT).point).toEqual(p);
    expect(c.strike({ x: 9, y: 0, z: 9 }, CLICK_COOLDOWN + 0.01)).toBe(true);
    expect(c.step(DT).point).toEqual({ x: 9, y: 0, z: 9 });
  });

  it('never has more than 3 flash onsets in any 1 s window with 100 clicks over 2 s', () => {
    const c = createClickStrikes();
    const onsets: number[] = [];
    let on = false;
    for (let i = 0; i < 120; i++) {
      const t = i * DT;
      // 100 clicks spread evenly over the 2 s
      if (Math.floor((i * 100) / 120) !== Math.floor(((i - 1) * 100) / 120)) c.strike({ x: i, y: 0, z: -i }, t);
      const s = c.step(DT);
      expect(s.flash).toBeLessThanOrEqual(FLASH_CAP + 1e-9);
      const now = s.flash > 0.05;
      if (now && !on) onsets.push(t);
      on = now;
    }
    expect(onsets.length).toBeGreaterThanOrEqual(1);
    for (let i = 0; i + MAX_FLASHES_PER_SECOND < onsets.length; i++) {
      expect(onsets[i + MAX_FLASHES_PER_SECOND] - onsets[i]).toBeGreaterThanOrEqual(1);
    }
  });

  it('is deterministic for the same click sequence and varies seed between strikes', () => {
    const run = () => {
      const c = createClickStrikes();
      const out: unknown[] = [];
      const seeds: number[] = [];
      for (let k = 0; k < 4; k++) {
        c.strike({ x: k, y: 0, z: k }, k * 1.0);
        for (let i = 0; i < 30; i++) out.push({ ...c.step(DT) });
        seeds.push((out[out.length - 1] as { seed: number }).seed);
      }
      return { out, seeds };
    };
    const a = run();
    expect(run()).toEqual(a);
    expect(new Set(a.seeds).size).toBeGreaterThan(1);
  });

  it('handles a zero or huge dt without leaving [0, cap]', () => {
    const c = createClickStrikes();
    c.strike(p, 0);
    for (const dt of [0, 5, 0.001]) {
      const s = c.step(dt);
      expect(s.flash).toBeGreaterThanOrEqual(0);
      expect(s.flash).toBeLessThanOrEqual(FLASH_CAP + 1e-9);
    }
  });
});

describe('groundPoint', () => {
  const heightAt = (x: number, z: number) => 2 + 0.5 * Math.sin(x * 0.3) + 0.04 * z;
  const bounds: Bounds = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };
  const norm = (v: { x: number; y: number; z: number }) => {
    const l = Math.hypot(v.x, v.y, v.z);
    return { x: v.x / l, y: v.y / l, z: v.z / l };
  };

  it('finds the surface from above within 0.05 units', () => {
    for (const d of [{ x: 0, y: -1, z: 0 }, { x: 0.3, y: -1, z: 0.2 }, { x: -0.6, y: -0.5, z: 0.4 }]) {
      const p = groundPoint({ x: 1, y: 30, z: 2 }, norm(d), heightAt, bounds)!;
      expect(p).not.toBeNull();
      expect(Math.abs(p.y - heightAt(p.x, p.z))).toBeLessThan(0.05);
    }
  });

  it('returns the first (nearest) intersection when the ray crosses a ridge twice', () => {
    const ridge = (x: number) => (Math.abs(x - 5) < 2 ? 8 : 0);
    const p = groundPoint({ x: 0, y: 6, z: 0 }, norm({ x: 1, y: -0.2, z: 0 }), (x) => ridge(x), bounds)!;
    expect(p.x).toBeLessThan(4);
  });

  it('handles a ray starting below the surface and rising through it', () => {
    const p = groundPoint({ x: 0, y: -10, z: 0 }, norm({ x: 0.1, y: 1, z: 0.1 }), heightAt, bounds)!;
    expect(p).not.toBeNull();
    expect(Math.abs(p.y - heightAt(p.x, p.z))).toBeLessThan(0.05);
  });

  it('returns null for an upward ray starting above, and a downward ray starting below', () => {
    expect(groundPoint({ x: 0, y: 30, z: 0 }, norm({ x: 0.2, y: 1, z: 0 }), heightAt, bounds)).toBeNull();
    expect(groundPoint({ x: 0, y: -10, z: 0 }, norm({ x: 0.2, y: -1, z: 0 }), heightAt, bounds)).toBeNull();
  });

  it('returns null for a horizontal ray that never reaches the terrain', () => {
    expect(groundPoint({ x: 0, y: 30, z: 0 }, { x: 1, y: 0, z: 0 }, heightAt, bounds)).toBeNull();
  });

  it('returns null when the intersection lies outside bounds', () => {
    const p = groundPoint({ x: 0, y: 30, z: 0 }, norm({ x: 1, y: -0.05, z: 0 }), heightAt, bounds);
    expect(p).toBeNull();
    const small: Bounds = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
    expect(groundPoint({ x: 20, y: 30, z: 0 }, { x: 0, y: -1, z: 0 }, heightAt, small)).toBeNull();
  });

  it('any returned point is inside bounds and finite', () => {
    const small: Bounds = { minX: -5, maxX: 5, minZ: -5, maxZ: 5 };
    for (let i = 0; i < 40; i++) {
      const d = norm({ x: Math.sin(i), y: -0.4 - (i % 5) * 0.1, z: Math.cos(i * 1.7) });
      const p = groundPoint({ x: 0, y: 25, z: 0 }, d, heightAt, small);
      if (p === null) continue;
      expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
      expect(p.x).toBeGreaterThanOrEqual(small.minX);
      expect(p.x).toBeLessThanOrEqual(small.maxX);
      expect(p.z).toBeGreaterThanOrEqual(small.minZ);
      expect(p.z).toBeLessThanOrEqual(small.maxZ);
    }
  });

  it('does not mutate its inputs', () => {
    const o = { x: 1, y: 30, z: 2 };
    const d = norm({ x: 0.3, y: -1, z: 0.2 });
    const oc = { ...o };
    const dc = { ...d };
    groundPoint(o, d, heightAt, bounds);
    expect(o).toEqual(oc);
    expect(d).toEqual(dc);
  });
});

describe('hitSect', () => {
  const proxies = [
    { x: 0, z: 0, r: 2, top: 5 },
    { x: 20, z: 10, r: 3, top: 8 },
  ];

  it('is true inside a hit cylinder', () => {
    expect(hitSect({ x: 0.5, y: 1, z: 0.5 }, proxies)).toBe(true);
    expect(hitSect({ x: 21, y: 6, z: 11 }, proxies)).toBe(true);
  });

  it('allows a small margin beyond the radius but not far outside', () => {
    expect(hitSect({ x: 2 + SECT_MARGIN / 2, y: 1, z: 0 }, proxies)).toBe(true);
    expect(hitSect({ x: 2 + SECT_MARGIN * 4, y: 1, z: 0 }, proxies)).toBe(false);
  });

  it('is false above the cylinder top and for empty proxies', () => {
    expect(hitSect({ x: 0, y: 5 + SECT_MARGIN * 4, z: 0 }, proxies)).toBe(false);
    expect(hitSect({ x: 0, y: 1, z: 0 }, [])).toBe(false);
  });

  it('is false for open ground between the sects', () => {
    expect(hitSect({ x: 10, y: 1, z: 5 }, proxies)).toBe(false);
  });
});
