import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { buildSects, makeHitProxy } from '@/scene/architecture';
import { A2W, SITES, type SiteKey } from '@/terrain/layout';

// minimal 2d-canvas stub so the procedural textures can be built without a DOM
const ctx = new Proxy({}, {
  get: (_t, name) => {
    if (name === 'createLinearGradient' || name === 'createRadialGradient') return () => ({ addColorStop: () => {} });
    return () => {};
  },
  set: () => true,
});
const keys: SiteKey[] = ['ledge', 'valley', 'lake'];
const flat = { ledge: 0, valley: 0, lake: 0 };
const saved = (globalThis as { document?: unknown }).document;

beforeAll(() => {
  (globalThis as { document?: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
});
afterAll(() => {
  (globalThis as { document?: unknown }).document = saved;
});

describe.each([true, false])('buildSects(fine=%s)', (fine) => {
  it('builds merged meshes with compatible attributes and few draw calls', () => {
    const s = buildSects(() => 0, flat, fine);
    for (const k of keys) {
      let meshes = 0;
      s[k].group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        meshes++;
        for (const name of ['position', 'normal', 'uv']) expect(m.geometry.attributes[name]).toBeDefined();
        expect(m.geometry.attributes.position.count).toBeGreaterThan(0);
      });
      expect(meshes).toBeGreaterThan(5);
      expect(meshes).toBeLessThan(120);
    }
  });

  it('hover proxy plus meshes cover the site footprint seen from above', () => {
    const s = buildSects(() => 0, flat, fine);
    for (const k of keys) {
      const site = SITES[k];
      makeHitProxy(s[k].group, site, 0);
      s[k].group.updateMatrixWorld(true);
      const c = A2W(site.a, site.b);
      const ray = new THREE.Raycaster();
      let hits = 0;
      let total = 0;
      for (let i = -10; i <= 10; i++) {
        for (let j = -10; j <= 10; j++) {
          const x = (i / 10) * site.r;
          const z = (j / 10) * site.r;
          if (Math.hypot(x, z) > site.r) continue;
          total++;
          ray.set(new THREE.Vector3(c.x + x, 30, c.z + z), new THREE.Vector3(0, -1, 0));
          if (ray.intersectObject(s[k].group, true).length > 0) hits++;
        }
      }
      expect(hits / total).toBeGreaterThanOrEqual(0.9);
    }
  });
});
