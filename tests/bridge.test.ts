import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { buildSects } from '@/scene/architecture';
import { generateHeightfield } from '@/terrain/heightfield';
import { A2W, BRIDGE, PATH_ALL, W2A, WATER_Y } from '@/terrain/layout';

// minimal 2d-canvas stub so the procedural textures can be built without a DOM
const ctx = new Proxy({}, {
  get: (_t, name) => {
    if (name === 'createLinearGradient' || name === 'createRadialGradient') return () => ({ addColorStop: () => {} });
    return () => {};
  },
  set: () => true,
});
const saved = (globalThis as { document?: unknown }).document;
const OPTS = { n: 192, worldSize: 120, seed: 1234, erosionDroplets: 20000 };
const TOL = 0.1;

type Field = ReturnType<typeof generateHeightfield>;
let hf: Field;
let bridge: THREE.Object3D;
// bridge vertices as (s along the deck, t across it, y, world x, world z)
let pts: { s: number; t: number; y: number; x: number; z: number }[];
const centre = A2W(BRIDGE.a, BRIDGE.b);
const ex = A2W(BRIDGE.a + BRIDGE.dirA, BRIDGE.b + BRIDGE.dirB);
const ax = ex.x - centre.x;
const az = ex.z - centre.z;

beforeAll(() => {
  (globalThis as { document?: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  hf = generateHeightfield(OPTS);
  bridge = buildSects(hf.heightAt, hf.siteHeights, true).bridge;
  bridge.updateMatrixWorld(true);
  pts = [];
  const v = new THREE.Vector3();
  bridge.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      const dx = v.x - centre.x;
      const dz = v.z - centre.z;
      pts.push({ s: dx * ax + dz * az, t: dx * -az + dz * ax, y: v.y, x: v.x, z: v.z });
    }
  });
});
afterAll(() => {
  (globalThis as { document?: unknown }).document = saved;
});

function segDist(p: [number, number], a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}

describe('the stone bridge below the waterfall', () => {
  it('is detailed, not one plain arch', () => {
    expect(pts.length).toBeGreaterThan(3000);
  });

  it('both ends sit on the banks: the lowest vertices at each end are at or below the ground', () => {
    for (const sign of [-1, 1]) {
      const end = pts.filter((p) => p.s * sign > BRIDGE.half - 1.2 && Math.abs(p.t) < 1.2);
      expect(end.length).toBeGreaterThan(20);
      const gap = Math.min(...end.map((p) => p.y - hf.heightAt(p.x, p.z)));
      expect(gap, `end ${sign}`).toBeLessThanOrEqual(TOL);
      // and the deck really reaches the end of the bridge
      expect(Math.max(...pts.map((p) => p.s * sign))).toBeGreaterThan(BRIDGE.half - 0.5);
    }
  });

  it('spans the river: nothing but air under the deck across the water width, deck clear of the water', () => {
    // water width along the deck axis, measured on the heightfield
    let lo = Infinity;
    let hi = -Infinity;
    for (let s = -8; s <= 8; s += 0.05) {
      if (hf.heightAt(centre.x + ax * s, centre.z + az * s) < WATER_Y) {
        lo = Math.min(lo, s);
        hi = Math.max(hi, s);
      }
    }
    expect(hi - lo).toBeGreaterThan(1);
    const under = pts.filter((p) => p.s > lo - 0.05 && p.s < hi + 0.05 && p.y < WATER_Y + 0.4);
    expect(under.length).toBe(0);
    const mid = pts.filter((p) => Math.abs(p.s) < 0.3 && Math.abs(p.t) < 0.9);
    expect(Math.min(...mid.map((p) => p.y))).toBeGreaterThanOrEqual(WATER_Y + 0.4);
    // the arch opening is wider than the river: the stone either side of the opening starts beyond the water
    const piers = pts.filter((p) => p.y < WATER_Y + 0.9 && Math.abs(p.t) < 0.8).map((p) => Math.abs(p.s));
    expect(Math.min(...piers)).toBeGreaterThanOrEqual((hi - lo) / 2);
  });

  it('every vertex is inside the world', () => {
    const half = OPTS.worldSize / 2;
    for (const p of pts) {
      expect(Math.abs(p.x)).toBeLessThan(half);
      expect(Math.abs(p.z)).toBeLessThan(half);
    }
  });

  it('the stone path leads to both ends', () => {
    for (const sign of [-1, 1]) {
      const a = BRIDGE.a + sign * BRIDGE.half * BRIDGE.dirA;
      const b = BRIDGE.b + sign * BRIDGE.half * BRIDGE.dirB;
      let d = Infinity;
      for (let i = 0; i + 1 < PATH_ALL.length; i++) d = Math.min(d, segDist([a, b], PATH_ALL[i], PATH_ALL[i + 1]));
      expect(d).toBeLessThan(1);
    }
    expect(W2A(centre.x, centre.z).a).toBeCloseTo(BRIDGE.a, 6);
  });

  it('the balustrade is continuous on both sides along the whole deck', () => {
    // the red lacquered line runs on top of every panel, so its s-ranges show where the rail is
    const red = (bridge.children as THREE.Mesh[]).filter((m) => m.isMesh && (m.material as THREE.MeshStandardMaterial).color.getHex() === 0x8f2a1f);
    expect(red.length).toBeGreaterThan(0);
    const v = new THREE.Vector3();
    const spans: Record<string, [number, number][]> = { '-1': [], '1': [] };
    for (const m of red) {
      const pos = m.geometry.attributes.position;
      for (let i = 0; i + 2 < pos.count; i += 3) {
        const q = [0, 1, 2].map((k) => {
          v.fromBufferAttribute(pos, i + k).applyMatrix4(m.matrixWorld);
          const dx = v.x - centre.x;
          const dz = v.z - centre.z;
          return { s: dx * ax + dz * az, t: dx * -az + dz * ax };
        });
        const t = (q[0].t + q[1].t + q[2].t) / 3;
        if (Math.abs(t) < 0.5) continue;
        spans[String(Math.sign(t))].push([Math.min(...q.map((p) => p.s)), Math.max(...q.map((p) => p.s))]);
      }
    }
    for (const side of ['-1', '1']) {
      const list = spans[side].sort((p, q) => p[0] - q[0]);
      expect(list.length, `side ${side}`).toBeGreaterThan(0);
      let reach = -BRIDGE.half;
      let widest = 0;
      for (const [s0, s1] of list) {
        widest = Math.max(widest, s0 - reach);
        reach = Math.max(reach, s1);
      }
      // only the end posts may break the line; a missing panel would leave 0.9
      expect(widest, `side ${side}`).toBeLessThan(0.4);
      expect(reach, `side ${side}`).toBeGreaterThan(BRIDGE.half - 0.4);
    }
  });

  it('never blocks clicks', () => {
    const rc = new THREE.Raycaster(new THREE.Vector3(centre.x, 20, centre.z), new THREE.Vector3(0, -1, 0));
    expect(rc.intersectObject(bridge, true)).toEqual([]);
  });
});
