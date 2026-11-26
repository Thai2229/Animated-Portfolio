// Moving water: the waterfall shader, spray / mist billboards, plunge-pool rings, the river overlay and the
// flowing lake surface. Everything is driven by one shared time uniform, no per-frame CPU work.
import * as THREE from 'three';
import { WATER_Y } from '../terrain/layout';
import type { Shared } from './wind';

const NOISE_GLSL = /* glsl */ `
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

const PLAIN_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
varying vec2 vUv;
varying vec3 vWP;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FOG_UNIFORMS = () => THREE.UniformsUtils.clone(THREE.UniformsLib.fog);

function shaderMat(frag: string, shared: Shared, extra: Record<string, THREE.IUniform>, vert = PLAIN_VERT, defines: Record<string, string> = {}) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    defines,
    fog: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { ...FOG_UNIFORMS(), ...extra },
  });
  mat.uniforms.uTime = shared.uTime;
  return mat;
}

// ---- waterfall ribbon. uv.x across, uv.y from the lip (0) to the base (1); the geometry already accelerates.
const FALL_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform float uOp;
uniform float uVeil;
varying vec2 vUv;
varying vec3 vWP;
${NOISE_GLSL}
void main() {
  float u = vUv.x;
  float v = vUv.y;
  float edge = min(u, 1.0 - u);
  float glass = smoothstep(0.0, 0.14, v);
  float warp = vnoise(vec2(u * 3.0, v * 2.0 - uTime * 0.4)) * 2.0;
  float s1 = vnoise(vec2(u * 18.0 + warp, v * 2.6 - uTime * 1.6));
  float s2 = vnoise(vec2(u * 46.0 + 9.0, v * 5.2 - uTime * 2.7));
  float s3 = vnoise(vec2(u * 9.0 + 3.0, v * 1.4 - uTime * 0.9));
  float streak = mix(0.5, s1 * 0.5 + s2 * 0.32 + s3 * 0.18, glass);
  float foam = smoothstep(0.38, 0.8, streak);
  float edgeFoam = 1.0 - smoothstep(0.0, 0.17, edge + (s2 - 0.5) * 0.08);
  vec3 n = normalize(cross(dFdx(vWP), dFdy(vWP)));
  vec3 view = normalize(cameraPosition - vWP);
  float fres = pow(1.0 - abs(dot(n, view)), 2.0);
  vec3 deep = vec3(0.6, 0.8, 0.86);
  vec3 col = mix(deep, vec3(1.0), 0.3 + 0.7 * max(foam, edgeFoam));
  col += fres * 0.22;
  // the lip: a clear, glassy tongue with a bright rim where the river tips over
  float rim = smoothstep(0.0, 0.035, v) * (1.0 - smoothstep(0.035, 0.09, v));
  col = mix(col, vec3(1.0), rim * 0.8);
  float a = uOp * mix(0.34, 1.0, max(foam, edgeFoam)) * smoothstep(0.0, 0.07, edge) * (1.0 - smoothstep(0.86, 1.0, v) * 0.5);
  a = mix(a, a * 0.35 + fres * 0.2 * (0.5 + s3), uVeil);
  col = mix(col, vec3(0.93, 0.97, 1.0), uVeil * 0.6);
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  #include <fog_fragment>
}
`;

export function fallMaterial(shared: Shared, opacity: number, veil: number) {
  return shaderMat(FALL_FRAG, shared, { uOp: { value: opacity }, uVeil: { value: veil } });
}

