// Terrain material: the baked top-down albedo + shadows for gentle ground, blended by slope into a
// triplanar procedural rock (strata, cracks, relief bump, moss) for cliffs.
import * as THREE from 'three';
import type { WorldData } from '../terrain/world';
import { SUN_DIR } from '../terrain/layout';
import type { Profile } from '../terrain/profile';

const ROCK_GLSL = /* glsl */ `
uniform sampler2D uRock;
uniform sampler2D uNoise;
uniform vec3 uSun;
varying vec3 vWPos;
varying vec3 vWNrm;

float hash11(float x) { return fract(sin(x * 127.1) * 43758.5453); }
vec4 tri(sampler2D t, vec3 p, vec3 w) {
  return texture2D(t, p.zy) * w.x + texture2D(t, p.xy) * w.z + texture2D(t, p.xz) * w.y;
}
`;

const ROCK_BLOCK = /* glsl */ `
vec3 N = normalize(vWNrm);
float rockW = 1.0 - smoothstep(0.5, 0.76, N.y);
// a cliff spans only a texel or two of the top-down map, whose rim and foot speckle then smears into dark vertical
// streaks: light steep faces from the mesh normal instead (same granite, sky and sun terms as the bake)
vec3 steepLit = vec3(0.698, 0.675, 0.635) * (vec3(0.34, 0.42, 0.54) * (0.6 + 0.4 * N.y) + vec3(1.5, 1.36, 1.14) * max(dot(N, uSun), 0.0));
diffuseColor.rgb = mix(diffuseColor.rgb, pow(pow(steepLit, vec3(1.0 / 1.06)), vec3(2.2)), rockW);
// no branch here: texture lookups and dFdx/dFdy need uniform control flow, rockW is applied with mix below
{
  vec3 p = vWPos;
  vec3 w = pow(abs(N), vec3(4.0));
  w /= (w.x + w.y + w.z);
  vec4 nz = tri(uNoise, p * 0.043, w);
  // two scales of the same tile, blended by low-frequency noise so no repeat shows
  vec4 rk = tri(uRock, p / 5.2, w);
  #ifndef ROCK_LITE
    vec4 rk2 = tri(uRock, p / 3.3 + vec3(0.37, 0.61, 0.19), w);
    rk = mix(rk, rk2, smoothstep(0.35, 0.65, nz.r));
    vec4 fine = tri(uRock, p / 0.9, w);
    rk.rgb *= 0.78 + 0.44 * fine.a;
    rk.a = rk.a * 0.75 + fine.a * 0.25;
  #endif
  // sedimentary strata: warped, slightly dipping layers each with its own tint and a soft bedding line
  float yy = p.y * 0.8 + (nz.g - 0.5) * 1.7 + (nz.b - 0.5) * 0.35 + dot(p.xz, vec2(0.05, 0.03));
  float layer = floor(yy);
  float fl = fract(yy);
  float r1 = hash11(layer);
  float r2 = hash11(layer + 7.3);
  vec3 tint = mix(mix(vec3(0.94, 0.97, 1.02), vec3(1.1, 1.02, 0.86), smoothstep(0.25, 0.55, r1)), vec3(1.16, 0.97, 0.77), smoothstep(0.72, 0.92, r2));
  float line = 1.0 - smoothstep(0.0, 0.07, min(fl, 1.0 - fl));
  vec3 alb = rk.rgb * tint * (1.0 - 0.16 * line * (0.4 + r2));
  alb *= mix(0.6, 1.0, smoothstep(0.08, 0.6, rk.a));
  // soft weathering streaks that follow the face: low contrast, cool
  float st = texture2D(uNoise, vec2(p.z * 0.18, p.y * 0.12)).a * w.x + texture2D(uNoise, vec2(p.x * 0.18, p.y * 0.12)).a * w.z + 0.5 * w.y;
  float stain = smoothstep(0.5, 0.85, st);
  alb = mix(alb, alb * vec3(0.84, 0.89, 0.93), stain * 0.55);
  #ifndef ROCK_LITE
    // moss in crevices, more on ledges; pale lichen flecks
    float moss = smoothstep(0.5, 0.78, 1.0 - rk.a) * smoothstep(0.4, 0.62, nz.g * 0.6 + nz.b * 0.4) * (0.35 + 0.65 * smoothstep(0.3, 0.75, N.y));
    alb = mix(alb, vec3(0.1, 0.17, 0.05) * (0.8 + 0.5 * fine.a), moss * 0.62);
    alb = mix(alb, vec3(0.5, 0.52, 0.34), smoothstep(0.78, 0.9, nz.b) * 0.22 * (1.0 - moss));
  #endif
  // relief bump from the height channel + layer steps, taken from screen-space derivatives
  float Hh = (rk.a - 0.5) * 0.11 + ((r1 - 0.5) * 0.3 + fl * 0.16) * 0.1;
  vec3 dpx = dFdx(vWPos);
  vec3 dpy = dFdy(vWPos);
  float dHx = dFdx(Hh);
  float dHy = dFdy(Hh);
  vec3 r1v = cross(dpy, N);
  vec3 r2v = cross(N, dpx);
  float det = dot(dpx, r1v);
  vec3 Np = normalize(abs(det) * N - sign(det) * (dHx * r1v + dHy * r2v));
  float rake = clamp(1.0 + 1.5 * (max(dot(Np, uSun), 0.0) - max(dot(N, uSun), 0.0)), 0.5, 1.6);
  vec3 ratio = alb / vec3(0.4458, 0.4125, 0.3613);
  diffuseColor.rgb *= mix(vec3(1.0), ratio * rake, rockW);
}
`;

export function makeTerrainMaterial(map: THREE.Texture, world: WorldData, profile: Profile) {
  const rock = new THREE.DataTexture(world.rock as Uint8ClampedArray<ArrayBuffer>, world.rockSize, world.rockSize);
  rock.colorSpace = THREE.SRGBColorSpace;
  const noise = new THREE.DataTexture(world.rockNoise as Uint8ClampedArray<ArrayBuffer>, world.rockSize, world.rockSize);
  for (const t of [rock, noise]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.needsUpdate = true;
  }
  const mat = new THREE.MeshBasicMaterial({ map, toneMapped: false });
  if (profile.name === 'low') mat.defines = { ROCK_LITE: '' };
  const sun = new THREE.Vector3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z).normalize();
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRock = { value: rock };
    sh.uniforms.uNoise = { value: noise };
    sh.uniforms.uSun = { value: sun };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = position;\nvWNrm = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${ROCK_GLSL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${ROCK_BLOCK}`);
  };
  return mat;
}
