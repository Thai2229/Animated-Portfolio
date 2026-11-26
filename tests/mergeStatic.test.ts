import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { mergeStatic } from '@/scene/architecture';

describe('mergeStatic', () => {
  it('bakes same-material meshes into one mesh in the root frame and keeps multi-material meshes', () => {
    const root = new THREE.Group();
    root.position.set(5, 0, 0);
    const matA = new THREE.MeshBasicMaterial();
    const matB = new THREE.MeshBasicMaterial();
    const a1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matA);
    const a2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matA);
    a2.position.set(0, 3, 0);
    const child = new THREE.Group();
    child.position.set(2, 0, 0);
    child.add(a2);
    const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matB);
    const multi = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [matA, matB]);
    root.add(a1, child, b, multi);
    mergeStatic(root);
    const meshes = root.children.filter((o) => (o as THREE.Mesh).isMesh) as THREE.Mesh[];
    expect(meshes).toHaveLength(3); // matA merged, matB merged, the multi-material box untouched
    const merged = meshes.find((m) => m.material === matA && m.geometry.attributes.position.count === 48)!;
    expect(merged).toBeDefined();
    merged.geometry.computeBoundingBox();
    expect(merged.geometry.boundingBox!.max.y).toBeCloseTo(3.5, 5);
    expect(merged.geometry.boundingBox!.max.x).toBeCloseTo(2.5, 5);
  });
});