// ---- instanced billboards: SPRAY arcs under gravity (additive), MIST rises and drifts (alpha)
const BILL_VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute vec4 aSeed;
uniform float uTime;
uniform vec3 uOrigin;
uniform vec3 uSide;
uniform vec3 uDir;
uniform float uSpread;
uniform float uMotion;
varying vec2 vUv;
varying float vA;
void main() {
  float rate = 0.5;
  #ifdef MIST
    rate = 0.045;
  #endif
  float ph = fract(uTime * rate * uMotion + aSeed.x);
  vec3 c;
  float size;
  float a;
  #ifdef MIST
    float life = 22.0;
    float t = ph * life;
    c = uOrigin + uSide * (aSeed.y - 0.5) * uSpread + uDir * (aSeed.z - 0.5) * uSpread * 0.6;
    c.y += 0.3 + t * (0.1 + aSeed.w * 0.08);
    c += (uDir * 0.7 + uSide * (aSeed.y - 0.5) * 0.5) * t * 0.05 + vec3(sin(t * 0.5 + aSeed.x * 20.0), 0.0, cos(t * 0.43 + aSeed.y * 20.0)) * 0.25;
    size = (1.3 + aSeed.w * 2.4) * (0.6 + ph * 0.9);
    a = sin(ph * 3.14159);
  #else
    float life = 0.9 + aSeed.y * 0.8;
    float t = ph * life;
    float ang = aSeed.z * 6.2832;
    vec3 vel = (uSide * cos(ang) * 0.9 + uDir * (0.3 + sin(ang) * 0.8)) * (0.3 + aSeed.w * 1.3) + vec3(0.0, 1.6 + aSeed.y * 2.6, 0.0);
    c = uOrigin + uSide * (aSeed.w - 0.5) * uSpread + uDir * (aSeed.y - 0.5) * 0.7;
    c += vel * t;
    c.y -= 0.5 * 6.5 * t * t;
    size = (0.09 + 0.09 * aSeed.y) * (1.0 - ph * 0.45);
    a = smoothstep(0.0, 0.08, ph) * (1.0 - ph);
    a *= step(${WATER_Y.toFixed(2)}, c.y);
  #endif
  vA = a;
  vUv = position.xy * 2.0;
  vec4 mv = viewMatrix * vec4(c, 1.0);
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;
  vec4 mvPosition = mv;
  #include <fog_vertex>
}
`;

const BILL_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
varying vec2 vUv;
varying float vA;
void main() {
  float d = length(vUv);
  float a = smoothstep(1.0, 0.15, d) * vA;
  #ifdef MIST
    gl_FragColor = vec4(0.96, 0.98, 1.0, a * 0.22);
  #else
    gl_FragColor = vec4(0.82, 0.92, 1.0, a * 0.9);
  #endif
  #include <fog_fragment>
}
`;

export type BillboardSpec = {
  kind: 'SPRAY' | 'MIST';
  count: number;
  origin: THREE.Vector3;
  side: THREE.Vector3;
  dir: THREE.Vector3;
  spread: number;
  seed: number;
};

export function createBillboards(spec: BillboardSpec, shared: Shared) {
  const geo = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1) as unknown as THREE.InstancedBufferGeometry);
  let s = spec.seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const seeds = new Float32Array(spec.count * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = rnd();
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
  geo.instanceCount = spec.count;
  geo.boundingSphere = new THREE.Sphere(spec.origin.clone(), 40);
  const mat = shaderMat(
    BILL_FRAG,
    shared,
    {
      uOrigin: { value: spec.origin },
      uSide: { value: spec.side },
      uDir: { value: spec.dir },
      uSpread: { value: spec.spread },
      uMotion: shared.uMotion,
    },
    BILL_VERT,
    { [spec.kind]: '' },
  );
  mat.uniforms.uMotion = shared.uMotion;
  if (spec.kind === 'SPRAY') mat.blending = THREE.AdditiveBlending;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  return mesh;
}

