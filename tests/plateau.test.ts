import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { buildSects } from '@/scene/architecture';
import { generateHeightfield } from '@/terrain/heightfield';
import { W2A, SITES, type SiteKey } from '@/terrain/layout';

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
const keys: SiteKey[] = ['ledge', 'valley', 'lake'];
const FLAT_TOL = 0.35;
// the ledge keeps a 0.6 clear rim. The valley hall is a rectangle (wall corners, gate and lions reach past the circular
// site radius) and the lake temple's outer lanterns sit on the radius; both stand on flat ground with no drop beyond
// the rim, so their margin is loosened (negative = allowed slightly outside the nominal radius).
const RIM_MARGIN = { ledge: 0.6, valley: -1.5, lake: -0.1 };
const STRETCH = { ledge: 1, valley: 1, lake: 1 };

type Field = ReturnType<typeof generateHeightfield>;
let hf: Field;
let sects: ReturnType<typeof buildSects>;

beforeAll(() => {
  (globalThis as { document?: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  hf = generateHeightfield(OPTS);
  sects = buildSects(hf.heightAt, hf.siteHeights, true);
});
afterAll(() => {
  (globalThis as { document?: unknown }).document = saved;
});

// distinct world-space (x, y, z) vertices of every mesh of a sect, snapped to 5 cm
function footprint(key: SiteKey) {
  const g = sects[key].group;
  g.updateMatrixWorld(true);
  const seen = new Map<string, THREE.Vector3>();
  const v = new THREE.Vector3();
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      const k = `${Math.round(v.x * 20)}_${Math.round(v.y * 20)}_${Math.round(v.z * 20)}`;
      if (!seen.has(k)) seen.set(k, v.clone());
    }
  });
  return [...seen.values()];
}

describe('sect buildings stand on the carved plateau', () => {
  it.each(keys)('%s: every footprint point is on near-flat ground, clear of the plateau rim', (key) => {
    const site = SITES[key];
    const platform = hf.siteHeights[key];
    const bad: string[] = [];
    let worstRim = Infinity;
    let worstDy = 0;
    for (const p of footprint(key)) {
      // lake stair, zigzag bridge and water pavilion are built below the tier on purpose
      if (p.y < platform - 0.2) continue;
      const q = W2A(p.x, p.z);
      const da = q.a - site.a;
      const db = q.b - site.b;
      const rimDist = (site.r - Math.hypot(da, db * STRETCH[key])) / STRETCH[key];
      const dy = Math.abs(hf.heightAt(p.x, p.z) - platform);
      worstRim = Math.min(worstRim, rimDist);
      worstDy = Math.max(worstDy, dy);
      if (rimDist < RIM_MARGIN[key] || dy > FLAT_TOL) {
        bad.push(`da=${da.toFixed(2)} db=${db.toFixed(2)} rim=${rimDist.toFixed(2)} dy=${dy.toFixed(2)}`);
      }
    }
    // the first offenders identify the prop (offsets are from the site centre in the design frame)
    expect(bad.slice(0, 6), `worst rim distance ${worstRim.toFixed(2)}, worst height error ${worstDy.toFixed(2)}`).toEqual([]);
  });
});
