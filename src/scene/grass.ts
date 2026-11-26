// Instanced grass blades on the grass mask: wind sway in the vertex shader, root colour and baked shadow taken
// from the terrain texture, realtime shadows, sun translucency and GPU distance LOD by per-blade rank.
import * as THREE from 'three';
import type { WorldData } from '../terrain/world';
import { SUN_DIR } from '../terrain/layout';
import { WIND_GLSL, type Shared } from './wind';

const VERT = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
#include <shadowmap_pars_vertex>
${WIND_GLSL}
attribute vec3 iPos;
attribute vec4 iRnd;
uniform vec3 uCam;
uniform float uSize;
uniform sampler2D uGround;
varying vec3 vGround;
varying vec3 vN;
varying vec3 vWP;
varying float vT;
varying float vVar;

void main() {
  float side = position.x;
  float t = position.y;
  float dist = distance(iPos, uCam);
  // keep fraction falls with distance; the rank decides which blades survive, survivors widen
  float keep = 1.0 - smoothstep(30.0, 80.0, dist) * 0.8;
  float vis = step(iRnd.x, keep);
  float widen = 1.0 + smoothstep(10.0, 70.0, dist) * 2.2;
  float hgt = (0.2 + iRnd.y * 0.22) * vis;
  float wid = 0.024 * (1.0 - t * 0.9) * widen * vis;
  float yaw = iRnd.w * 6.2832;
  vec2 dirv = vec2(cos(yaw), sin(yaw));
  vec2 perp = vec2(-dirv.y, dirv.x);
  float lean = (iRnd.z - 0.5) * 0.9;
  vec2 wnd = windAt(iPos.xz);
  vec3 p = iPos;
  p.xz += perp * side * wid + dirv * lean * t * t * hgt * 0.55 + wnd * 0.9 * t * t * hgt;
  p.y += t * hgt * (1.0 - 0.25 * length(wnd) * t * 0.3);
  vec3 tang = normalize(vec3(dirv * lean * t * 0.55 + wnd * t * 0.5, 1.0).xzy);
  vN = normalize(cross(vec3(perp.x, 0.0, perp.y), tang));
  vT = t;
  vVar = iRnd.z;
  vWP = p;
  vGround = texture2D(uGround, vec2(iPos.x / uSize + 0.5, 0.5 - iPos.z / uSize)).rgb;
  vec4 worldPosition = vec4(p, 1.0);
  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;
  vec3 transformedNormal = normalize(normalMatrix * vec3(0.0, 1.0, 0.0));
  #include <shadowmap_vertex>
  #include <fog_vertex>
}
`;

const FRAG = /* glsl */ `
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
uniform vec3 uSun;
varying vec3 vGround;
varying vec3 vN;
varying vec3 vWP;
varying float vT;
varying float vVar;

void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vWP);
  if (dot(n, v) < 0.0) n = -n;
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 nl = normalize(mix(up, n, 0.5));
  float diff = 0.5 + 0.55 * max(dot(nl, uSun), 0.0);
  // light shining through the blade when looking toward the sun
  float trans = pow(max(-dot(v, uSun), 0.0), 3.0) * vT * 0.6;
  vec3 tintA = vec3(0.72, 1.12, 0.6);
  vec3 tintB = vec3(1.18, 1.1, 0.55);
  vec3 col = vGround * mix(tintA, tintB, vVar * vVar) * 1.25;
  col *= mix(0.42, 1.3, vT) * diff;
  col += vec3(0.16, 0.2, 0.04) * trans;
  float sh = getShadowMask();
  col *= 1.0 - 0.34 * (1.0 - sh);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export type Grass = { mesh: THREE.Mesh; setCamera: (p: THREE.Vector3) => void };

export function createGrass(world: WorldData, ground: THREE.Texture, shared: Shared): Grass {
  // 3 rings of 2 verts plus a tip: position = (side, t)
  const ts = [0, 0.4, 0.75];
  const pos: number[] = [];
  ts.forEach((t) => pos.push(-1, t, 0, 1, t, 0));
  pos.push(0, 1, 0);
  const idx = [0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6];
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.instanceCount = world.grassCount;
  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(world.grassPos.subarray(0, world.grassCount * 3), 3));
  geo.setAttribute('iRnd', new THREE.InstancedBufferAttribute(world.grassRnd.subarray(0, world.grassCount * 4), 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), world.worldSize);
  const uCam = { value: new THREE.Vector3(0, 30, -60) };
  const sun = new THREE.Vector3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z).normalize();
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.DoubleSide,
    lights: true,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.lights,
      THREE.UniformsLib.fog,
      {
        uSun: { value: sun },
        uCam,
        uSize: { value: world.worldSize },
        uGround: { value: ground },
        uTime: shared.uTime,
        uMotion: shared.uMotion,
      },
    ]),
  });
  // merge() clones values; point back at the shared objects so one write drives every material
  mat.uniforms.uTime = shared.uTime;
  mat.uniforms.uMotion = shared.uMotion;
  mat.uniforms.uCam = uCam;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  return { mesh, setCamera: (p) => uCam.value.copy(p) };
}