// ---- plunge pool: expanding foam / ripple rings and churning foam where the fall lands
const POOL_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
varying vec2 vUv;
varying vec3 vWP;
${NOISE_GLSL}
void main() {
  vec2 q = (vUv - 0.5) * 2.0;
  float r = length(q);
  float ang = atan(q.y, q.x);
  float rings = 0.0;
  for (int k = 0; k < 4; k++) {
    float ph = fract(uTime * 0.2 + float(k) * 0.25);
    float R = 0.12 + ph * 0.85;
    float w = 0.035 + 0.07 * ph;
    float d = (r - R) / w;
    rings += exp(-d * d) * (1.0 - ph) * (0.55 + 0.45 * vnoise(vec2(ang * 3.0 + float(k) * 9.0, r * 7.0)));
  }
  float churn = smoothstep(0.5, 0.0, r) * (0.45 + 0.7 * vnoise(vWP.xz * 3.2 + vec2(uTime * 1.3, -uTime * 1.9)));
  float a = clamp(rings * 0.55 + churn * 0.8, 0.0, 0.85) * (1.0 - smoothstep(0.82, 1.0, r));
  gl_FragColor = vec4(vec3(0.92, 0.97, 1.0), a);
  #include <fog_fragment>
}
`;

export function createPool(center: THREE.Vector3, size: number, shared: Shared) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), shaderMat(POOL_FRAG, shared, {}));
  mesh.position.set(center.x, WATER_Y + 0.035, center.z);
  mesh.renderOrder = 2;
  return mesh;
}

// ---- river overlay from the plunge pool to the lake: uv.x across, uv.y = distance along the flow
const RIVER_FRAG = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
varying vec2 vUv;
varying vec3 vWP;
${NOISE_GLSL}
void main() {
  float u = vUv.x;
  float y = vUv.y;
  float edge = min(u, 1.0 - u);
  float s1 = vnoise(vec2(u * 6.0, y * 0.9 - uTime * 1.2));
  float s2 = vnoise(vec2(u * 15.0 + y * 0.3, y * 2.4 - uTime * 2.0));
  float chev = smoothstep(0.55, 0.9, s1 * 0.6 + s2 * 0.5);
  float outflow = 1.0 - smoothstep(0.0, 4.0, y);
  float a = (0.07 + 0.34 * chev + 0.45 * outflow * smoothstep(0.3, 0.7, s2)) * smoothstep(0.0, 0.3, edge);
  vec2 cell = floor(vec2(u * 18.0, y * 5.0));
  float r = hash21(cell);
  float sp = step(0.94, r) * pow(0.5 + 0.5 * sin(uTime * 4.0 + r * 60.0), 8.0) * smoothstep(0.3, 0.0, length(fract(vec2(u * 18.0, y * 5.0)) - 0.5));
  gl_FragColor = vec4(vec3(0.88, 0.95, 1.0), clamp(a + sp, 0.0, 0.9));
  #include <fog_fragment>
}
`;

export function createRiver(path: THREE.Vector3[], width: number, shared: Shared) {
  const curve = new THREE.CatmullRomCurve3(path);
  const pts = curve.getPoints(80);
  const p: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let len = 0;
  pts.forEach((pt, i) => {
    if (i > 0) len += pt.distanceTo(pts[i - 1]);
    const tan = curve.getTangent(i / (pts.length - 1));
    const sx = -tan.z * width * 0.5;
    const sz = tan.x * width * 0.5;
    p.push(pt.x - sx, WATER_Y + 0.03, pt.z - sz, pt.x + sx, WATER_Y + 0.03, pt.z + sz);
    uv.push(0, len, 1, len);
    if (i < pts.length - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, shaderMat(RIVER_FRAG, shared, {}));
  mesh.renderOrder = 1;
  return mesh;
}

// ---- lake surface: two counter-scrolling normal layers and sun glints on top of the standard water material
export function flowWater(mat: THREE.MeshStandardMaterial, shared: Shared) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <normalmap_pars_fragment>',
        `#include <normalmap_pars_fragment>
        uniform float uTime;
        varying vec3 vWPos;
        ${NOISE_GLSL}
        vec3 waterMapN(vec2 uv) {
          vec3 a = texture2D(normalMap, uv + vec2(uTime * 0.02, uTime * 0.012)).xyz * 2.0 - 1.0;
          vec3 b = texture2D(normalMap, uv * 1.73 + vec2(-uTime * 0.026, uTime * 0.018) + 0.3).xyz * 2.0 - 1.0;
          return normalize(vec3(a.xy + b.xy, a.z * b.z));
        }
        float glint(vec2 p) {
          vec2 g = p * 7.0;
          float r = hash21(floor(g));
          float on = step(0.92, r) * pow(0.5 + 0.5 * sin(uTime * (2.0 + r * 3.0) + r * 60.0), 10.0);
          return on * smoothstep(0.3, 0.0, length(fract(g) - 0.5));
        }`,
      )
      .replace('texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0', 'waterMapN( vNormalMapUv )')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.9, 0.95, 1.0) * glint(vWPos.xz) * 1.4;');
  };
}
