import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { buildSects, pointHullDist } from '@/scene/architecture';
import type { SiteKey } from '@/terrain/layout';

// minimal 2d-canvas stub so the procedural textures can be built without a DOM
const ctx = new Proxy({}, {
  get: (_t, name) => {
    if (name === 'createLinearGradient' || name === 'createRadialGradient') return () => ({ addColorStop: () => {} });
    return () => {};
  },
  set: () => true,
});
const saved = (globalThis as { document?: unknown }).document;
beforeAll(() => {
  (globalThis as { document?: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
});
afterAll(() => {
  (globalThis as { document?: unknown }).document = saved;
});

type Tri = { y: number; up: boolean; x0: number; x1: number; z0: number; z1: number; mesh: number };

// every flat horizontal triangle of a sect, in world space
function flatTriangles(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const out: Tri[] = [];
  let id = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    id++;
    const pos = m.geometry.attributes.position;
    const idx = m.geometry.index;
    let count = pos.count;
    if (idx) count = idx.count;
    for (let i = 0; i + 2 < count; i += 3) {
      const at = (k: number) => {
        if (idx) return idx.getX(i + k);
        return i + k;
      };
      a.fromBufferAttribute(pos, at(0)).applyMatrix4(m.matrixWorld);
      b.fromBufferAttribute(pos, at(1)).applyMatrix4(m.matrixWorld);
      c.fromBufferAttribute(pos, at(2)).applyMatrix4(m.matrixWorld);
      n.crossVectors(b.clone().sub(a), c.clone().sub(a));
      const area = n.length() / 2;
      if (area < 1e-4 || Math.abs(n.y) / n.length() < 0.9999) continue;
      out.push({
        y: (a.y + b.y + c.y) / 3,
        up: n.y > 0,
        x0: Math.min(a.x, b.x, c.x), x1: Math.max(a.x, b.x, c.x),
        z0: Math.min(a.z, b.z, c.z), z1: Math.max(a.z, b.z, c.z),
        mesh: id,
      });
    }
  });
  return out;
}

// the two open pavilions: a wood floor sat on a granite pad with the same top height, which z-fought and made the floor
// and the roof shadow on it flicker as the camera drifted
describe('no two surfaces of a pavilion share a plane (that z-fights and flickers, shadows included)', () => {
  it.each([['ledge', 'pavilion'], ['lake', 'water pavilion']] as [SiteKey, string][])('%s: %s', (key, name) => {
    const sect = buildSects(() => 0, { ledge: 0, valley: 0, lake: 0 }, true)[key];
    const hull = sect.footprints.find((f) => f.name === name)!.hull;
    const tris = flatTriangles(sect.group).filter((t) => pointHullDist([(t.x0 + t.x1) / 2, (t.z0 + t.z1) / 2], hull) === 0);
    expect(tris.length).toBeGreaterThan(5);
    const buckets = new Map<number, Tri[]>();
    for (const t of tris) {
      const k = Math.round(t.y / 0.004);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(t);
    }
    const bad = new Set<string>();
    for (const [k, list] of buckets) {
      const all = list.concat(buckets.get(k + 1) ?? []);
      for (const t of list) {
        for (const u of all) {
          if (u === t || u.mesh === t.mesh || u.up !== t.up || Math.abs(u.y - t.y) > 0.003) continue;
          const ox = Math.min(t.x1, u.x1) - Math.max(t.x0, u.x0);
          const oz = Math.min(t.z1, u.z1) - Math.max(t.z0, u.z0);
          if (ox > 0.05 && oz > 0.05) bad.add(`y=${t.y.toFixed(3)} near x=${((t.x0 + t.x1) / 2).toFixed(2)} z=${((t.z0 + t.z1) / 2).toFixed(2)}`);
        }
      }
    }
    expect([...bad].slice(0, 8)).toEqual([]);
  });
});
