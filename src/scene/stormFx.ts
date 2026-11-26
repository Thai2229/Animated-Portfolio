// three.js side of the storm: cloud layer, lightning bolt, fire/smoke on the struck pine, charring.
import * as THREE from 'three';
import { A2W } from '../terrain/layout';
import type { WorldData } from '../terrain/world';
import type { Profile } from '../terrain/profile';
import { boltPath, burn, type StormState, type Vec3 } from './storm';

const CLOUD_Y = 26;
const BOLT_SECONDS = 0.25;
const CHAR_SECONDS = 6;
const BRANCH_SEGS = 5;
const MAIN_SEGS = 14;
const MAX_SEGS = MAIN_SEGS + 2 * BRANCH_SEGS;
const CHARCOAL = new THREE.Color('#14100d');

const PARTICLE_VERT = /* glsl */ `
uniform float uTime;
uniform float uBurn;
uniform float uPx;
uniform vec3 uOrigin;
uniform float uScale;
attribute vec4 aRnd;
varying float vLife;
varying float vOn;
void main() {
  float speed = SPEED * (0.7 + aRnd.y * 0.6);
  float life = fract(uTime * speed + aRnd.x);
  vLife = life;
  vOn = step(aRnd.w, uBurn);
  vec3 p = uOrigin;
  float size = 0.0;
  KIND_BODY
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * vOn * uPx / -mv.z;
}
`;

const FLAME_BODY = /* glsl */ `
  float r = (1.0 - life * 0.8) * 0.3 * uScale * 3.0;
  p.y -= 0.45 * uScale;
  p += vec3((aRnd.y - 0.5) * 2.0 * r, life * (0.5 + aRnd.z) * 1.7, (aRnd.z - 0.5) * 2.0 * r);
  p.x += sin(uTime * 7.0 + aRnd.x * 40.0) * 0.1 * life;
  size = (0.7 + 0.6 * aRnd.w) * sin(life * 3.14159 * 0.85 + 0.25) * 0.7 * (0.4 + 0.6 * uBurn);
`;
const SPARK_BODY = /* glsl */ `
  float t = life * 2.2;
  vec3 v = vec3((aRnd.y - 0.5) * 1.6, 1.2 + aRnd.z * 1.6, (aRnd.z - 0.5) * 1.6);
  p += v * t - vec3(0.0, 1.6 * t * t, 0.0);
  size = 0.1 * (1.0 - life);
`;
const SMOKE_BODY = /* glsl */ `
  p += vec3(life * 3.2 + (aRnd.y - 0.5) * 0.5, 1.2 + life * 5.0, life * 1.6 + (aRnd.z - 0.5) * 0.5);
  size = 1.0 + life * 3.2;
`;

const FRAG = /* glsl */ `
varying float vLife;
varying float vOn;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float soft = 1.0 - smoothstep(0.0, 1.0, d);
  if (soft <= 0.0 || vOn <= 0.0) discard;
  COLOR_BODY
}
`;
const FLAME_COLOR = /* glsl */ `
  // teardrop tongue (point coord y is 0 at the top): orange body, yellow core, red as it dies
  float hw = mix(0.12, 0.7, gl_PointCoord.y);
  float fx = abs(gl_PointCoord.x - 0.5) * 2.0 / hw;
  float tear = (1.0 - smoothstep(0.35, 1.0, fx)) * smoothstep(0.0, 0.12, gl_PointCoord.y) * (1.0 - smoothstep(0.85, 1.0, gl_PointCoord.y));
  vec3 c = mix(vec3(1.0, 0.36, 0.04), vec3(1.0, 0.85, 0.3), tear * tear * 0.5);
  c = mix(c, vec3(0.7, 0.1, 0.02), smoothstep(0.75, 1.0, vLife));
  gl_FragColor = vec4(c, tear * (1.0 - vLife * vLife) * 0.3);
`;
const SPARK_COLOR = /* glsl */ `
  gl_FragColor = vec4(1.0, 0.75, 0.3, soft * (1.0 - vLife));
`;
const SMOKE_COLOR = /* glsl */ `
  gl_FragColor = vec4(vec3(0.08, 0.075, 0.07), soft * sin(vLife * 3.14159) * 0.6);
`;

export type StormFx = {
  group: THREE.Group;
  update: (s: StormState, t: number, px: number) => void;
  dispose: () => void;
  // world position of the burning tree top, for the debug hook
  treeTop: THREE.Vector3;
};

