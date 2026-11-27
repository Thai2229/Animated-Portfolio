import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { buildSects } from '@/scene/architecture';
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

type Tri = { ax: number; az: number; ay: number; bx: number; bz: number; by: number; cx: number; cz: number; cy: number; flatUp: boolean; mesh: number };

// every non-vertical triangle of a sect in world space; flatUp marks the level, upward-facing ones
function triangles(root: THREE.Object3D) {
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
      const len = n.length();
      if (len / 2 < 1e-4 || Math.abs(n.y) / len < 0.05) continue;
      out.push({
        ax: a.x, az: a.z, ay: a.y, bx: b.x, bz: b.z, by: b.y, cx: c.x, cz: c.z, cy: c.y,
        flatUp: n.y > 0 && Math.abs(n.y) / len > 0.9999 && Math.abs(a.y - b.y) < 1e-4 && Math.abs(a.y - c.y) < 1e-4,
        mesh: id,
      });
    }
  });
  return out;
}

// height of the triangle over (x, z), or null when the point is outside it
function heightOver(t: Tri, x: number, z: number) {
  const d = (t.bz - t.cz) * (t.ax - t.cx) + (t.cx - t.bx) * (t.az - t.cz);
  const u = ((t.bz - t.cz) * (x - t.cx) + (t.cx - t.bx) * (z - t.cz)) / d;
  const v = ((t.cz - t.az) * (x - t.cx) + (t.ax - t.cx) * (z - t.cz)) / d;
  const w = 1 - u - v;
  if (u < 0 || v < 0 || w < 0) return null;
  return u * t.ay + v * t.by + w * t.cy;
}

// Two level, upward-facing surfaces of different meshes at the same height over the same ground z-fight, so the
// surface (and the shadows on it) flickers as the camera moves. Pairs with another level surface just over them are buried and fine.
describe('no two visible surfaces of a sect share a plane', () => {
  it.each(['ledge', 'valley', 'lake'] as SiteKey[])('%s', (key) => {
    const sect = buildSects(() => 0, { ledge: 0, valley: 0, lake: 0 }, true)[key];
    const flat = triangles(sect.group).filter((t) => t.flatUp);
    const bad = new Set<string>();
    for (let i = 0; i < flat.length; i++) {
      for (let j = i + 1; j < flat.length; j++) {
        const t = flat[i];
        const u = flat[j];
        if (u.mesh === t.mesh || Math.abs(u.ay - t.ay) > 0.003) continue;
        // sample the overlap of their bounding boxes; a point inside both triangles is a shared surface
        const x0 = Math.max(Math.min(t.ax, t.bx, t.cx), Math.min(u.ax, u.bx, u.cx));
        const x1 = Math.min(Math.max(t.ax, t.bx, t.cx), Math.max(u.ax, u.bx, u.cx));
        const z0 = Math.max(Math.min(t.az, t.bz, t.cz), Math.min(u.az, u.bz, u.cz));
        const z1 = Math.min(Math.max(t.az, t.bz, t.cz), Math.max(u.az, u.bz, u.cz));
        if (x1 - x0 < 0.02 || z1 - z0 < 0.02) continue;
        for (const [fx, fz] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
          const x = x0 + (x1 - x0) * fx;
          const z = z0 + (z1 - z0) * fz;
          if (heightOver(t, x, z) === null || heightOver(u, x, z) === null) continue;
          // buried: a level surface lies just over it (a cap 0.5 to 6 cm higher), so neither is seen
          const buried = flat.some((q) => {
            const h = heightOver(q, x, z);
            return h !== null && h > t.ay + 0.005 && h < t.ay + 0.06;
          });
          if (!buried) bad.add(`y=${t.ay.toFixed(3)} near x=${x.toFixed(2)} z=${z.toFixed(2)}`);
        }
      }
    }
    expect([...bad].slice(0, 8)).toEqual([]);
  });
});
