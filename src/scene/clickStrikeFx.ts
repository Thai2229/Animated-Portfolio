// three.js side of the click strike: a pooled second bolt, impact burst (sparks, flare, dust) and fading scorch decals.
// Everything is allocated once; update() only writes into existing buffers and uniforms.
import * as THREE from 'three';
import { boltPath } from './storm';
import type { ClickStrikeState } from './clickStrike';
import { BOLT_SECONDS, BRANCH_SEGS, MAIN_SEGS, MAX_SEGS, createRibbon } from './stormFx';
import { WATER_Y } from '../terrain/layout';
import type { Profile } from '../terrain/profile';

const SKY_UP = 27;
const SCORCH_MAX = 8;
const SCORCH_SECONDS = 2.5;
const SCORCH_OPACITY = 0.75;
const SCORCH_SIZE = 3.4;
const BURST_SECONDS = 1.6;

const VERT = /* glsl */ `
uniform float uAge;
uniform float uPx;
uniform vec3 uOrigin;
attribute vec4 aRnd;
varying float vLife;
void main() {
  float life = clamp(uAge / DUR, 0.0, 1.0);
  vLife = life;
  float ang = aRnd.x * 6.2832;
  vec3 p = uOrigin;
  float size = 0.0;
  BODY
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * step(life, 0.999) * uPx / -mv.z;
}
`;
const FRAG = /* glsl */ `
varying float vLife;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float soft = 1.0 - smoothstep(0.0, 1.0, d);
  if (soft <= 0.0) discard;
  COLOR
}
`;
const SPARK = {
  dur: '0.9',
  body: `
  float sp = 1.2 + aRnd.y * 2.6;
  vec3 v = vec3(cos(ang) * sp * 0.5, 2.5 + aRnd.z * 3.5, sin(ang) * sp * 0.5);
  p += v * uAge - vec3(0.0, 5.5 * uAge * uAge, 0.0);
  size = 0.4 * (1.0 - vLife);`,
  color: 'gl_FragColor = vec4(1.0, 0.85, 0.5, soft * (1.0 - vLife));',
};
const FLARE = {
  dur: '0.4',
  body: `
  p.y += 0.5;
  size = 9.0 * (1.0 - vLife) * (1.0 - vLife);`,
  color: 'gl_FragColor = vec4(1.0, 0.95, 0.85, soft * soft * (1.0 - vLife));',
};
const DUST = {
  dur: BURST_SECONDS.toFixed(1),
  body: `
  float r = 0.3 + aRnd.y * 0.8;
  p += vec3(cos(ang) * r * vLife * 1.6, 0.15 + vLife * 0.9, sin(ang) * r * vLife * 1.6);
  size = 2.0 + vLife * 3.0;`,
  color: 'gl_FragColor = vec4(0.42, 0.38, 0.33, soft * (1.0 - vLife) * 0.5);',
};

export type ClickFx = {
  group: THREE.Group;
  // dt is the same (possibly frozen by the debug hook) step the strike state was advanced with
  update: (s: ClickStrikeState, dt: number, px: number) => void;
  dispose: () => void;
};