export function createStormFx(world: WorldData, profile: Profile, crown: THREE.InstancedMesh): StormFx {
  const group = new THREE.Group();
  const low = profile.name === 'low';
  const third = 1 / (1 + 2 * Number(low));

  // clouds: dark soft sprites that slide in over the massif
  const cc = document.createElement('canvas');
  cc.width = 256;
  cc.height = 128;
  const cg = cc.getContext('2d')!;
  let seed = 17;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 34; i++) {
    const x = 40 + rnd() * 176;
    const y = 36 + rnd() * 56;
    const r = 14 + rnd() * 38;
    const gr = cg.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,.5)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    cg.fillStyle = gr;
    cg.fillRect(0, 0, 256, 128);
  }
  const ct = new THREE.CanvasTexture(cc);
  const clouds: { s: THREE.Sprite; x: number; z: number; ph: number; k: number }[] = [];
  const count = Math.round(20 * (1 - 0.5 * Number(low)));
  for (let i = 0; i < count; i++) {
    const w = A2W(-5 + rnd() * 50, 15 + rnd() * 40);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: ct, color: '#323a45', transparent: true, opacity: 0, depthWrite: false, fog: false,
    }));
    const size = 40 + rnd() * 40;
    sp.position.set(w.x, CLOUD_Y - 2 + rnd() * 8, w.z);
    sp.scale.set(size, size * 0.5, 1);
    sp.visible = false;
    group.add(sp);
    clouds.push({ s: sp, x: w.x, z: w.z, ph: i * 1.7, k: 0.6 + rnd() * 0.4 });
  }

  // bolt: pre-allocated crossed ribbons (one along x, one along z per segment), refilled on each strike.
  // A narrow bright core plus a wide faint glow ribbon share the same path.
  const ribbon = (color: string, wScale: number) => {
    const pos = new Float32Array(MAX_SEGS * 2 * 4 * 3);
    const g = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(pos, 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', attr);
    const bi: number[] = [];
    for (let q = 0; q < MAX_SEGS * 2; q++) bi.push(q * 4, q * 4 + 1, q * 4 + 2, q * 4 + 1, q * 4 + 3, q * 4 + 2);
    g.setIndex(bi);
    g.setDrawRange(0, 0);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    mesh.visible = false;
    group.add(mesh);
    let quads = 0;
    return {
      mesh, mat,
      reset: () => {
        quads = 0;
      },
      seg: (a: Vec3, b: Vec3, w: number) => {
        for (const [dx, dz] of [[w * wScale, 0], [0, w * wScale]]) {
          pos.set([a.x - dx, a.y, a.z - dz, a.x + dx, a.y, a.z + dz, b.x - dx, b.y, b.z - dz, b.x + dx, b.y, b.z + dz], quads * 12);
          quads++;
        }
      },
      commit: () => {
        g.setDrawRange(0, quads * 6);
        attr.needsUpdate = true;
      },
      dispose: () => {
        g.dispose();
        mat.dispose();
      },
    };
  };
  const core = ribbon('#ffffff', 1);
  const glow = ribbon('#7fa2ff', 4.5);
  const bolts = [core, glow];
  const strikeBolt = (seed2: number, top: THREE.Vector3) => {
    for (const r of bolts) r.reset();
    const from = { x: top.x + 2, y: CLOUD_Y, z: top.z + 1 };
    const path = boltPath(seed2, from, { x: top.x, y: top.y, z: top.z }, MAIN_SEGS);
    for (let i = 0; i < MAIN_SEGS; i++) for (const r of bolts) r.seg(path[i], path[i + 1], 0.11);
    for (const [at, dx, dz] of [[4, 5, -3], [8, -4, 4]]) {
      const s = path[at];
      const br = boltPath(seed2 + at, s, { x: s.x + dx, y: s.y - 9, z: s.z + dz }, BRANCH_SEGS);
      for (let i = 0; i < BRANCH_SEGS; i++) for (const r of bolts) r.seg(br[i], br[i + 1], 0.06);
    }
    for (const r of bolts) r.commit();
  };

  // fire: three Points clouds driven entirely by uniforms (no per-frame allocation)
  const uniforms = {
    uTime: { value: 0 }, uBurn: { value: 0 }, uPx: { value: 1 },
    uOrigin: { value: new THREE.Vector3() }, uScale: { value: 0.4 },
  };
  const pointSets: THREE.Points[] = [];
  const particles = (n: number, speed: string, body: string, color: string, additive: boolean) => {
    const g = new THREE.BufferGeometry();
    const a = new Float32Array(n * 4);
    for (let i = 0; i < a.length; i++) a[i] = rnd();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aRnd', new THREE.BufferAttribute(a, 4));
    let blending: THREE.Blending = THREE.NormalBlending;
    if (additive) blending = THREE.AdditiveBlending;
    const m = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: PARTICLE_VERT.replace('SPEED', speed).replace('KIND_BODY', body),
      fragmentShader: FRAG.replace('COLOR_BODY', color),
      transparent: true, depthWrite: false, blending, toneMapped: false,
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    pts.visible = false;
    group.add(pts);
    pointSets.push(pts);
    return pts;
  };
  const fire = [
    particles(Math.round(130 * third), '1.1', FLAME_BODY, FLAME_COLOR, true),
    particles(Math.round(70 * third), '0.6', SPARK_BODY, SPARK_COLOR, true),
    particles(Math.round(70 * third), '0.13', SMOKE_BODY, SMOKE_COLOR, false),
  ];
  // one reused light, always in the scene (toggling lights would recompile every material); never casts shadows
  const light = new THREE.PointLight('#ff8a3a', 0, 16, 2);
  group.add(light);

  // per-strike state
  const treeTop = new THREE.Vector3();
  const orig = new THREE.Color();
  const tmp = new THREE.Color();
  let tree = -1;
  let lastAge = Infinity;
  let strikes = 0;
  let charWritten = 1;
  const writeChar = (i: number, c: number) => {
    const ic = crown.instanceColor!;
    tmp.copy(orig).lerp(CHARCOAL, c);
    ic.setXYZ(i, tmp.r, tmp.g, tmp.b);
    ic.addUpdateRange(i * 3, 3);
    ic.needsUpdate = true;
    charWritten = c;
  };

  const update = (s: StormState, t: number, px: number) => {
    // clouds
    const c = s.cloud;
    for (const cl of clouds) {
      cl.s.visible = c > 0;
      if (c <= 0) continue;
      cl.s.material.opacity = c * cl.k * 0.85;
      cl.s.position.x = cl.x + Math.sin(t * 0.03 + cl.ph) * 3 - (1 - c) * 30;
      cl.s.position.z = cl.z + Math.cos(t * 0.025 + cl.ph) * 2;
    }

    const st = s.strike;
    if (st === null) {
      for (const r of bolts) r.mesh.visible = false;
      light.intensity = 0;
      for (const p of fire) p.visible = false;
      lastAge = Infinity;
      return;
    }
    if (st.treeIndex !== tree || st.age < lastAge) {
      // a new strike: locate the tree top, build the bolt, remember the original colour (earlier trees stay charred)
      tree = st.treeIndex;
      const m = world.treeMatrices;
      const o = tree * 16;
      treeTop.set(m[o + 12], m[o + 13] + 1.05 * m[o + 5], m[o + 14]);
      uniforms.uOrigin.value.copy(treeTop);
      uniforms.uScale.value = m[o + 5];
      crown.getColorAt(tree, orig);
      charWritten = 0;
      strikes++;
      strikeBolt(tree * 31 + strikes, treeTop);
    }
    lastAge = st.age;

    const on = st.age < BOLT_SECONDS;
    for (const r of bolts) r.mesh.visible = on;
    if (on) {
      const k = 1 - st.age / BOLT_SECONDS;
      core.mat.opacity = k;
      glow.mat.opacity = k * 0.3;
    }

    const b = burn(st.age);
    uniforms.uTime.value = t;
    uniforms.uBurn.value = b;
    uniforms.uPx.value = px;
    for (const p of fire) p.visible = b > 0;
    // slow flicker (about 1.4 Hz, no strobing), scaled by burn
    light.position.copy(treeTop);
    light.intensity = b * (14 + 4 * Math.sin(t * 9));

    const ch = Math.min(1, st.age / CHAR_SECONDS);
    if (ch !== charWritten) writeChar(tree, ch);
  };

  const dispose = () => {
    ct.dispose();
    for (const cl of clouds) cl.s.material.dispose();
    for (const r of bolts) r.dispose();
    for (const p of pointSets) {
      p.geometry.dispose();
      (p.material as THREE.Material).dispose();
    }
    light.dispose();
  };

  return { group, update, dispose, treeTop };
}

// indices of the trees that fall inside the camera's view (NDC within +-margin), for biasing the strike on-screen
export function treesInView(world: WorldData, cam: THREE.PerspectiveCamera, margin: number): number[] {
  cam.updateMatrixWorld();
  const v = new THREE.Vector3();
  const out: number[] = [];
  for (let i = 0; i < world.treeCount; i++) {
    const o = i * 16;
    v.set(world.treeMatrices[o + 12], world.treeMatrices[o + 13], world.treeMatrices[o + 14]).project(cam);
    if (Math.abs(v.x) < margin && Math.abs(v.y) < margin && v.z > -1 && v.z < 1) out.push(i);
  }
  return out;
}