export function createClickFx(profile: Profile, heightAt: (x: number, z: number) => number): ClickFx {
  const group = new THREE.Group();
  const low = profile.name === 'low';

  const core = createRibbon(group, '#ffffff', 1, MAX_SEGS);
  const glow = createRibbon(group, '#7fa2ff', 4.5, MAX_SEGS);
  const bolts = [core, glow];

  const uniforms = { uAge: { value: 0 }, uPx: { value: 1 }, uOrigin: { value: new THREE.Vector3() } };
  const sets: THREE.Points[] = [];
  let seed = 91;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const burst = (n: number, k: { dur: string; body: string; color: string }, additive: boolean) => {
    const g = new THREE.BufferGeometry();
    const a = new Float32Array(n * 4);
    for (let i = 0; i < a.length; i++) a[i] = rnd();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aRnd', new THREE.BufferAttribute(a, 4));
    let blending: THREE.Blending = THREE.NormalBlending;
    if (additive) blending = THREE.AdditiveBlending;
    const m = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT.replace('DUR', k.dur).replace('BODY', k.body),
      fragmentShader: FRAG.replace('COLOR', k.color),
      transparent: true, depthWrite: false, blending, toneMapped: false,
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    pts.visible = false;
    group.add(pts);
    sets.push(pts);
  };
  let sparks = 28;
  let puffs = 5;
  if (low) {
    sparks = 10;
    puffs = 3;
  }
  burst(sparks, SPARK, true);
  burst(1, FLARE, true);
  burst(puffs, DUST, false);

  // scorch decals: a soft dark spot on a plane tilted to the ground normal
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 64;
  const cg = cv.getContext('2d')!;
  const gr = cg.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(12,9,7,1)');
  gr.addColorStop(0.55, 'rgba(12,9,7,0.6)');
  gr.addColorStop(1, 'rgba(12,9,7,0)');
  cg.fillStyle = gr;
  cg.fillRect(0, 0, 64, 64);
  const scorchTex = new THREE.CanvasTexture(cv);
  const scorchGeo = new THREE.PlaneGeometry(SCORCH_SIZE, SCORCH_SIZE);
  const scorches: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; born: number }[] = [];
  for (let i = 0; i < SCORCH_MAX; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: scorchTex, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    const mesh = new THREE.Mesh(scorchGeo, mat);
    mesh.visible = false;
    group.add(mesh);
    scorches.push({ mesh, mat, born: -Infinity });
  }

  const zAxis = new THREE.Vector3(0, 0, 1);
  const normal = new THREE.Vector3();
  let nextScorch = 0;
  let clock = 0;
  let t0 = -Infinity;
  let lastSeed = NaN;

  const spawn = (s: ClickStrikeState) => {
    const p = s.point;
    // bolt: from the sky, slightly offset, to the point; two short branches
    for (const r of bolts) r.reset();
    const from = { x: p.x + 1.5 + (s.seed % 3), y: p.y + SKY_UP + (s.seed % 5), z: p.z - 1 };
    const path = boltPath(s.seed, from, { x: p.x, y: p.y, z: p.z }, MAIN_SEGS);
    for (let i = 0; i < MAIN_SEGS; i++) for (const r of bolts) r.seg(path[i], path[i + 1], 0.12);
    for (const [at, dx, dz] of [[5, 3, -2], [9, -3, 2]]) {
      const b = path[at];
      const br = boltPath(s.seed + at, b, { x: b.x + dx, y: b.y - 5, z: b.z + dz }, BRANCH_SEGS);
      for (let i = 0; i < BRANCH_SEGS; i++) for (const r of bolts) r.seg(br[i], br[i + 1], 0.06);
    }
    for (const r of bolts) r.commit();

    // impact burst restarts at the point
    uniforms.uOrigin.value.set(p.x, p.y, p.z);
    t0 = clock;

    // scorch on land only (water takes no mark)
    if (p.y > WATER_Y + 0.02) {
      const e = 0.5;
      normal.set(heightAt(p.x - e, p.z) - heightAt(p.x + e, p.z), 2 * e, heightAt(p.x, p.z - e) - heightAt(p.x, p.z + e)).normalize();
      const sc = scorches[nextScorch];
      nextScorch = (nextScorch + 1) % SCORCH_MAX;
      sc.mesh.position.set(p.x + normal.x * 0.04, p.y + normal.y * 0.04, p.z + normal.z * 0.04);
      sc.mesh.quaternion.setFromUnitVectors(zAxis, normal);
      sc.born = clock;
      sc.mesh.visible = true;
    }
  };

  const update = (s: ClickStrikeState, dt: number, px: number) => {
    clock += dt;
    if (s.active && s.seed !== lastSeed) {
      lastSeed = s.seed;
      spawn(s);
    }

    const on = s.active && s.age < BOLT_SECONDS;
    for (const r of bolts) r.mesh.visible = on;
    if (on) {
      const k = 1 - s.age / BOLT_SECONDS;
      core.mat.opacity = k;
      glow.mat.opacity = k * 0.3;
    }

    const age = clock - t0;
    uniforms.uAge.value = age;
    uniforms.uPx.value = px;
    const live = age >= 0 && age < BURST_SECONDS;
    for (const p of sets) p.visible = live;

    for (const sc of scorches) {
      if (!sc.mesh.visible) continue;
      const u = (clock - sc.born) / SCORCH_SECONDS;
      if (u >= 1) {
        sc.mesh.visible = false;
        continue;
      }
      sc.mat.opacity = SCORCH_OPACITY * (1 - u);
    }
  };

  const dispose = () => {
    for (const r of bolts) r.dispose();
    for (const p of sets) {
      p.geometry.dispose();
      (p.material as THREE.Material).dispose();
    }
    for (const sc of scorches) sc.mat.dispose();
    scorchGeo.dispose();
    scorchTex.dispose();
  };

  return { group, update, dispose };
}
